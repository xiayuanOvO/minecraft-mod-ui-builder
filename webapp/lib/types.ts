export interface WidgetSpec {
  id: string;
  type: string;
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  icon: string | null;
  action?: string;
  bindings?: Record<string, string>;
  props: Record<string, string>;
  item_template?: WidgetSpec[];
  parentId?: string;
  hidden?: boolean;
}

export interface SlotAreaSpec {
  id: string;
  x: number;
  y: number;
  cols: number;
  slot_size: number;
  /**
   * Rows visible at once. The real total row count isn't known here — it's determined at
   * runtime by whatever inventory the mod actually binds (see neoforge-runtime's
   * ScrollableSlotArea), so it scrolls vertically whenever that turns out to be more rows
   * than fit in this viewport.
   */
  viewport_rows: number;
  source?: "player" | "player_hotbar" | null;
  /**
   * Which dimension scrolls: "y" (default, vertical — rows overflow past viewport_rows) or "x"
   * (horizontal — columns overflow past `cols` instead, with viewport_rows as the fixed row
   * count). See neoforge-runtime's ScrollableSlotArea. Not yet exposed in the designer UI — set by
   * hand-editing exported JSON, or by mod code building a ScreenSpec programmatically.
   */
  axis?: "x" | "y";
  /** Vanilla empty-slot hint sprites keyed by row-major visible cell index. */
  slot_hints?: Record<number, "helmet" | "chestplate" | "leggings" | "boots" | "shield">;
}

export interface ContainerSpec {
  slots: SlotAreaSpec[];
}

export type BindingType = "string" | "number" | "boolean";

export interface BindingNode {
  type?: BindingType;
  previewValue?: string | number | boolean;
  children?: Record<string, BindingNode>;
}

export type BindingsSchema = Record<string, BindingNode>;

export interface ScreenSpec {
  id: string;
  modId?: string;
  width: number;
  height: number;
  widgets: WidgetSpec[];
  container?: ContainerSpec | null;
  bindingsSchema?: BindingsSchema;
  actions?: string[];
  /** Webapp version that produced this exported JSON — used to pick migrations on import. See webapp/lib/migrations.ts. */
  appVersion?: string;
}
