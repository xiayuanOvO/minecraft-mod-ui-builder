package sheepfromheaven.screenspec.runtime;

import net.minecraft.world.Container;
import net.minecraft.world.entity.player.Inventory;
import net.minecraft.world.inventory.Slot;
import net.minecraft.resources.Identifier;

import java.util.ArrayList;
import java.util.List;

/**
 * Builds vanilla {@link Slot}s at the coordinates a {@link SlotAreaSpec} describes, so the same
 * layout drives both the server-side {@code AbstractContainerMenu} a mod writes and the rendering
 * {@link SpecContainerScreen} does for it - the mod never hand-computes slot positions.
 *
 * <pre>{@code
 * public class MyMenu extends AbstractContainerMenu {
 *     public MyMenu(MenuType<?> type, int containerId, ScreenSpec spec, Inventory playerInv, Container input) {
 *         super(type, containerId);
 *         SpecSlots.forArea(spec.container.area("input"), input).forEach(this::addSlot);
 *         SpecSlots.forPlayerInventory(spec.container.area("player_inv"), playerInv).forEach(this::addSlot);
 *         SpecSlots.forPlayerHotbar(spec.container.area("player_hotbar"), playerInv).forEach(this::addSlot);
 *     }
 *     ...
 * }
 * }</pre>
 */
public final class SpecSlots {
    private SpecSlots() {}

    /**
     * One slot per cell, in row-major order, for a fixed-size area (a crafting grid, an output
     * slot) where {@code area.viewport_rows} is trusted as the true row count - it never scrolls.
     * For an area whose real size is only known once the mod binds a runtime-sized {@code
     * Container} (see {@link ScrollableSlotArea}), use {@link #forScrollableViewport} instead.
     */
    public static List<Slot> forArea(SlotAreaSpec area, Container container) {
        int capacity = Math.min(container.getContainerSize(), area.cols * area.viewport_rows);
        List<Slot> slots = new ArrayList<>(capacity);
        for (int i = 0; i < capacity; i++) {
            int col = i % area.cols;
            int row = i / area.cols;
            slots.add(createSlot(area, container, i, col, row));
        }
        return slots;
    }

    /** The player's main inventory (indices 9-35), laid out over {@code area.cols} columns. */
    public static List<Slot> forPlayerInventory(SlotAreaSpec area, Inventory playerInventory) {
        int rows = area.totalRows(27);
        List<Slot> slots = new ArrayList<>(area.cols * rows);
        for (int row = 0; row < rows; row++) {
            for (int col = 0; col < area.cols; col++) {
                int index = 9 + col + row * area.cols;
                slots.add(createSlot(area, playerInventory, index, col, row));
            }
        }
        return slots;
    }

    /** The player's hotbar (indices 0-8), laid out over {@code area.cols} columns on a single row. */
    public static List<Slot> forPlayerHotbar(SlotAreaSpec area, Inventory playerInventory) {
        List<Slot> slots = new ArrayList<>(area.cols);
        for (int col = 0; col < area.cols; col++) {
            slots.add(createSlot(area, playerInventory, col, col, 0));
        }
        return slots;
    }

    /**
     * One slot per cell of {@code area}'s initial (scroll line 0) viewport, for an area bound to a
     * runtime-sized {@code Container} - its true row (or, if {@code area.axis} is {@code "x"},
     * column) count comes from {@code container.getContainerSize()}, not anything authored, since
     * the real inventory (a custom block's, sized however that mod likes) is only known once the
     * mod hooks it up. Wrap the result in a {@link ScrollableSlotArea} after adding it to the menu;
     * see that class's javadoc for the full pattern.
     */
    public static List<Slot> forScrollableViewport(SlotAreaSpec area, Container container) {
        int size = container.getContainerSize();
        if ("x".equals(area.axis)) {
            int totalCols = area.totalCols(size);
            int visibleCols = Math.min(area.cols, totalCols);
            int rows = area.viewport_rows;
            List<Slot> slots = new ArrayList<>(visibleCols * rows);
            for (int row = 0; row < rows; row++) {
                for (int viewCol = 0; viewCol < visibleCols; viewCol++) {
                    int dataIndex = row * totalCols + viewCol;
                    if (dataIndex < size) {
                        slots.add(createSlot(area, container, dataIndex, viewCol, row));
                    } else {
                        // partial last column (or an empty container) - an inert off-screen slot keeps the viewport's slot count fixed
                        slots.add(new Slot(container, Math.max(0, size - 1), ScrollableSlotArea.OFFSCREEN, ScrollableSlotArea.OFFSCREEN));
                    }
                }
            }
            return slots;
        }
        int cols = area.cols;
        int visibleRows = Math.min(area.viewport_rows, area.totalRows(size));
        List<Slot> slots = new ArrayList<>(cols * visibleRows);
        for (int viewRow = 0; viewRow < visibleRows; viewRow++) {
            for (int col = 0; col < cols; col++) {
                int dataIndex = viewRow * cols + col;
                if (dataIndex < size) {
                    slots.add(createSlot(area, container, dataIndex, col, viewRow));
                } else {
                    // partial last row (or an empty container) - an inert off-screen slot keeps the viewport's slot count fixed
                    slots.add(new Slot(container, Math.max(0, size - 1), ScrollableSlotArea.OFFSCREEN, ScrollableSlotArea.OFFSCREEN));
                }
            }
        }
        return slots;
    }

    static Slot createSlot(SlotAreaSpec area, Container container, int containerIndex, int col, int row) {
        return slotWithBackground(container, containerIndex, area.slotX(col), area.slotY(row), area.slotHint(col, row));
    }

    static Slot slotWithBackground(Container container, int containerIndex, int x, int y, Identifier background) {
        if (background == null) return new Slot(container, containerIndex, x, y);
        return new Slot(container, containerIndex, x, y) {
            @Override
            public Identifier getNoItemIcon() {
                return background;
            }
        };
    }
}
