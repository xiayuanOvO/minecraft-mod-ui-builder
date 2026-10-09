"use client";

import type { VisualProps } from "../shared";

/** Empty framed viewport matching the player preview area in the survival inventory. */
export default function PlayerPreviewVisual(_props: VisualProps) {
  return (
    <div
      aria-hidden="true"
      className="h-full w-full"
      style={{
        boxSizing: "border-box",
          background: "#000",
          borderStyle: "solid",
          borderWidth: 1,
          borderColor: "#373737 #fff #fff #373737",
        }}
    />
  );
}
