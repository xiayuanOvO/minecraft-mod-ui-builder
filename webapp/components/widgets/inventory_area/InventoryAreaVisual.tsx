"use client";

import type { VisualProps } from "../shared";
import { parseSlotHints, slotHintTextureName } from "@/lib/slotHints";

export default function InventoryAreaVisual({ widget, tex }: VisualProps) {
  const cols = parseInt(widget.props.cols ?? "9", 10);
  const rows = parseInt(widget.props.rows ?? "3", 10);
  const slotSize = parseInt(widget.props.slot_size ?? "18", 10);
  const fullW = cols * slotSize;
  const fullH = rows * slotSize;
  const source = widget.props.source ?? "";
  const slotHints = parseSlotHints(widget.props.slot_hints);
  const label = source === "player" ? "player inv" : source === "player_hotbar" ? "hotbar" : `${cols}×${rows}`;
  const clippedH = widget.h < fullH - 1;
  const clippedW = widget.w < fullW - 1;
  return (
    <div style={{
      width: "100%", height: "100%",
      boxSizing: "border-box",
      overflow: "hidden",
      position: "relative",
    }}>
      {/* Full-size slot grid — clipped by the viewport when smaller than cols×rows */}
      <div style={{
        position: "relative",
        width: fullW,
        height: fullH,
        backgroundImage: `url("${tex("mc_slot_tile.png")}")`,
        backgroundSize: `${slotSize}px ${slotSize}px`,
        backgroundRepeat: "repeat",
        imageRendering: "pixelated",
        flexShrink: 0,
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
      {/* Scroll hint when the viewport clips the grid */}
      {(clippedW || clippedH) && (
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(to bottom right, transparent 60%, rgba(0,0,0,0.7) 100%)",
          pointerEvents: "none",
        }} data-export-ignore />
      )}
      <span style={{
        position: "absolute", bottom: 2, right: 3,
        fontSize: 6,
        fontFamily: '"Minecraft", monospace',
        color: "#ffffff",
        userSelect: "none",
        pointerEvents: "none",
        textShadow: `0 0 2px #000, 0 0 1px #000`,
      }} data-export-ignore>
        {label}{(clippedW || clippedH) ? " ↕" : ""}
      </span>
    </div>
  );
}
