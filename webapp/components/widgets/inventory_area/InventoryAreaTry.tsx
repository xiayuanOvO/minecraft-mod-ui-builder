"use client";

import { useState, useCallback, useContext } from "react";
import React from "react";
import type { WidgetSpec } from "@/lib/types";
import { getInventoryAreaMetrics } from "@/lib/inventoryAreaSize";
import { parseSlotHints, slotHintTextureName } from "@/lib/slotHints";
import { TextureCtx, ScrollCtx, type ScrollPos } from "../tryContext";

/** Try-mode's scrollable inventory area — wheel scroll, built-in thumb drag, or driven by an external scrollbar widget. */
export function InventoryAreaTry({ widget, scale, zBase, externalScrollbarIdY, externalScrollbarIdX }: {
  widget: WidgetSpec;
  scale: number;
  zBase: number;
  externalScrollbarIdY?: string;
  externalScrollbarIdX?: string;
}) {
  const { textures } = useContext(TextureCtx);
  const tex = (name: string) => (textures as Record<string, string>)[name];
  const scrollCtx = useContext(ScrollCtx);

  const { cols, rows, slotSize, w: fullW, h: fullH } = getInventoryAreaMetrics(widget.props);
  const slotHints = parseSlotHints(widget.props.slot_hints);
  // The viewport is defined by cols × rows, with one slot_size per cell.
  const viewW = fullW;
  const viewH = fullH;

  const maxScrollLeft = Math.max(0, fullW - viewW);
  const maxScrollTop  = Math.max(0, fullH - viewH);

  // Re-render when an external scrollbar's pct changes
  const [, forceRender] = useState(0);
  React.useEffect(() => {
    const ctx = scrollCtx as unknown as { _listeners?: Map<string, Set<() => void>> };
    if (!ctx._listeners) ctx._listeners = new Map();
    const fn = () => forceRender(n => n + 1);
    const ids = [externalScrollbarIdY, externalScrollbarIdX].filter(Boolean) as string[];
    ids.forEach(id => {
      const set = ctx._listeners!.get(id) ?? new Set<() => void>();
      set.add(fn);
      ctx._listeners!.set(id, set);
    });
    return () => { ids.forEach(id => ctx._listeners?.get(id)?.delete(fn)); };
  }, [externalScrollbarIdY, externalScrollbarIdX, scrollCtx]);

  // External scrollbar pct → snap to whole rows/cols
  // scrollableRows = rows that can scroll out of view before the last row hits the bottom
  const scrollableRows = Math.max(0, rows - Math.floor(viewH / slotSize));
  const scrollableCols = Math.max(0, cols - Math.floor(viewW / slotSize));
  const extPctY = externalScrollbarIdY ? (scrollCtx.getScroll(externalScrollbarIdY).y ?? 0) : null;
  const extPctX = externalScrollbarIdX ? (scrollCtx.getScroll(externalScrollbarIdX).x ?? 0) : null;

  const clipsH = maxScrollTop  > 0;
  const clipsW = maxScrollLeft > 0;
  const showBuiltinY = clipsH && !externalScrollbarIdY;
  const showBuiltinX = clipsW && !externalScrollbarIdX;

  const barW = 4;
  const innerViewW = showBuiltinY ? viewW - barW : viewW;
  const innerViewH = showBuiltinX ? viewH - barW : viewH;

  // Internal scroll state (wheel / built-in thumb)
  const [pos, setPos] = useState<ScrollPos>({ x: 0, y: 0 });

  // Final scroll: external scrollbar pct snaps to whole row/col; internal state used otherwise
  const scrollY = extPctY !== null
    ? Math.round(extPctY * scrollableRows) * slotSize
    : pos.y;
  const scrollX = extPctX !== null
    ? Math.round(extPctX * scrollableCols) * slotSize
    : pos.x;

  const setScroll = useCallback((next: ScrollPos) => {
    setPos(next);
  }, []);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setPos(prev => ({
      x: Math.max(0, Math.min(maxScrollLeft, prev.x + (e.deltaX || (!clipsH ? e.deltaY : 0)))),
      y: Math.max(0, Math.min(maxScrollTop,  prev.y + (clipsH ? e.deltaY : 0))),
    }));
  };

  // Built-in scrollbar thumb drag
  const [thumbDrag, setThumbDrag] = useState<{ axis: "v"|"h"; startClient: number; startScroll: number } | null>(null);
  const thumbHRatio = Math.min(1, innerViewH / fullH);
  const thumbWRatio = Math.min(1, innerViewW / fullW);
  const thumbH      = Math.max(barW * 2, innerViewH * thumbHRatio);
  const thumbW      = Math.max(barW * 2, innerViewW * thumbWRatio);
  const thumbTop    = maxScrollTop  > 0 ? (scrollY / maxScrollTop)  * (innerViewH - thumbH) : 0;
  const thumbLeft   = maxScrollLeft > 0 ? (scrollX / maxScrollLeft) * (innerViewW - thumbW) : 0;

  const onThumbPointerMove = (e: React.PointerEvent) => {
    if (!thumbDrag) return;
    if (thumbDrag.axis === "v") {
      // e.clientY is CSS px; innerViewH - thumbH is MC px — divide client delta by scale
      const delta = (e.clientY - thumbDrag.startClient) / scale / (innerViewH - thumbH) * maxScrollTop;
      setScroll({ ...pos, y: Math.max(0, Math.min(maxScrollTop, thumbDrag.startScroll + delta)) });
    } else {
      const delta = (e.clientX - thumbDrag.startClient) / scale / (innerViewW - thumbW) * maxScrollLeft;
      setScroll({ ...pos, x: Math.max(0, Math.min(maxScrollLeft, thumbDrag.startScroll + delta)) });
    }
  };

  return (
    <div
      style={{ position: "absolute", left: widget.x, top: widget.y, width: viewW, height: viewH, zIndex: zBase }}
      onWheel={handleWheel}
      onPointerMove={thumbDrag ? onThumbPointerMove : undefined}
      onPointerUp={() => setThumbDrag(null)}
    >
      <div style={{ position: "absolute", top: 0, left: 0, width: innerViewW, height: innerViewH, overflow: "hidden", boxSizing: "border-box" }}>
        <div style={{
          position: "absolute",
          top: -scrollY, left: -scrollX,
          width: fullW, height: fullH,
          backgroundImage: `url("${tex("mc_slot_tile.png")}")`,
          backgroundSize: `${slotSize}px ${slotSize}px`,
          backgroundRepeat: "repeat",
          imageRendering: "pixelated",
          boxSizing: "border-box",
        }}>
          {Object.entries(slotHints).map(([rawIndex, hint]) => {
            const index = Number(rawIndex);
            if (index >= cols * rows) return null;
            const hintTexture = tex(slotHintTextureName(hint));
            if (!hintTexture) return null;
            const hintSize = Math.max(1, Math.min(16, slotSize - 2));
            return (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={rawIndex}
                src={hintTexture}
                alt=""
                draggable={false}
                style={{
                  position: "absolute",
                  left: (index % cols) * slotSize + (slotSize - hintSize) / 2,
                  top: Math.floor(index / cols) * slotSize + (slotSize - hintSize) / 2,
                  width: hintSize,
                  height: hintSize,
                  imageRendering: "pixelated",
                  pointerEvents: "none",
                }}
              />
            );
          })}
        </div>
      </div>

      {showBuiltinY && (
        <div style={{ position: "absolute", top: 0, right: 0, width: barW, height: innerViewH, background: "#1a1a1a", borderLeft: `1px solid #444` }}>
          <div style={{ position: "absolute", top: thumbTop, width: "100%", height: thumbH, background: "#555", cursor: "pointer" }}
            onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); setThumbDrag({ axis: "v", startClient: e.clientY, startScroll: pos.y }); }} />
        </div>
      )}
      {showBuiltinX && (
        <div style={{ position: "absolute", bottom: 0, left: 0, width: innerViewW, height: barW, background: "#1a1a1a", borderTop: `1px solid #444` }}>
          <div style={{ position: "absolute", left: thumbLeft, height: "100%", width: thumbW, background: "#555", cursor: "pointer" }}
            onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); setThumbDrag({ axis: "h", startClient: e.clientX, startScroll: pos.x }); }} />
        </div>
      )}
    </div>
  );
}
