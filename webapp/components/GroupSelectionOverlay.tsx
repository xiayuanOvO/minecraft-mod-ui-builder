"use client";

import { useLayoutEffect, useState } from "react";
import type React from "react";
import { SELECTION_OUTLINE } from "@/lib/selectionStyle";

type Bounds = { left: number; top: number; width: number; height: number };
export type GroupDragInfo = { ids: string[]; dx: number; dy: number };

// Measures the rendered widget elements so the group outline uses the same
// coordinate space and dimensions the user actually sees. This handles nested
// parents and widgets whose displayed size is derived from their properties.
export function GroupSelectionOverlay({ canvasRef, selectedIds, scale, groupDrag }: {
  canvasRef: React.RefObject<HTMLDivElement | null>;
  selectedIds: string[];
  scale: number;
  groupDrag: GroupDragInfo | null;
}) {
  const [bounds, setBounds] = useState<Bounds | null>(null);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || selectedIds.length < 2 || scale <= 0) {
      setBounds(null);
      return;
    }

    const selected = new Set(selectedIds);
    const rects = Array.from(canvas.querySelectorAll<HTMLElement>("[data-widget-id]"))
      .filter((element) => selected.has(element.dataset.widgetId ?? ""))
      .map((element) => element.getBoundingClientRect());
    if (rects.length === 0) {
      setBounds(null);
      return;
    }

    const canvasRect = canvas.getBoundingClientRect();
    const left = Math.min(...rects.map((rect) => rect.left));
    const top = Math.min(...rects.map((rect) => rect.top));
    const right = Math.max(...rects.map((rect) => rect.right));
    const bottom = Math.max(...rects.map((rect) => rect.bottom));
    const next = {
      left: (left - canvasRect.left) / scale,
      top: (top - canvasRect.top) / scale,
      width: (right - left) / scale,
      height: (bottom - top) / scale,
    };
    setBounds((previous) => previous
      && previous.left === next.left
      && previous.top === next.top
      && previous.width === next.width
      && previous.height === next.height
      ? previous
      : next);
  }, [canvasRef, selectedIds, scale, groupDrag]);

  if (!bounds) return null;
  return (
    <div data-export-ignore style={{
      position: "absolute",
      ...bounds,
      outline: SELECTION_OUTLINE,
      pointerEvents: "none",
      zIndex: 900,
    }} />
  );
}
