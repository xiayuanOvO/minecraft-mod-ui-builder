"use client";

const SNAP_GUIDE_COLOR = "#ff2fd6";
const SIBLING_GUIDE_COLOR = "#2fd6ff";

// A sibling alignment line: a vertical ("v", constant x) or horizontal ("h",
// constant y) line, drawn only across the span between the dragged widget and
// the sibling it aligned to (not the full container, unlike the center lines).
export type AlignmentLine = { axis: "v" | "h"; pos: number; from: number; to: number };

export type DragGuidesInfo = {
  // Which container's coordinate space these guides are drawn in — the id of the
  // dragged widget's parent, or null for a root widget (drawn over the canvas itself).
  parentId: string | null;
  containerW: number;
  containerH: number;
  vCenter: boolean;
  hCenter: boolean;
  shiftAxis: "horizontal" | "vertical" | null;
  shiftX: number;
  shiftY: number;
  siblingLines: AlignmentLine[];
};

// Renders alignment guide lines over a container's content area (root canvas or
// a widget's own children box) — a center-snap line per axis, sibling edge/center
// alignment lines, plus the shift-lock axis line, all in that container's own
// coordinate space so no offset math is needed.
export function GuideLines({ containerW, containerH, vCenter, hCenter, shiftAxis, shiftX, shiftY, siblingLines }: DragGuidesInfo) {
  return (
    <div data-export-ignore style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 1000 }}>
      {vCenter && (
        <div style={{ position: "absolute", left: containerW / 2, top: 0, width: 1, height: containerH, background: SNAP_GUIDE_COLOR }} />
      )}
      {hCenter && (
        <div style={{ position: "absolute", top: containerH / 2, left: 0, height: 1, width: containerW, background: SNAP_GUIDE_COLOR }} />
      )}
      {shiftAxis === "horizontal" && (
        <div style={{ position: "absolute", top: shiftY, left: 0, height: 1, width: containerW, background: SNAP_GUIDE_COLOR, opacity: 0.6 }} />
      )}
      {shiftAxis === "vertical" && (
        <div style={{ position: "absolute", left: shiftX, top: 0, width: 1, height: containerH, background: SNAP_GUIDE_COLOR, opacity: 0.6 }} />
      )}
      {siblingLines.map((line, i) => line.axis === "v" ? (
        <div key={i} style={{ position: "absolute", left: line.pos, top: line.from, width: 1, height: line.to - line.from, background: SIBLING_GUIDE_COLOR }} />
      ) : (
        <div key={i} style={{ position: "absolute", top: line.pos, left: line.from, height: 1, width: line.to - line.from, background: SIBLING_GUIDE_COLOR }} />
      ))}
    </div>
  );
}
