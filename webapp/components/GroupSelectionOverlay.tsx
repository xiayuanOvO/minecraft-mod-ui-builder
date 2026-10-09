"use client";

import type { WidgetSpec } from "@/lib/types";
import { SELECTION_OUTLINE } from "@/lib/selectionStyle";

// Live per-axis offset applied to every widget in `ids` while a multi-selection
// is being dragged as a group — mirrors the single-widget `draggingPos` state,
// but as one shared delta for many widgets instead of one absolute position.
export type GroupDragInfo = { ids: string[]; dx: number; dy: number };

// Draws a single bounding-box outline around a multi-selected group, with no
// resize handles — individual widgets suppress their own outline/handles
// while part of a group (see `isSelected` in EditWidget), so this is the only
// selection indicator shown. Takes the widget list already scoped to one
// container (root siblings, or one parent's children) since group members are
// always siblings under the same parent.
export function GroupSelectionOverlay({ widgets, selectedIds, groupDrag }: {
  widgets: WidgetSpec[];
  selectedIds: string[];
  groupDrag: GroupDragInfo | null;
}) {
  const members = widgets.filter(w => selectedIds.includes(w.id));
  if (members.length < 2) return null;
  const pos = (w: WidgetSpec) => groupDrag?.ids.includes(w.id) ? { x: w.x + groupDrag.dx, y: w.y + groupDrag.dy } : { x: w.x, y: w.y };
  const left = Math.min(...members.map(w => pos(w).x));
  const top = Math.min(...members.map(w => pos(w).y));
  const right = Math.max(...members.map(w => pos(w).x + w.w));
  const bottom = Math.max(...members.map(w => pos(w).y + w.h));
  return (
    <div data-export-ignore style={{
      position: "absolute",
      left, top,
      width: right - left,
      height: bottom - top,
      outline: SELECTION_OUTLINE,
      pointerEvents: "none",
      zIndex: 900,
    }} />
  );
}
