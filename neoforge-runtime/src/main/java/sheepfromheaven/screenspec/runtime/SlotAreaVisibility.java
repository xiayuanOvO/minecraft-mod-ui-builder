package sheepfromheaven.screenspec.runtime;

import net.minecraft.core.NonNullList;
import net.minecraft.world.inventory.Slot;

/**
 * Lets a mod's {@code AbstractContainerMenu} hide a {@link SlotAreaSpec}'s slots when the {@code tab}
 * they're nested under isn't the active one - see {@link SpecContainerScreen}'s tab handling.
 *
 * <p>Vanilla renders every {@link Slot} in {@code AbstractContainerMenu#slots} directly, independent
 * of whatever the client-side {@link SpecContainerScreen} considers "visible" - hiding a tab's own
 * labels/buttons has no effect on its inventory slots' items, which would otherwise float on top of
 * whichever tab is actually showing. The only way to truly hide a slot is what {@link
 * ScrollableSlotArea} already does for scrolled-out rows: replace its entry in the menu's slot list
 * with one moved to {@link ScrollableSlotArea#OFFSCREEN}.
 *
 * <p>Works alongside {@link ScrollableSlotArea} for the same area — both replace the same slot-list
 * range, but never at the same time. A mod'a menu constructs one of these per area (whether
 * scrollable or fixed), right after adding that area's slots:
 *
 * <pre>{@code
 * public class MyMenu extends AbstractContainerMenu implements TabAwareAreaHost {
 *     private final Map<String, SlotAreaVisibility> areaVisibility = new HashMap<>();
 *
 *     public MyMenu(..., ScreenSpec spec, Container input) {
 *         super(...);
 *         SlotAreaSpec area = spec.container.area("input");
 *         int firstIndex = this.slots.size();
 *         SpecSlots.forArea(area, input).forEach(this::addSlot);
 *         areaVisibility.put(area.id, new SlotAreaVisibility(area, this.slots, firstIndex, area.viewport_rows));
 *     }
 *
 *     @Override
 *     public void setAreaVisible(String areaId, boolean visible) {
 *         SlotAreaVisibility v = areaVisibility.get(areaId);
 *         if (v != null) v.setVisible(visible);
 *     }
 * }
 * }</pre>
 */
public final class SlotAreaVisibility {
    private final SlotAreaSpec area;
    private final NonNullList<Slot> menuSlots;
    private final int firstIndex;
    private final int rows;
    private boolean visible = true;

    public SlotAreaVisibility(SlotAreaSpec area, NonNullList<Slot> menuSlots, int firstIndex, int rows) {
        this.area = area;
        this.menuSlots = menuSlots;
        this.firstIndex = firstIndex;
        this.rows = rows;
    }

    /**
     * Shows or hides this area's slots by replacing their menu-list entries with copies moved
     * on/off {@link ScrollableSlotArea#OFFSCREEN}. Preserves whatever container/index each slot
     * currently points at (e.g. a {@link ScrollableSlotArea}'s current scroll position), only its
     * x/y changes.
     */
    public void setVisible(boolean visible) {
        if (this.visible == visible) return;
        this.visible = visible;
        for (int r = 0; r < rows; r++) {
            for (int c = 0; c < area.cols; c++) {
                int slotIndex = firstIndex + r * area.cols + c;
                if (slotIndex >= menuSlots.size()) continue;
                Slot old = menuSlots.get(slotIndex);
                int x = visible ? area.slotX(c) : ScrollableSlotArea.OFFSCREEN;
                int y = visible ? area.slotY(r) : ScrollableSlotArea.OFFSCREEN;
                Slot replacement = SpecSlots.slotWithBackground(old.container, old.getContainerSlot(), x, y, old.getNoItemIcon());
                replacement.index = old.index;
                menuSlots.set(slotIndex, replacement);
            }
        }
    }

    public boolean visible() {
        return visible;
    }
}
