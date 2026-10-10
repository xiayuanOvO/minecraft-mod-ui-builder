package sheepfromheaven.screenspec.runtime;

import net.minecraft.client.gui.Font;
import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.resources.Identifier;

import java.util.HashMap;
import java.util.Map;

/**
 * Renders the decoration widget kinds - {@code panel}, {@code label}, {@code icon} - and resolves
 * their {@code text} bindings identically for {@link SpecScreen} and {@link SpecContainerScreen},
 * so a widget spec looks and behaves the same regardless of which one ends up hosting it. Before
 * this class existed the two screens each reimplemented these renderers by hand and had drifted -
 * {@code SpecContainerScreen} drew panels as flat fills instead of the nine-slice sprite and had no
 * {@code text} binding or {@code icon} support at all. That drift is exactly the kind of thing that
 * forces a mod author extending this library to learn two slightly different widget models
 * depending on whether their screen happens to have inventory slots; centralizing the rendering
 * here means that choice only affects slots, not everything else on the screen.
 *
 * <p>Position is passed in per call rather than owned here, since {@link SpecScreen} centers its
 * spec in the window (an {@code originX}/{@code originY} offset) while {@link SpecContainerScreen}
 * anchors it at the container's {@code leftPos}/{@code topPos} - the one difference that's actually
 * inherent to the two screens' base classes, not an accident of duplicated code.
 */
final class SpecWidgetRenderer {
    private final ScreenSpec spec;
    // resolved bound text for decoration widgets (label/icon) - cleared and recomputed each frame
    private final Map<String, String> boundText = new HashMap<>();
    // subclass-driven text overrides - NOT cleared each frame; take priority over boundText
    private final Map<String, String> pinnedText = new HashMap<>();
    // resolved bound value for progress widgets - cleared and recomputed each frame
    private final Map<String, Double> boundValue = new HashMap<>();
    // subclass-driven value overrides - NOT cleared each frame; take priority over boundValue
    private final Map<String, Double> pinnedValue = new HashMap<>();
    // resolved bound satisfied flag for requirement widgets - cleared and recomputed each frame
    private final Map<String, Boolean> boundSatisfied = new HashMap<>();
    // src path → Identifier cache for sprite widgets - avoids allocation on every render frame
    private final Map<String, Identifier> spriteTexCache = new HashMap<>();

    SpecWidgetRenderer(ScreenSpec spec) {
        this.spec = spec;
    }

    /** See {@code SpecScreen#bindText} / {@code SpecContainerScreen#bindText}. */
    void bindText(String widgetId, String text) {
        pinnedText.put(widgetId, text);
    }

    /** See {@code SpecScreen#bindValue} / {@code SpecContainerScreen#bindValue}. */
    void bindValue(String widgetId, double value) {
        pinnedValue.put(widgetId, value);
    }

    /**
     * Qualifies a short id with {@code modId} using a {@code "."} separator (e.g. {@code "health"}
     * -> {@code "my_mod.health"}). Ids that are {@code null}, empty, already contain {@code "."}, or
     * whose spec has no {@code modId} are returned unchanged.
     */
    static String qualify(String modId, String id) {
        if (id == null || id.isEmpty() || id.contains(".") || modId == null || modId.isEmpty()) {
            return id;
        }
        return modId + "." + id;
    }

    /**
     * Recomputes {@link #boundText} and {@link #boundValue} from every widget's declared {@code
     * text}/{@code value} bindings. Call once per frame before rendering labels/icons/progress
     * bars. Only those two targets are handled here - {@code enabled}/{@code visible} bindings
     * apply to a live {@code AbstractWidget} and stay the host screen's responsibility, since
     * {@code SpecContainerScreen} doesn't build interactive widgets of its own the way {@code
     * SpecScreen} does.
     */
    void refreshBindings() {
        boundText.clear();
        boundValue.clear();
        boundSatisfied.clear();
        for (WidgetSpec w : spec.widgets) {
            String textPath = w.bindings.get("text");
            if (textPath != null) {
                String value = DataRegistry.resolve(qualify(spec.modId, textPath));
                if (value != null) boundText.put(w.id, value);
            }
            String valuePath = w.bindings.get("value");
            if (valuePath != null) {
                String value = DataRegistry.resolve(qualify(spec.modId, valuePath));
                if (value != null) {
                    try {
                        boundValue.put(w.id, Double.parseDouble(value));
                    } catch (NumberFormatException ignored) {
                        // leave unbound - falls back to the widget's static/pinned value
                    }
                }
            }
            String satisfiedPath = w.bindings.get("satisfied");
            if (satisfiedPath != null) {
                String value = DataRegistry.resolve(qualify(spec.modId, satisfiedPath));
                if (value != null) boundSatisfied.put(w.id, Boolean.parseBoolean(value));
            }
        }
    }

    /** Resolves a label/icon widget's display text: pinned override, then binding, then the spec's static {@code text}. */
    String resolveText(WidgetSpec w) {
        return pinnedText.getOrDefault(w.id, boundText.getOrDefault(w.id, w.text));
    }

    /** Resolves a progress widget's numeric value: pinned override, then binding, then {@code fallback}. */
    double resolveValue(WidgetSpec w, double fallback) {
        Double pinned = pinnedValue.get(w.id);
        if (pinned != null) return pinned;
        return boundValue.getOrDefault(w.id, fallback);
    }

    /** Resolves a {@code requirement} widget's fulfillment flag: binding first, else {@code fallback}. */
    boolean resolveSatisfied(WidgetSpec w, boolean fallback) {
        return boundSatisfied.getOrDefault(w.id, fallback);
    }

    /**
     * Draws a {@code panel} widget using the MC nine-slice sprite, at {@code (x, y)} in screen
     * space (the caller has already added its own origin offset to {@code w.x}/{@code w.y}).
     */
    void renderPanel(DrawContext ctx, WidgetSpec w, int x, int y) {
        String style = w.prop("style", "default");
        if (style.equals("transparent")) {
            return;
        }
        if (style.equals("dark")) {
            ctx.fill(x, y, x + w.w, y + w.h, 0x80000000);
            return;
        }
        renderVanillaPanel(ctx, x, y, w.w, w.h);
    }

    // Vanilla's own survival-inventory background - the raised-panel bevel look shared by every
    // vanilla container screen. Only its top-left 176x166 is real content (the rest of the 256x256
    // texture is unused atlas padding); its border is a uniform 3px bevel on all four sides (checked
    // pixel-by-pixel along each edge), so it nine-slices cleanly. (88, 10) is a flat-grey point deep
    // enough in the fill to dodge the player-model/crafting-grid/armor-slot art drawn over the middle
    // of this same texture - same reference point `scripts/extractMCTextures.py` uses on the webapp
    // side. Referencing vanilla's own texture (rather than shipping a copy) means a resource pack
    // that reskins the inventory background reskins our panels too, for free.
    private static final Identifier PANEL_TEX = Identifier.withDefaultNamespace("textures/gui/container/inventory.png");
    private static final int PANEL_TEX_W = 256;
    private static final int PANEL_TEX_H = 256;
    private static final int PANEL_CONTENT_W = 176;
    private static final int PANEL_CONTENT_H = 166;
    private static final int PANEL_BORDER = 3;
    private static final int PANEL_SAFE_U = 88;
    private static final int PANEL_SAFE_V = 10;

    /**
     * Draws a raised MC panel at an arbitrary rect by nine-slicing vanilla's own inventory
     * background texture (see above) - shared by {@link #renderPanel} and a {@code tabs} widget's
     * body area, which needs the same "framed panel" look without being an actual {@code panel}
     * widget itself.
     */
    void renderVanillaPanel(DrawContext ctx, int x, int y, int w, int h) {
        int rightU  = PANEL_CONTENT_W - PANEL_BORDER;
        int bottomV = PANEL_CONTENT_H - PANEL_BORDER;
        int destFillW = Math.max(0, w - PANEL_BORDER * 2);
        int destFillH = Math.max(0, h - PANEL_BORDER * 2);

        // top row: corners plus a horizontally-stretched top edge sampled from a safe column
        ninePatch(ctx, PANEL_TEX, x,                y, 0,               0, PANEL_BORDER,   PANEL_BORDER, PANEL_BORDER, PANEL_BORDER, PANEL_TEX_W, PANEL_TEX_H);
        ninePatch(ctx, PANEL_TEX, x + PANEL_BORDER,  y, PANEL_SAFE_U,    0, 1,               PANEL_BORDER, destFillW,    PANEL_BORDER, PANEL_TEX_W, PANEL_TEX_H);
        ninePatch(ctx, PANEL_TEX, x + w - PANEL_BORDER, y, rightU,      0, PANEL_BORDER,   PANEL_BORDER, PANEL_BORDER, PANEL_BORDER, PANEL_TEX_W, PANEL_TEX_H);

        if (destFillH > 0) {
            // middle rows: left/right edges stretched vertically, center fill stretched both ways
            int midY = y + PANEL_BORDER;
            ninePatch(ctx, PANEL_TEX, x,                    midY, 0,            PANEL_SAFE_V, PANEL_BORDER, 1, PANEL_BORDER, destFillH, PANEL_TEX_W, PANEL_TEX_H);
            ninePatch(ctx, PANEL_TEX, x + PANEL_BORDER,      midY, PANEL_SAFE_U, PANEL_SAFE_V, 1,            1, destFillW,    destFillH, PANEL_TEX_W, PANEL_TEX_H);
            ninePatch(ctx, PANEL_TEX, x + w - PANEL_BORDER,  midY, rightU,       PANEL_SAFE_V, PANEL_BORDER, 1, PANEL_BORDER, destFillH, PANEL_TEX_W, PANEL_TEX_H);
        }

        // bottom row: corners plus a horizontally-stretched bottom edge, only if taller than the top border alone
        int bottomDestY = y + h - PANEL_BORDER;
        if (bottomDestY > y + PANEL_BORDER) {
            ninePatch(ctx, PANEL_TEX, x,                    bottomDestY, 0,            bottomV, PANEL_BORDER, PANEL_BORDER, PANEL_BORDER, PANEL_BORDER, PANEL_TEX_W, PANEL_TEX_H);
            ninePatch(ctx, PANEL_TEX, x + PANEL_BORDER,      bottomDestY, PANEL_SAFE_U, bottomV, 1,            PANEL_BORDER, destFillW,    PANEL_BORDER, PANEL_TEX_W, PANEL_TEX_H);
            ninePatch(ctx, PANEL_TEX, x + w - PANEL_BORDER,  bottomDestY, rightU,       bottomV, PANEL_BORDER, PANEL_BORDER, PANEL_BORDER, PANEL_BORDER, PANEL_TEX_W, PANEL_TEX_H);
        }
    }

    /**
     * Draws a {@code label} widget's text at {@code (x, y)} in screen space, honoring the
     * {@code color}, {@code shadow} and {@code align} props from the designer and this widget's
     * resolved bound/pinned text (see {@link #resolveText}).
     *
     * <p>The default color 0xFF404040 matches vanilla's own container title color (-12566464), which
     * includes full alpha — without the 0xFF alpha byte, text treats the text as transparent.
     */
    void renderLabel(DrawContext ctx, Font font, WidgetSpec w, int x, int y) {
        int color = w.propInt("color", 0xFF404040);
        boolean shadow = w.propBoolean("shadow", false);
        String align = w.prop("align", "left");
        String text = resolveText(w);
        int textWidth = font.width(text);
        int alignedX = switch (align) {
            case "center" -> x + (w.w - textWidth) / 2;
            case "right" -> x + w.w - textWidth;
            default -> x;
        };
        ctx.drawText(font, text, alignedX, y, color, shadow);
    }

    /** Draws an {@code icon} widget at {@code (x, y)} in screen space. No-op if {@code resolveIcon} returns {@code null}. */
    void renderIcon(DrawContext ctx, WidgetSpec w, int x, int y, IconResolver resolveIcon) {
        Identifier location = resolveIcon.resolve(w);
        if (location == null) {
            return;
        }
        int scale = w.propInt("scale", 1);
        ctx.blitIcon(location, x, y, w.w * scale, w.h * scale);
    }

    private static final int REQUIREMENT_COLOR_MET = 0xFF00FF00;
    private static final int REQUIREMENT_COLOR_UNMET = 0xFFFF0000;

    /**
     * Draws a {@code requirement} widget at {@code (x, y)} in screen space: an item icon (see
     * {@link #renderIcon}) framed by a solid border whose color reflects this widget's {@code
     * satisfied} binding - fulfilled requirements (green by default) vs. unmet ones (red by
     * default). Ported from mine-now's {@code StructureMarkerScreen#drawRequirementRow} slot look.
     */
    void renderRequirement(DrawContext ctx, WidgetSpec w, int x, int y, IconResolver resolveIcon) {
        boolean satisfied = resolveSatisfied(w, false);
        int borderColor = (satisfied
                ? w.propInt("color_met", REQUIREMENT_COLOR_MET)
                : w.propInt("color_unmet", REQUIREMENT_COLOR_UNMET)) | 0xFF000000;
        int borderWidth = Math.max(1, w.propInt("border_width", 2));

        ctx.fill(x, y, x + w.w, y + w.h, borderColor);
        ctx.fill(x + borderWidth, y + borderWidth, x + w.w - borderWidth, y + w.h - borderWidth, 0xFF8B8B8B);

        Identifier location = resolveIcon.resolve(w);
        if (location == null) {
            return;
        }
        int iconX = x + borderWidth;
        int iconY = y + borderWidth;
        int iconW = w.w - borderWidth * 2;
        int iconH = w.h - borderWidth * 2;
        ctx.blitIcon(location, iconX, iconY, iconW, iconH);
    }

    /** Maps an {@code icon} widget's {@code icon} id to a texture location; mirrors each screen's overridable {@code resolveIcon}. */
    @FunctionalInterface
    interface IconResolver {
        Identifier resolve(WidgetSpec w);
    }

    // Vanilla's own creative-inventory tab sprites - the recognizable "folder tab" look the webapp's
    // canvas mimics. The selected tab uses one of three column variants that differ at their left/right
    // edges (_1 = leftmost, _2 = middle, _7 = rightmost); the unselected state always uses _1 since
    // the subtle edge difference is invisible at reduced size. Referencing vanilla's own sprites means
    // a resource pack that reskins these also reskins ours. Unlike `widget/tab`, these have no
    // nine-slice .mcmeta (vanilla only ever blits them at a fixed 26×32), so the slicing below is
    // done by hand: 4px border on all four sides. 4 (not the outline+bevel's 3) because the corner
    // transition art extends one pixel past it: the white inner bevel's diagonal pixel sits at
    // (3,3), and the bottom corners' art that fades the side border into the panel bevel spans the
    // last rows. The unselected variant is the same art shifted down 2px (it sits 2px shorter).
    private static final Identifier TAB_SEL_LEFT   = Identifier.withDefaultNamespace("textures/gui/sprites/container/creative_inventory/tab_top_selected_1.png");
    private static final Identifier TAB_SEL_MIDDLE = Identifier.withDefaultNamespace("textures/gui/sprites/container/creative_inventory/tab_top_selected_2.png");
    private static final Identifier TAB_SEL_RIGHT  = Identifier.withDefaultNamespace("textures/gui/sprites/container/creative_inventory/tab_top_selected_7.png");
    private static final Identifier TAB_UNSELECTED = Identifier.withDefaultNamespace("textures/gui/sprites/container/creative_inventory/tab_top_unselected_1.png");
    private static final int TAB_TEX_W = 26;
    private static final int TAB_TEX_H = 32;
    private static final int TAB_BORDER = 4;
    private static final int TAB_UNSELECTED_TOP_V = 2;
    // Safe sampling coordinates for the stretched regions, mirroring the webapp's *_slice.png files
    // (which are only 7px wide - 3px edges + a single mid column): the corner diagonal in these
    // sprites extends past the 3px corner into the interior, so stretching the whole interior drags
    // the diagonal out. Sampling a single flat column/row deep in the sprite avoids that.
    private static final int TAB_SAFE_U = 13;
    private static final int TAB_SAFE_V = 16;

    // Nested tab sprites — vanilla widget/tab.png and widget/tab_selected.png (130×24), uniform 3px
    // border on all sides, no left/middle/right variants. Unlike tab_selected.png, tab.png's real
    // border art doesn't start until row 4 - rows 0-3 are fully transparent padding, since vanilla
    // draws unselected tabs without the raised lip selected tabs have. Sampling row 0 straight (as if
    // both textures were laid out identically) grabs that transparent padding instead of the border,
    // which renders as the top of the tab going missing.
    private static final Identifier NESTED_TAB_SEL   = Identifier.withDefaultNamespace("textures/gui/sprites/widget/tab_selected.png");
    private static final Identifier NESTED_TAB_UNSEL = Identifier.withDefaultNamespace("textures/gui/sprites/widget/tab.png");
    private static final int NESTED_TAB_TEX_W  = 130;
    private static final int NESTED_TAB_TEX_H  = 24;
    private static final int NESTED_TAB_BORDER = 3;
    private static final int NESTED_TAB_UNSELECTED_TOP_V = 4;
    private static final int NESTED_TAB_SAFE_U = 65;
    private static final int NESTED_TAB_SAFE_V = 12;

    /** Draws a {@code tabs} selector button. {@code nested} selects the compact {@code widget/tab}
     *  sprite (3px uniform border); {@code !nested} uses vanilla's creative-inventory sprite (4px,
     *  position-dependent). */
    void renderTab(DrawContext ctx, boolean active, TabButtonWidget.Position position, boolean nested, int x, int y, int w, int h) {
        if (nested) {
            renderNestedTab(ctx, active, x, y, w, h);
        } else {
            renderTopTab(ctx, active, position, x, y, w, h);
        }
    }

    private void renderTopTab(DrawContext ctx, boolean active, TabButtonWidget.Position position, int x, int y, int w, int h) {
        Identifier tex;
        if (!active) {
            tex = TAB_UNSELECTED;
        } else {
            tex = switch (position) {
                case LEFT  -> TAB_SEL_LEFT;
                case RIGHT -> TAB_SEL_RIGHT;
                default    -> TAB_SEL_MIDDLE;
            };
        }
        int topV = active ? 0 : TAB_UNSELECTED_TOP_V;
        int rightU    = TAB_TEX_W - TAB_BORDER;
        int bottomV   = TAB_TEX_H - TAB_BORDER;
        int destFillW = Math.max(0, w - TAB_BORDER * 2);
        int destFillH = Math.max(0, h - TAB_BORDER * 2);

        // top row: fixed corners, top edge stretched from a 1px-wide safe column
        ninePatch(ctx, tex, x,                y, 0,          topV, TAB_BORDER, TAB_BORDER, TAB_BORDER, TAB_BORDER, TAB_TEX_W, TAB_TEX_H);
        ninePatch(ctx, tex, x + TAB_BORDER,    y, TAB_SAFE_U, topV, 1,          TAB_BORDER, destFillW,  TAB_BORDER, TAB_TEX_W, TAB_TEX_H);
        ninePatch(ctx, tex, x + w - TAB_BORDER, y, rightU,    topV, TAB_BORDER, TAB_BORDER, TAB_BORDER, TAB_BORDER, TAB_TEX_W, TAB_TEX_H);

        if (destFillH > 0) {
            // middle rows: left/right edges stretched from a 1px-tall safe row, flat center fill
            int fillY = y + TAB_BORDER;
            ninePatch(ctx, tex, x,                 fillY, 0,          TAB_SAFE_V, TAB_BORDER, 1, TAB_BORDER, destFillH, TAB_TEX_W, TAB_TEX_H);
            ninePatch(ctx, tex, x + TAB_BORDER,     fillY, TAB_SAFE_U, TAB_SAFE_V, 1,          1, destFillW,  destFillH, TAB_TEX_W, TAB_TEX_H);
            ninePatch(ctx, tex, x + w - TAB_BORDER, fillY, rightU,     TAB_SAFE_V, TAB_BORDER, 1, TAB_BORDER, destFillH, TAB_TEX_W, TAB_TEX_H);
        }

        // bottom row: fixed corners from the texture's last 3 rows — these hold the connection art
        // where the tab's side border fades into the panel's top bevel (e.g. the selected sprite's
        // right shadow turns white then grey over rows 29-31). The bottom edge between them is
        // plain fill, stretched from the safe column.
        int bottomDestY = y + h - TAB_BORDER;
        if (bottomDestY > y + TAB_BORDER) {
            ninePatch(ctx, tex, x,                 bottomDestY, 0,          bottomV, TAB_BORDER, TAB_BORDER, TAB_BORDER, TAB_BORDER, TAB_TEX_W, TAB_TEX_H);
            ninePatch(ctx, tex, x + TAB_BORDER,     bottomDestY, TAB_SAFE_U, bottomV, 1,          TAB_BORDER, destFillW,  TAB_BORDER, TAB_TEX_W, TAB_TEX_H);
            ninePatch(ctx, tex, x + w - TAB_BORDER, bottomDestY, rightU,     bottomV, TAB_BORDER, TAB_BORDER, TAB_BORDER, TAB_BORDER, TAB_TEX_W, TAB_TEX_H);
        }
    }

    private void renderNestedTab(DrawContext ctx, boolean active, int x, int y, int w, int h) {
        Identifier tex    = active ? NESTED_TAB_SEL : NESTED_TAB_UNSEL;
        int b             = NESTED_TAB_BORDER;
        int topV          = active ? 0 : NESTED_TAB_UNSELECTED_TOP_V;
        int rightU        = NESTED_TAB_TEX_W - b;
        int bottomV       = NESTED_TAB_TEX_H - b;
        int destFillW     = Math.max(0, w - b * 2);
        int destFillH     = Math.max(0, h - b * 2);

        ninePatch(ctx, tex, x,         y, 0,                   topV,                b, b, b,         b,         NESTED_TAB_TEX_W, NESTED_TAB_TEX_H);
        ninePatch(ctx, tex, x + b,     y, NESTED_TAB_SAFE_U,   topV,                1, b, destFillW, b,         NESTED_TAB_TEX_W, NESTED_TAB_TEX_H);
        ninePatch(ctx, tex, x + w - b, y, rightU,              topV,                b, b, b,         b,         NESTED_TAB_TEX_W, NESTED_TAB_TEX_H);

        if (destFillH > 0) {
            int fillY = y + b;
            ninePatch(ctx, tex, x,         fillY, 0,                 NESTED_TAB_SAFE_V, b, 1, b,         destFillH, NESTED_TAB_TEX_W, NESTED_TAB_TEX_H);
            ninePatch(ctx, tex, x + b,     fillY, NESTED_TAB_SAFE_U, NESTED_TAB_SAFE_V, 1, 1, destFillW, destFillH, NESTED_TAB_TEX_W, NESTED_TAB_TEX_H);
            ninePatch(ctx, tex, x + w - b, fillY, rightU,            NESTED_TAB_SAFE_V, b, 1, b,         destFillH, NESTED_TAB_TEX_W, NESTED_TAB_TEX_H);
        }

        int bottomDestY = y + h - b;
        if (bottomDestY > y + b) {
            ninePatch(ctx, tex, x,         bottomDestY, 0,                 bottomV, b, b, b,         b, NESTED_TAB_TEX_W, NESTED_TAB_TEX_H);
            ninePatch(ctx, tex, x + b,     bottomDestY, NESTED_TAB_SAFE_U, bottomV, 1, b, destFillW, b, NESTED_TAB_TEX_W, NESTED_TAB_TEX_H);
            ninePatch(ctx, tex, x + w - b, bottomDestY, rightU,            bottomV, b, b, b,         b, NESTED_TAB_TEX_W, NESTED_TAB_TEX_H);
        }
    }

    /**
     * Draws a {@code sprite} widget: a flat textured quad sampled from a mod or vanilla texture.
     *
     * <p>{@code src} is the path under a resource pack's {@code assets/<namespace>/textures/}
     * directory (e.g. {@code "gui/sprites/widget/button.png"}). The namespace defaults to
     * {@code minecraft}; mod-specific textures must be placed in the vanilla namespace or the
     * src format extended in a future revision.
     *
     * <p>{@code fit} is {@code "fill"} (default) or {@code "tile"}. Fill stretches the full
     * texture to the widget bounds. Tile repeats it at {@code tile_w}/{@code tile_h} pixel
     * intervals (default 16×16), clipping the last partial tile at each edge.
     * {@code contain}/{@code cover}/{@code none} require the natural texture size, which is
     * not available at render time without querying the texture manager; they fall back to fill.
     */
    void renderSprite(DrawContext ctx, WidgetSpec w, int x, int y) {
        String src = w.prop("src", "");
        if (src.isEmpty()) return;
        Identifier tex = spriteTexCache.computeIfAbsent(src, s -> Identifier.withDefaultNamespace("textures/" + s));
        String fit = w.prop("fit", "fill");
        if ("tile".equals(fit)) {
            int tileW = w.propInt("tile_w", 16);
            int tileH = w.propInt("tile_h", 16);
            for (int ty = 0; ty < w.h; ty += tileH) {
                for (int tx = 0; tx < w.w; tx += tileW) {
                    int dw = Math.min(tileW, w.w - tx);
                    int dh = Math.min(tileH, w.h - ty);
                    // srcW/texW = dw/tileW samples the correct fractional UV for the partial last tile
                    ninePatch(ctx, tex, x + tx, y + ty, 0, 0, dw, dh, dw, dh, tileW, tileH);
                }
            }
        } else {
            // Treat the texture as a 1×1 atlas so UV spans 0..1 = full texture, stretched to widget bounds.
            ninePatch(ctx, tex, x, y, 0, 0, 1, 1, w.w, w.h, 1, 1);
        }
    }

    // Solid-fill look ported from mine-now's InhabitantScreen need bars (drawNeedBar) - no texture
    // atlas, just flat graphics.fill() rects: a dark track, a 1px border, and a fill rect whose
    // width is round(w.w * clamp(fraction, 0, 1)). "color" props are stored as plain RGB ints (see
    // PropertyPanel's argbIntToHex, which masks to the low 24 bits) so the alpha byte is forced to
    // opaque (0xFF000000) here rather than trusted from the stored value.
    private static final int PROGRESS_TRACK_COLOR = 0xFF2B2B2B;
    private static final int PROGRESS_BORDER_COLOR = 0xFF1A1A1A;
    private static final int PROGRESS_THRESHOLD_HIGH = 0xFF3CB043;
    private static final int PROGRESS_THRESHOLD_MID = 0xFFD9A400;
    private static final int PROGRESS_THRESHOLD_LOW = 0xFFCC3333;

    private static int progressFillColor(WidgetSpec w, double frac) {
        if ("solid".equals(w.prop("style", "threshold"))) {
            return w.propInt("color", 0x3CB043) | 0xFF000000;
        }
        if (frac >= 0.66) return PROGRESS_THRESHOLD_HIGH;
        if (frac >= 0.33) return PROGRESS_THRESHOLD_MID;
        return PROGRESS_THRESHOLD_LOW;
    }

    /**
     * Draws a {@code progress} widget at {@code (x, y)} in screen space: a solid-fill horizontal
     * bar (fills left-to-right) with an optional centered {@code min}/{@code max}/{@code value}
     * percentage label. {@code value} comes from this widget's {@code value} binding/pin if set
     * (see {@link #resolveValue}), otherwise its static {@code value} prop.
     */
    void renderProgress(DrawContext ctx, Font font, WidgetSpec w, int x, int y) {
        double min = w.propDouble("min", 0);
        double max = w.propDouble("max", 100);
        double value = resolveValue(w, w.propDouble("value", min));
        double frac = max > min ? Math.max(0.0, Math.min(1.0, (value - min) / (max - min))) : 0.0;
        int filled = Math.round((float) (w.w * frac));

        ctx.fill(x, y, x + w.w, y + w.h, PROGRESS_TRACK_COLOR);
        if (filled > 0) {
            ctx.fill(x, y, x + filled, y + w.h, progressFillColor(w, frac));
        }
        ctx.fill(x,               y,             x + w.w, y + 1,   PROGRESS_BORDER_COLOR);
        ctx.fill(x,               y + w.h - 1,   x + w.w, y + w.h, PROGRESS_BORDER_COLOR);
        ctx.fill(x,               y,             x + 1,   y + w.h, PROGRESS_BORDER_COLOR);
        ctx.fill(x + w.w - 1,     y,             x + w.w, y + w.h, PROGRESS_BORDER_COLOR);

        if (w.propBoolean("show_label", true)) {
            String template = w.text.isEmpty() ? "%s%%" : w.text;
            String text = template.replace("%s", String.valueOf(Math.round(frac * 100)));
            int textX = x + (w.w - font.width(text)) / 2;
            int textY = y + (w.h - font.lineHeight) / 2 + 1;
            ctx.drawText(font, text, textX, textY, 0xFFFFFFFF, false);
        }
    }

    /** Draws a vanilla survival HUD meter (health, hunger, armor, air, or experience). */
    void renderSurvivalBar(DrawContext ctx, WidgetSpec w, int x, int y) {
        double max = Math.max(1.0, w.propDouble("max", 20.0));
        double value = Math.max(0.0, Math.min(max, resolveValue(w, w.propDouble("value", 0.0))));
        double fraction = value / max;
        String kind = w.type;

        if ("experience_bar".equals(kind)) {
            Identifier background = hudTexture("experience_bar_background.png");
            Identifier progress = hudTexture("experience_bar_progress.png");
            ctx.blitIcon(background, x, y, w.w, w.h);
            int filled = Math.round((float) (w.w * fraction));
            if (filled > 0) {
                int sourceW = Math.max(1, Math.min(182, Math.round((float) (182 * fraction))));
                ctx.blitRegion(progress, x, y, 0, 0, filled, w.h, sourceW, 5, 182, 5);
            }
            return;
        }

        String emptySprite;
        String fullSprite;
        String halfSprite;
        switch (kind) {
            case "health_bar" -> {
                emptySprite = "heart/container.png";
                fullSprite = "heart/full.png";
                halfSprite = "heart/half.png";
            }
            case "hunger_bar" -> {
                emptySprite = "food_empty.png";
                fullSprite = "food_full.png";
                halfSprite = "food_half.png";
            }
            case "armor_bar" -> {
                emptySprite = "armor_empty.png";
                fullSprite = "armor_full.png";
                halfSprite = "armor_half.png";
            }
            case "air_bar" -> {
                emptySprite = "air_empty.png";
                fullSprite = "air.png";
                halfSprite = "air.png";
            }
            default -> { return; }
        }

        int count = "air_bar".equals(kind)
            ? Math.max(1, Math.min(20, w.propInt("count", 10)))
            : Math.max(1, Math.min(20, (int) Math.ceil(max / 2.0)));
        float iconScale = Math.min(w.w / (float) (count * 8 + 1), w.h / 9.0f);
        if (iconScale <= 0) return;
        int iconSize = Math.max(1, Math.round(9 * iconScale));
        int step = Math.max(1, Math.round(8 * iconScale));
        int contentW = (count - 1) * step + iconSize;
        int contentH = iconSize;
        int startX = x + (w.w - contentW) / 2;
        int startY = y + (w.h - contentH) / 2;
        Identifier empty = hudTexture(emptySprite);
        Identifier full = hudTexture(fullSprite);
        Identifier half = hudTexture(halfSprite);
        double unit = "air_bar".equals(kind) ? max / count : 2.0;
        for (int index = 0; index < count; index++) {
            int iconX = startX + index * step;
            ctx.blitIcon(empty, iconX, startY, iconSize, iconSize);
            double remaining = value - index * unit;
            if ("air_bar".equals(kind)) {
                if (remaining >= unit) ctx.blitIcon(full, iconX, startY, iconSize, iconSize);
            } else if (remaining >= 2.0) {
                ctx.blitIcon(full, iconX, startY, iconSize, iconSize);
            } else if (remaining >= 1.0) {
                ctx.blitIcon(half, iconX, startY, iconSize, iconSize);
            }
        }
    }

    private Identifier hudTexture(String file) {
        String key = "hud:" + file;
        return spriteTexCache.computeIfAbsent(key,
            ignored -> Identifier.withDefaultNamespace("textures/gui/sprites/hud/" + file));
    }

    private static final int CUSTOM_PLACEHOLDER_BG = 0xFF2B2B2B;
    private static final int CUSTOM_PLACEHOLDER_BORDER = 0xFF8B8B8B;

    /**
     * Draws a {@code custom} widget at {@code (x, y)} in screen space: delegates to whatever
     * {@link CustomWidgetRenderer} is registered under this widget's {@code customType} prop, or
     * falls back to the same labeled placeholder box the designer shows if none is registered yet.
     */
    void renderCustom(GuiGraphicsExtractor graphics, Font font, WidgetSpec w, int x, int y) {
        String customType = w.prop("customType", "");
        CustomWidgetRenderer renderer = CustomWidgetRegistry.get(customType);
        if (renderer != null) {
            renderer.render(graphics, w, x, y);
            return;
        }
        DrawContext ctx = new McDrawContext(graphics);
        ctx.fill(x, y, x + w.w, y + w.h, CUSTOM_PLACEHOLDER_BG);
        ctx.fill(x,             y,             x + w.w, y + 1,   CUSTOM_PLACEHOLDER_BORDER);
        ctx.fill(x,             y + w.h - 1,   x + w.w, y + w.h, CUSTOM_PLACEHOLDER_BORDER);
        ctx.fill(x,             y,             x + 1,   y + w.h, CUSTOM_PLACEHOLDER_BORDER);
        ctx.fill(x + w.w - 1,   y,             x + w.w, y + w.h, CUSTOM_PLACEHOLDER_BORDER);
        String label = customType.isEmpty() ? "custom" : customType;
        int textX = x + (w.w - font.width(label)) / 2;
        int textY = y + (w.h - font.lineHeight) / 2;
        ctx.drawText(font, label, textX, textY, 0xFFFFFFFF, false);
    }

    /** Renders the empty black viewport and beveled frame used by the player preview widget. */
    void renderPlayerPreview(GuiGraphicsExtractor graphics, WidgetSpec w, int x, int y) {
        if (w.w <= 0 || w.h <= 0) return;
        DrawContext ctx = new McDrawContext(graphics);
        ctx.fill(x, y, x + w.w, y + w.h, 0xFF000000);
        if (w.w < 2 || w.h < 2) return;
        ctx.fill(x, y, x + w.w, y + 1, 0xFF373737);
        ctx.fill(x, y, x + 1, y + w.h, 0xFF373737);
        ctx.fill(x + w.w - 1, y, x + w.w, y + w.h, 0xFFFFFFFF);
        ctx.fill(x, y + w.h - 1, x + w.w, y + w.h, 0xFFFFFFFF);
    }

    /** Blits one nine-slice piece: a {@code srcW x srcH} source region (from a {@code texW x texH} texture) stretched to {@code destW x destH}. */
    private void ninePatch(DrawContext ctx, Identifier tex, int x, int y, int u, int v, int srcW, int srcH, int destW, int destH, int texW, int texH) {
        if (destW <= 0 || destH <= 0) return;
        ctx.blitRegion(tex, x, y, u, v, destW, destH, srcW, srcH, texW, texH);
    }
}
