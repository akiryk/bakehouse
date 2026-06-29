// ─── Mat shape (clip-path octagon) ───────────────────────────────────────────
//
// Coordinate space: percentage of the mat div's box (0–100).
// The mat is a position: fixed div inset by --mat-inset-top (top) and
// --mat-inset (right/bottom/left). The clip-path polygon() uses these
// percentages so "50% across" is always the true middle and corners are
// undistorted at every window shape.
//
// Drift is in px so the breathing amount is visually even regardless of
// aspect ratio (a horizontal % is more pixels than a vertical % on wide windows).
//
// Vertex order is clockwise from upper-left — this is the polygon draw order.
// Each vertex carries its base {x, y} in % and an optional drift radius in px.
// Omitting drift falls back to defaultDrift below.

export interface OctagonVertex {
  x: number; // % of mat box width (0–100)
  y: number; // % of mat box height (0–100)
  drift?: number; // px; overrides defaultDrift when present
}

export interface OctagonShape {
  defaultDrift: number; // px — global fallback drift radius
  defaultSpeed: number; // seconds for one full breath cycle (out + back)
  vertices: {
    upperLeft: OctagonVertex;
    upperCenter: OctagonVertex;
    upperRight: OctagonVertex;
    centerRight: OctagonVertex;
    lowerRight: OctagonVertex;
    lowerCenter: OctagonVertex;
    lowerLeft: OctagonVertex;
    centerLeft: OctagonVertex;
  };
}

export const octagonShape: OctagonShape = {
  defaultDrift: 15, // px
  defaultSpeed: 5.5, // seconds

  vertices: {
    //                      x     y    drift (optional, px)
    upperLeft: { x: 0, y: 0 },
    upperCenter: { x: 50, y: 1, drift: 14 }, // top edge bows inward
    upperRight: { x: 100, y: 0 },
    centerRight: { x: 100, y: 50 },
    lowerRight: { x: 100, y: 100 },
    lowerCenter: { x: 50, y: 100, drift: 14 }, // bottom edge bows inward
    lowerLeft: { x: 0, y: 100 },
    centerLeft: { x: 1, y: 50 },
  },
};

// ─── Scroll ───────────────────────────────────────────────────────────────────

export const motion = {
  scroll: {
    flyUp: {
      ease: "power2.in",
      distance: 110, // vh — how far the paper travels off-screen
      duration: 1, // scroll-progress units (0–1)
    },
  },
};
