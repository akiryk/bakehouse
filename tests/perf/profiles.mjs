/**
 * Named, fixed throttling profiles for the perf harness — never inline these
 * values at a call site. A profile drifting between runs (someone "just
 * tweaking" a latency number) is exactly what turns a comparison dishonest;
 * keeping them here, imported by name, is what prevents that.
 *
 * FAST_3G matches Chrome DevTools' own manual-throttling "Fast 3G" preset
 * (not Lighthouse's differently-calibrated simulated-throttling profile of
 * the same name, which uses a shorter, ~150ms latency — the two are a
 * well-known point of confusion). Values from Chrome's own
 * `lib/thirdparty/devtools_networkConditions.js`-derived preset table.
 */
export const FAST_3G = {
  offline: false,
  latency: 562.5, // ms RTT
  downloadThroughput: (1.6 * 1024 * 1024) / 8, // 1.6 Mbps, in bytes/sec
  uploadThroughput: (750 * 1024) / 8, // 750 Kbps, in bytes/sec
};

/** Chrome DevTools' / Lighthouse's standard "mid-tier mobile" CPU slowdown. */
export const CPU_4X = { rate: 4 };

/** Fixed so which element counts as LCP can't shift between runs because of
 * a resized window — not configurable per-run on purpose. */
export const VIEWPORT = { width: 1440, height: 900 };
