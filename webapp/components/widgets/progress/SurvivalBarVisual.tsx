"use client";

import type { VisualProps } from "../shared";

type IconBarType = "health_bar" | "hunger_bar" | "armor_bar" | "air_bar";

function clampFraction(value: number, max: number) {
  return max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
}

export default function SurvivalBarVisual({ widget, packTextures }: VisualProps) {
  const value = Number.parseFloat(widget.props.value ?? "0");
  const max = Number.parseFloat(widget.props.max ?? "20");
  const fraction = clampFraction(Number.isFinite(value) ? value : 0, Number.isFinite(max) ? max : 0);

  if (widget.type === "experience_bar") {
    const background = packTextures["gui/sprites/hud/experience_bar_background.png"];
    const progress = packTextures["gui/sprites/hud/experience_bar_progress.png"];
    return (
      <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", imageRendering: "pixelated" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {background && <img src={background} alt="" draggable={false} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", imageRendering: "pixelated" }} />}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {progress && <div style={{ position: "absolute", inset: 0, width: `${fraction * 100}%`, overflow: "hidden" }}><img src={progress} alt="" draggable={false} style={{ width: widget.w, height: "100%", maxWidth: "none", imageRendering: "pixelated" }} /></div>}
      </div>
    );
  }

  const type = widget.type as IconBarType;
  const safeMax = Number.isFinite(max) && max > 0 ? max : 1;
  const count = type === "air_bar"
    ? Math.max(1, Math.min(20, Number.parseInt(widget.props.count ?? "10", 10) || 10))
    : Math.max(1, Math.min(20, Math.ceil(safeMax / 2)));
  const prefix = "gui/sprites/hud/";
  const sprites = type === "health_bar"
    ? { empty: "heart/container.png", full: "heart/full.png", half: "heart/half.png" }
    : type === "hunger_bar"
      ? { empty: "food_empty.png", full: "food_full.png", half: "food_half.png" }
      : type === "armor_bar"
        ? { empty: "armor_empty.png", full: "armor_full.png", half: "armor_half.png" }
        : { empty: "air_empty.png", full: "air.png", half: "air.png" };
  const step = widget.w / count;
  const iconSize = Math.max(1, Math.min(9, step, widget.h));
  const top = (widget.h - iconSize) / 2;

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", imageRendering: "pixelated" }}>
      {Array.from({ length: count }, (_, index) => {
        const points = type === "air_bar" ? (safeMax / count) : 2;
        const remaining = value - index * points;
        const fill: "full" | "half" | "empty" = type === "air_bar"
          ? remaining >= points ? "full" : "empty"
          : remaining >= 2 ? "full" : remaining >= 1 ? "half" : "empty";
        return (
          <span key={index} style={{ position: "absolute", left: index * step, top, width: iconSize, height: iconSize }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {packTextures[prefix + sprites.empty] && <img src={packTextures[prefix + sprites.empty]} alt="" draggable={false} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", imageRendering: "pixelated" }} />}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {fill !== "empty" && packTextures[prefix + sprites[fill]] && <img src={packTextures[prefix + sprites[fill]]} alt="" draggable={false} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", imageRendering: "pixelated" }} />}
          </span>
        );
      })}
    </div>
  );
}
