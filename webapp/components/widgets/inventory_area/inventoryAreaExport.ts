import type { ContainerSpec, WidgetSpec } from "@/lib/types";
import { getInventoryAreaMetrics } from "@/lib/inventoryAreaSize";
import { tabChildOrigin } from "../tabs/tabsExport";
import { parseSlotHints } from "@/lib/slotHints";

/**
 * Resolves a widget's absolute (screen-space) position by walking up its
 * parentId chain. Most widgets' x/y are already relative to their immediate
 * parent, so this is a plain sum — except a `tab` child, whose own x/y are
 * meaningless (see tabsExport.ts's tabChildOrigin).
 */
export function resolveAbsolutePos(w: WidgetSpec, byId: Map<string, WidgetSpec>): { x: number; y: number } {
  if (!w.parentId) return { x: w.x, y: w.y };
  const parent = byId.get(w.parentId);
  if (!parent) return { x: w.x, y: w.y };
  const parentOrigin = resolveAbsolutePos(parent, byId);
  if (w.type === "tab" && parent.type === "tabs") {
    return tabChildOrigin(parent, parentOrigin);
  }
  return { x: parentOrigin.x + w.x, y: parentOrigin.y + w.y };
}

/**
 * Builds the exported ScreenSpec's `container.slots` from every
 * `inventory_area` widget on the screen — the NeoForge runtime reads this to
 * know where to place real inventory slots, since inventory_area widgets
 * themselves aren't part of the exported `widgets` array (see
 * excludeFromExportedWidgets below).
 */
export function buildContainerSpec(widgets: WidgetSpec[]): ContainerSpec | undefined {
  const inventoryWidgets = widgets.filter((w) => w.type === "inventory_area");
  if (inventoryWidgets.length === 0) return undefined;

  const seen = new Set<string>();
  for (const w of inventoryWidgets) {
    if (seen.has(w.id)) {
      throw new Error(`Duplicate inventory_area id "${w.id}" — give each inventory area a unique ID before exporting.`);
    }
    seen.add(w.id);
  }

  const byId = new Map(widgets.map((w) => [w.id, w]));
  return {
    slots: inventoryWidgets.map((w) => {
      const { cols, rows, slotSize } = getInventoryAreaMetrics(w.props);
      const abs = resolveAbsolutePos(w, byId);
      const slotHints = parseSlotHints(w.props.slot_hints);
      return {
        id:            w.id,
        x:             abs.x,
        y:             abs.y,
        cols,
        slot_size:     slotSize,
        viewport_rows: rows,
        ...(w.props.source ? { source: w.props.source as "player" | "player_hotbar" } : {}),
        ...(Object.keys(slotHints).length
          ? { slot_hints: slotHints }
          : {}),
      };
    }),
  };
}

/** inventory_area widgets are represented in the exported JSON via `container.slots` instead of the regular `widgets` array. */
export function excludeFromExportedWidgets(widgets: WidgetSpec[]): WidgetSpec[] {
  return widgets.filter((w) => w.type !== "inventory_area");
}
