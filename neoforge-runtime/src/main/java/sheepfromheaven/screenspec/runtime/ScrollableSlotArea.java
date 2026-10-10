package sheepfromheaven.screenspec.runtime;

import net.minecraft.core.NonNullList;
import net.minecraft.world.Container;
import net.minecraft.world.inventory.Slot;

/**
 * Scroll state for one {@link SlotAreaSpec} bound to a runtime-sized {@link Container} - built via
 * {@link SpecSlots#forScrollableViewport}, whose row/column count is derived from {@code
 * container.getContainerSize()} rather than anything the designer authored, since the real
 * inventory (a custom block's container, sized however that mod likes) is only known once the mod
 * actually hooks it up. It scrolls whenever that turns out to be more lines - rows, or columns
 * when {@link SlotAreaSpec#axis} is {@code "x"} - than the viewport can show at once.
 *
 * <p>{@link Slot#x} and {@link Slot#y} are {@code final} in vanilla, so a scroll can't reposition
 * existing {@link Slot}s - instead this replaces the area's entries in the owning
 * {@code AbstractContainerMenu#slots} list with fresh {@link Slot}s pointing at whichever
 * container indices are now in view. The list index (and therefore the slot's network id) never
 * changes, only which item it displays, so this stays transparent to menu synchronization.
 *
 * <p>The mod's {@code AbstractContainerMenu} subclass owns one of these per scrollable area,
 * built right after adding that area's initial (scroll line 0) slots:
 *
 * <pre>{@code
 * public class MyMenu extends AbstractContainerMenu implements ScrollableAreaHost {
 *     private final Map<String, ScrollableSlotArea> scrollableAreas = new HashMap<>();
 *
 *     public MyMenu(..., ScreenSpec spec, Container input) {
 *         super(...);
 *         SlotAreaSpec area = spec.container.area("input");
 *         int firstIndex = this.slots.size();
 *         SpecSlots.forScrollableViewport(area, input).forEach(this::addSlot);
 *         scrollableAreas.put(area.id, new ScrollableSlotArea(area, input, this.slots, firstIndex));
 *     }
 *
 *     @Override
 *     public Map<String, ScrollableSlotArea> scrollableAreas() {
 *         return scrollableAreas;
 *     }
 *
 *     @Override
 *     public boolean clickMenuButton(Player player, int id) {
 *         return SpecScroll.handleClickMenuButton(spec.container, scrollableAreas, id);
 *     }
 * }
 * }</pre>
 */
public final class ScrollableSlotArea {
    /** Off-screen so it's neither visible nor reachable by the mouse - see reposition(). */
    public static final int OFFSCREEN = -100_000;

    private final SlotAreaSpec area;
    private final Container container;
    private final NonNullList<Slot> menuSlots;
    private final int firstIndex;
    private final boolean horizontal;
    private final int totalLines;
    private final int visibleLines;
    private int scrollLine = 0;

    public ScrollableSlotArea(SlotAreaSpec area, Container container, NonNullList<Slot> menuSlots, int firstIndex) {
        this.area = area;
        this.container = container;
        this.menuSlots = menuSlots;
        this.firstIndex = firstIndex;
        this.horizontal = "x".equals(area.axis);
        int size = container.getContainerSize();
        if (horizontal) {
            this.totalLines = area.totalCols(size);
            this.visibleLines = Math.min(area.cols, totalLines);
        } else {
            this.totalLines = area.totalRows(size);
            this.visibleLines = Math.min(area.viewport_rows, totalLines);
        }
    }

    public SlotAreaSpec area() {
        return area;
    }

    /** Whether this area scrolls its columns (a wide grid) rather than its rows (the default). */
    public boolean horizontal() {
        return horizontal;
    }

    /** The topmost (or, if {@link #horizontal()}, leftmost) data line currently visible. */
    public int scrollRow() {
        return scrollLine;
    }

    /** The real container's line count along the scrolling axis, derived from its actual size - not anything authored. */
    public int totalRows() {
        return totalLines;
    }

    /** Rows actually shown at once. */
    public int visibleRows() {
        return horizontal ? area.viewport_rows : visibleLines;
    }

    /** Columns actually shown at once. */
    public int visibleCols() {
        return horizontal ? visibleLines : area.cols;
    }

    public int maxScrollRow() {
        return Math.max(0, totalLines - visibleLines);
    }

    /** Whether the real container turned out bigger than the viewport - i.e. whether this needs a scrollbar at all. */
    public boolean scrollable() {
        return maxScrollRow() > 0;
    }

    /** Current scroll position as a 0..1 fraction of {@link #maxScrollRow()} (0 if there's no travel). */
    public double scrollPct() {
        int max = maxScrollRow();
        return max == 0 ? 0 : (double) scrollLine / max;
    }

    /** Scrolls to an absolute data line, clamped to {@code [0, maxScrollRow()]}. */
    public void setScrollRow(int line) {
        int clamped = Math.max(0, Math.min(maxScrollRow(), line));
        if (clamped == scrollLine) {
            return;
        }
        scrollLine = clamped;
        reposition();
    }

    /** Scrolls to the line nearest {@code pct * maxScrollRow()}, matching the designer's snapping. */
    public void setScrollPct(double pct) {
        setScrollRow((int) Math.round(clamp(pct, 0, 1) * maxScrollRow()));
    }

    public void scrollBy(int deltaLines) {
        setScrollRow(scrollLine + deltaLines);
    }

    private void reposition() {
        int size = container.getContainerSize();
        int fixedLines = horizontal ? area.viewport_rows : area.cols;
        for (int viewLine = 0; viewLine < visibleLines; viewLine++) {
            for (int fixed = 0; fixed < fixedLines; fixed++) {
                int col, row, dataIndex, slotListIndex;
                if (horizontal) {
                    col = viewLine;
                    row = fixed;
                    dataIndex = row * totalLines + (scrollLine + viewLine);
                    slotListIndex = firstIndex + row * visibleLines + viewLine;
                } else {
                    row = viewLine;
                    col = fixed;
                    dataIndex = (scrollLine + viewLine) * fixedLines + col;
                    slotListIndex = firstIndex + viewLine * fixedLines + col;
                }
                menuSlots.set(slotListIndex, slotFor(dataIndex, col, row, size));
            }
        }
    }

    /** A slot for {@code dataIndex}, or an inert off-screen one past the container's real size (e.g. a partial last line). */
    private Slot slotFor(int dataIndex, int col, int row, int size) {
        if (dataIndex < size) {
            return SpecSlots.createSlot(area, container, dataIndex, col, row);
        }
        return new Slot(container, Math.max(0, size - 1), OFFSCREEN, OFFSCREEN);
    }

    private static double clamp(double v, double lo, double hi) {
        return Math.max(lo, Math.min(hi, v));
    }
}
