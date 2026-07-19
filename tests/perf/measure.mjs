#!/usr/bin/env node
/**
 * Reproducible performance harness — story-perf-0-harness.md.
 *
 * Measures any page's cold-load behavior deterministically: fresh context,
 * scripted CDP network + CPU throttling (never the DevTools dropdown, which
 * can't be scripted reproducibly), fixed viewport. Page-agnostic on purpose
 * — the image-choreography epic is its first customer, not its only one.
 *
 * IMPORTANT: measures against a production build, not the dev server. Astro
 * dev serves unminified, unbundled, per-module JS over many small requests —
 * a fundamentally different load profile than what a real user gets, and
 * this harness's whole premise (JS parse/execute cost, connection-pool
 * contention) would be measuring the wrong thing against it. Build and
 * preview first:
 *
 *   npm run build && npm run preview   # in one terminal, leave it running
 *   node tests/perf/measure.mjs --url=/work --label=baseline --runs=5
 *
 * Usage:
 *   node tests/perf/measure.mjs --url=/work --label=baseline [--runs=5] [--base=http://localhost:4321]
 *   node tests/perf/measure.mjs --compare=baseline,after-sequencer
 *
 * See docs/perf-harness.md for the full walkthrough and the noise-floor rule.
 */
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { writeFileSync, readFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { FAST_3G, CPU_4X, VIEWPORT } from "./profiles.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = join(__dirname, "results");
if (!existsSync(RESULTS_DIR)) mkdirSync(RESULTS_DIR, { recursive: true });

// ─── CLI args ─────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = {};
  for (const raw of argv) {
    const m = raw.match(/^--([^=]+)=?(.*)$/);
    if (m) args[m[1]] = m[2] === "" ? true : m[2];
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));

// ─── Injected into the page before any navigation, so it's registered ──────
// before first paint. Plain function — no closure over outer scope, since
// addInitScript re-serializes it into the page.

function installObservers() {
  window.__perf = { lcpEntries: [], cls: 0 };
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        window.__perf.lcpEntries.push({
          time: e.startTime,
          size: e.size,
          tag: e.element ? e.element.tagName : null,
          src:
            e.url ||
            (e.element && (e.element.currentSrc || e.element.src)) ||
            null,
        });
      }
    }).observe({ type: "largest-contentful-paint", buffered: true });
  } catch (err) {
    /* LCP not supported in this browser — leave lcpEntries empty */
  }
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        if (!e.hadRecentInput) window.__perf.cls += e.value;
      }
    }).observe({ type: "layout-shift", buffered: true });
  } catch (err) {
    /* CLS not supported — leave at 0 */
  }
}

// ─── Single cold-load measurement ───────────────────────────────────────────

async function measureOnce(url) {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();

  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.clearBrowserCache");
  await cdp.send("Network.emulateNetworkConditions", FAST_3G);
  await cdp.send("Emulation.setCPUThrottlingRate", CPU_4X);

  await page.addInitScript(installObservers);

  await page.goto(url, { waitUntil: "load", timeout: 90000 });
  // Let LCP/CLS settle — scrolling or clicking would freeze LCP reporting,
  // so we deliberately do nothing else before reading it.
  await page.waitForTimeout(2000);

  const raw = await page.evaluate(() => {
    const paint = performance.getEntriesByType("paint");
    const fcp = paint.find((p) => p.name === "first-contentful-paint");
    const nav = performance.getEntriesByType("navigation")[0];
    const resources = performance
      .getEntriesByType("resource")
      .filter(
        (r) =>
          r.initiatorType === "img" ||
          /\.(png|jpe?g|webp|gif|svg)(\?|$)/i.test(r.name),
      )
      .map((r) => ({
        url: r.name,
        startTime: r.startTime,
        responseEnd: r.responseEnd,
        transferSize: r.transferSize,
      }));
    const allResources = performance
      .getEntriesByType("resource")
      .map((r) => ({ startTime: r.startTime, transferSize: r.transferSize }));
    return {
      lcpEntries: window.__perf ? window.__perf.lcpEntries : [],
      cls: window.__perf ? window.__perf.cls : null,
      fcp: fcp ? fcp.startTime : null,
      ttfb: nav ? nav.responseStart : null,
      imageResources: resources,
      allResources,
    };
  });

  await context.close();
  await browser.close();

  return buildMetrics(raw);
}

function median(values) {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function maxConcurrent(intervals) {
  // Sweep-line over [startTime, responseEnd] windows — the clearest single
  // exposure of a request stampede vs. a sequenced load.
  const events = [];
  for (const { startTime, responseEnd } of intervals) {
    events.push([startTime, 1], [responseEnd, -1]);
  }
  events.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let cur = 0;
  let max = 0;
  for (const [, delta] of events) {
    cur += delta;
    if (cur > max) max = cur;
  }
  return max;
}

function buildMetrics(raw) {
  const lcp = raw.lcpEntries.length
    ? raw.lcpEntries[raw.lcpEntries.length - 1]
    : null;
  const images = raw.imageResources;
  const firstImageStart = images.length
    ? Math.min(...images.map((i) => i.startTime))
    : null;
  const firstNPaintedTimes = images
    .slice()
    .sort((a, b) => a.responseEnd - b.responseEnd)
    .slice(0, Number(args.n || 3))
    .map((i) => i.responseEnd);
  const bytesBy3s = raw.allResources
    .filter((r) => r.startTime <= 3000)
    .reduce((sum, r) => sum + (r.transferSize || 0), 0);

  return {
    lcp: lcp
      ? { time: lcp.time, size: lcp.size, tag: lcp.tag, src: lcp.src }
      : null,
    cls: raw.cls,
    fcp: raw.fcp,
    ttfb: raw.ttfb,
    maxConcurrentImageRequests: maxConcurrent(images),
    firstImageRequestStart: firstImageStart,
    firstNImagesLoadedAt: firstNPaintedTimes.length
      ? Math.max(...firstNPaintedTimes)
      : null,
    bytesBy3s,
    imageCount: images.length,
    images,
  };
}

// ─── Multi-run summary (median/min/max) ─────────────────────────────────────

const SCALAR_METRICS = [
  "cls",
  "fcp",
  "ttfb",
  "maxConcurrentImageRequests",
  "firstImageRequestStart",
  "firstNImagesLoadedAt",
  "bytesBy3s",
];

function summarizeRuns(runs) {
  const summary = {};
  for (const key of SCALAR_METRICS) {
    const values = runs.map((r) => r[key]).filter((v) => v != null);
    summary[key] = values.length
      ? {
          median: median(values),
          min: Math.min(...values),
          max: Math.max(...values),
        }
      : { median: null, min: null, max: null };
  }
  const lcpTimes = runs
    .map((r) => r.lcp && r.lcp.time)
    .filter((v) => v != null);
  const lcpElements = runs.map((r) => r.lcp && `${r.lcp.tag}:${r.lcp.src}`);
  const distinctElements = new Set(lcpElements.filter(Boolean));
  summary.lcp = {
    median: lcpTimes.length ? median(lcpTimes) : null,
    min: lcpTimes.length ? Math.min(...lcpTimes) : null,
    max: lcpTimes.length ? Math.max(...lcpTimes) : null,
    element:
      runs[0] && runs[0].lcp
        ? { tag: runs[0].lcp.tag, src: runs[0].lcp.src }
        : null,
    elementConsistentAcrossRuns: distinctElements.size <= 1,
  };
  return summary;
}

function gitSha() {
  try {
    return execSync("git rev-parse --short HEAD", { cwd: __dirname })
      .toString()
      .trim();
  } catch {
    return "unknown";
  }
}

// ─── Compare mode ────────────────────────────────────────────────────────────

function loadResult(label) {
  const path = join(RESULTS_DIR, `${label}.json`);
  if (!existsSync(path)) {
    throw new Error(`No results for label "${label}" at ${path}`);
  }
  return JSON.parse(readFileSync(path, "utf-8"));
}

function compare(labelA, labelB) {
  const a = loadResult(labelA);
  const b = loadResult(labelB);

  console.log(`\nComparing "${labelA}" (${a.sha}) vs "${labelB}" (${b.sha})\n`);

  if (a.summary.lcp.element && b.summary.lcp.element) {
    const same =
      a.summary.lcp.element.tag === b.summary.lcp.element.tag &&
      a.summary.lcp.element.src === b.summary.lcp.element.src;
    if (!same) {
      console.log(
        `⚠ LCP element differs between runs — comparing unlike things:\n` +
          `  ${labelA}: ${a.summary.lcp.element.tag} ${a.summary.lcp.element.src}\n` +
          `  ${labelB}: ${b.summary.lcp.element.tag} ${b.summary.lcp.element.src}\n`,
      );
    }
  }

  const rows = [];
  for (const key of [...SCALAR_METRICS, "lcp"]) {
    const sa = a.summary[key];
    const sb = b.summary[key];
    if (sa.median == null || sb.median == null) continue;
    const delta = sb.median - sa.median;
    const pct = sa.median !== 0 ? (delta / sa.median) * 100 : null;
    // Noise floor proxy: baseline's own observed spread across its N runs.
    const noiseFloor = sa.max - sa.min;
    const significant = Math.abs(delta) > noiseFloor;
    rows.push({
      metric: key,
      [`${labelA} (median)`]: Math.round(sa.median * 100) / 100,
      [`${labelB} (median)`]: Math.round(sb.median * 100) / 100,
      Δ: Math.round(delta * 100) / 100,
      "Δ%": pct != null ? `${Math.round(pct * 10) / 10}%` : "n/a",
      [`noise floor (${labelA})`]: Math.round(noiseFloor * 100) / 100,
      "beyond noise floor?": significant ? "YES" : "no",
    });
  }
  console.table(rows);
}

// ─── Entry point ─────────────────────────────────────────────────────────────

async function main() {
  if (args.compare) {
    const [labelA, labelB] = String(args.compare)
      .split(",")
      .map((s) => s.trim());
    if (!labelA || !labelB) {
      throw new Error("--compare requires two labels: --compare=labelA,labelB");
    }
    compare(labelA, labelB);
    return;
  }

  if (!args.url || !args.label) {
    console.error(
      "Usage: node tests/perf/measure.mjs --url=/work --label=baseline [--runs=5] [--base=http://localhost:4321]\n" +
        "   or: node tests/perf/measure.mjs --compare=labelA,labelB",
    );
    process.exit(1);
  }

  const base = args.base || "http://localhost:4321";
  const fullUrl = new URL(args.url, base).toString();
  const runCount = Number(args.runs || 5);

  console.log(
    `Measuring ${fullUrl} — ${runCount} run(s), label "${args.label}"...`,
  );
  const runs = [];
  for (let i = 0; i < runCount; i++) {
    process.stdout.write(`  run ${i + 1}/${runCount}... `);
    const metrics = await measureOnce(fullUrl);
    console.log(
      `LCP ${metrics.lcp ? Math.round(metrics.lcp.time) + "ms" : "n/a"}`,
    );
    runs.push(metrics);
  }

  const summary = summarizeRuns(runs);
  const result = {
    label: args.label,
    url: fullUrl,
    sha: gitSha(),
    timestamp: new Date().toISOString(),
    profile: { network: "FAST_3G", cpu: "CPU_4X", viewport: VIEWPORT },
    runCount,
    summary,
    runs,
  };

  const outPath = join(RESULTS_DIR, `${args.label}.json`);
  writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log(`\nWrote ${outPath}`);
  console.log("\nSummary (median [min, max]):");
  console.table(
    Object.fromEntries(
      Object.entries(summary).map(([k, v]) => [
        k,
        k === "lcp"
          ? `${Math.round(v.median)}ms [${Math.round(v.min)}, ${Math.round(v.max)}] — ${v.elementConsistentAcrossRuns ? "same element" : "ELEMENT CHANGED"}`
          : v.median != null
            ? `${Math.round(v.median * 100) / 100} [${Math.round(v.min * 100) / 100}, ${Math.round(v.max * 100) / 100}]`
            : "n/a",
      ]),
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
