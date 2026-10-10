export const SLOT_HINTS = ["helmet", "chestplate", "leggings", "boots", "shield"] as const;

export type SlotHint = (typeof SLOT_HINTS)[number];
export type SlotHintMap = Record<number, SlotHint>;

export function parseSlotHints(value: string | undefined): SlotHintMap {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const hints: SlotHintMap = {};
    for (const [key, hint] of Object.entries(parsed)) {
      const index = Number.parseInt(key, 10);
      if (Number.isInteger(index) && index >= 0 && SLOT_HINTS.includes(hint as SlotHint)) {
        hints[index] = hint as SlotHint;
      }
    }
    return hints;
  } catch {
    return {};
  }
}

export function serializeSlotHints(hints: SlotHintMap): string {
  return JSON.stringify(hints);
}

export function slotHintTextureName(hint: SlotHint): string {
  return `mc_slot_hint_${hint}.png`;
}
