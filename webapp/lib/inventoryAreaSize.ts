import type { WidgetSpec } from "./types";

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/** Inventory areas always occupy exactly one slot-sized cell per column/row. */
export function getInventoryAreaMetrics(props: WidgetSpec["props"]) {
  const cols = positiveInt(props.cols, 9);
  const rows = positiveInt(props.rows, 3);
  const slotSize = positiveInt(props.slot_size, 18);
  return { cols, rows, slotSize, w: cols * slotSize, h: rows * slotSize };
}

export function getInventoryAreaSize(props: WidgetSpec["props"]): { w: number; h: number } {
  const { w, h } = getInventoryAreaMetrics(props);
  return { w, h };
}

/** Keeps legacy/imported inventory_area dimensions in sync with their grid props. */
export function normalizeInventoryAreaSize(widget: WidgetSpec): WidgetSpec {
  if (widget.type !== "inventory_area") return widget;
  const metrics = getInventoryAreaMetrics(widget.props);
  return {
    ...widget,
    props: {
      ...widget.props,
      cols: String(metrics.cols),
      rows: String(metrics.rows),
      slot_size: String(metrics.slotSize),
    },
    w: metrics.w,
    h: metrics.h,
  };
}
