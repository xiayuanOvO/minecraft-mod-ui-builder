package sheepfromheaven.screenspec.runtime;

import net.minecraft.resources.Identifier;

import java.util.Map;

/**
 * One rectangular grid of inventory slots within a {@link ContainerSpec}, exported by the MC Screen
 * Designer web tool (see {@code lib/types.ts}). Field names and JSON shape must stay in sync with
 * that file.
 *
 * <p>{@code source} is {@code null} for a mod-provided container (looked up by {@code id} - see
 * {@link SpecSlots#forArea}), or one of the reserved ids {@code "player"} / {@code "player_hotbar"}
 * (see {@link SpecSlots#forPlayerInventory} / {@link SpecSlots#forPlayerHotbar}).
 *
 * <p>There's deliberately no {@code rows} field: the designer can't know the true size of
 * whatever inventory a mod ends up binding at runtime (a custom block's container, sized however
 * that mod likes) - only {@code viewport_rows}, how many rows of it are visible at once, is a
 * layout decision the designer actually controls. For a fixed-size area (crafting grids, the
 * player's own inventory) built via {@link SpecSlots#forArea}, {@code viewport_rows} doubles as
 * the true row count. For a runtime-sized area built via {@link SpecSlots#forScrollableViewport},
 * the true row count is derived from the real {@code Container} instead - see
 * {@link ScrollableSlotArea}.
 *
 * <p>{@code axis} picks which dimension of the grid scrolls: {@code "y"} (default) means {@code
 * cols} is the fixed/true column count and rows overflow past {@code viewport_rows}; {@code "x"}
 * flips this so {@code viewport_rows} is the fixed/true row count and columns overflow past
 * {@code cols} instead - see {@link ScrollableSlotArea}.
 */
public final class SlotAreaSpec {
    public String id;
    public int x;
    public int y;
    public int cols = 1;
    public int slot_size = 18;
    public String source;
    public int viewport_rows = 1;
    public String axis = "y";
    /** Vanilla empty-slot hints keyed by row-major visible cell index. */
    public Map<Integer, String> slot_hints = Map.of();

    public Identifier slotHint(int col, int row) {
        String hint = slot_hints == null ? null : slot_hints.get(row * cols + col);
        if (hint == null) return null;
        return switch (hint) {
            case "helmet", "chestplate", "leggings", "boots", "shield" -> Identifier.withDefaultNamespace("container/slot/" + hint);
            default -> null;
        };
    }

    public int slotX(int col) {
        return x + col * slot_size + 1;
    }

    public int slotY(int row) {
        return y + row * slot_size + 1;
    }

    /** {@code ceil(itemCount / cols)}, at least 1 - the row count needed to hold itemCount items, when {@code axis == "y"}. */
    public int totalRows(int itemCount) {
        return Math.max(1, (itemCount + cols - 1) / cols);
    }

    /** {@code ceil(itemCount / viewport_rows)}, at least 1 - the column count needed to hold itemCount items, when {@code axis == "x"}. */
    public int totalCols(int itemCount) {
        return Math.max(1, (itemCount + viewport_rows - 1) / viewport_rows);
    }
}
