"use client";

import { useState, useCallback, useRef, createContext, useContext } from "react";
import React from "react";

import { Rnd } from "react-rnd";
import { toast } from "sonner";
import type { WidgetSpec, BindingsSchema } from "@/lib/types";
import { getBindingNode } from "@/components/BindingsTree";
import WidgetVisual from "./WidgetVisual";
import { ScrollbarVisual, SCROLLBAR_THUMB_LEN, SCROLLBAR_BORDER_PX } from "@/components/widgets";
import { ScrollbarTry, SCROLLBAR_FIXED_PX } from "@/components/widgets/scrollbar/ScrollbarTry";
import { InventoryAreaTry } from "@/components/widgets/inventory_area/InventoryAreaTry";
import { TextureCtx, ScrollCtx, type ScrollPos, type ScrollCtxVal } from "@/components/widgets/tryContext";
import WIDGET_REGISTRY from "@/lib/widgetRegistry";
import { MULTI_SELECTION_COLOR, SELECTION_COLOR, SELECTION_OUTLINE } from "@/lib/selectionStyle";
import { getInventoryAreaSize } from "@/lib/inventoryAreaSize";
import { useTextures } from "@/lib/TextureContext";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AddWidgetItems } from "@/components/AddWidgetItems";
import { TabsTopEditHeader, type TabDrag } from "@/components/widgets/tabs/top/TabsTopEditHeader";
import { tabsMinWidth, reflowTabsForWidth, computeTabLayout, TAB_GAP, NESTED_TAB_GAP } from "@/components/widgets/tabs/tabLayout";
import { TabsTopTryHeader } from "@/components/widgets/tabs/top/TabsTopTryHeader";
import { TabsNestedEditHeader } from "@/components/widgets/tabs/nested/TabsNestedEditHeader";
import { TabsNestedTryHeader } from "@/components/widgets/tabs/nested/TabsNestedTryHeader";
import { computeDragBounds, computeResizeBounds, findAxisAlignment } from "@/lib/widgetBounds";
import { GuideLines, type DragGuidesInfo, type AlignmentLine } from "@/components/DragGuides";
import { GroupSelectionOverlay, type GroupDragInfo } from "@/components/GroupSelectionOverlay";

const BindingsCtx = createContext<BindingsSchema>({});
const UpdateWidgetCtx = React.createContext<(w: WidgetSpec) => void>(() => {});
const UpdateWidgetsCtx = React.createContext<(ws: WidgetSpec[]) => void>(() => {});
const AllWidgetsCtx = React.createContext<WidgetSpec[]>([]);
// Whether selection changed during the current click sequence (reset when a new
// sequence starts, i.e. mousedown gap > 400ms). Prevents a double-click that
// also establishes selection from immediately entering text-edit mode.
const SelectionChangedCtx = React.createContext<React.MutableRefObject<boolean>>({ current: false });

interface ActiveTabCtxVal {
  activeTabIds: Map<string, string>;
  setActiveTab: (tabsWidgetId: string, tabId: string) => void;
}
const ActiveTabCtx = React.createContext<ActiveTabCtxVal>({
  activeTabIds: new Map(),
  setActiveTab: () => {},
});

const WORLD_IMAGE_URL = "/mc-world-bg.jpg";

const CONTAINER_TYPES = new Set(
  WIDGET_REGISTRY.filter(d => d.isContainer).map(d => d.type),
);


// Resize handle visuals — the hit area is provided by re-resizable; we render
// a centered square inside it so the handle looks like standard design tools.
// Left/right handles cap their height so they don't consume the full widget
// height on short widgets (labels), which would block clicks and double-clicks.
const SIDE_HANDLE_SIZE = 8; // px, screen-space hit area for edge handles
const RESIZE_HANDLE_STYLES: Record<string, React.CSSProperties> = {
  top:         { display: "flex", alignItems: "center", justifyContent: "center", width: SIDE_HANDLE_SIZE, left: "50%", transform: "translateX(-50%)" },
  bottom:      { display: "flex", alignItems: "center", justifyContent: "center", width: SIDE_HANDLE_SIZE, left: "50%", transform: "translateX(-50%)" },
  left:        { display: "flex", alignItems: "center", justifyContent: "center", height: SIDE_HANDLE_SIZE, top: "50%", transform: "translateY(-50%)" },
  right:       { display: "flex", alignItems: "center", justifyContent: "center", height: SIDE_HANDLE_SIZE, top: "50%", transform: "translateY(-50%)" },
  topLeft:     { display: "flex", alignItems: "center", justifyContent: "center", width: SIDE_HANDLE_SIZE, height: SIDE_HANDLE_SIZE, top: -SIDE_HANDLE_SIZE / 2, left: -SIDE_HANDLE_SIZE / 2 },
  topRight:    { display: "flex", alignItems: "center", justifyContent: "center", width: SIDE_HANDLE_SIZE, height: SIDE_HANDLE_SIZE, top: -SIDE_HANDLE_SIZE / 2, right: -SIDE_HANDLE_SIZE / 2 },
  bottomLeft:  { display: "flex", alignItems: "center", justifyContent: "center", width: SIDE_HANDLE_SIZE, height: SIDE_HANDLE_SIZE, bottom: -SIDE_HANDLE_SIZE / 2, left: -SIDE_HANDLE_SIZE / 2 },
  bottomRight: { display: "flex", alignItems: "center", justifyContent: "center", width: SIDE_HANDLE_SIZE, height: SIDE_HANDLE_SIZE, bottom: -SIDE_HANDLE_SIZE / 2, right: -SIDE_HANDLE_SIZE / 2 },
};
const RESIZE_HANDLE_CLASSES: Record<string, string> = {
  top: "canvas-resize-handle", bottom: "canvas-resize-handle",
  left: "canvas-resize-handle", right: "canvas-resize-handle",
  topLeft: "canvas-resize-handle", topRight: "canvas-resize-handle",
  bottomLeft: "canvas-resize-handle", bottomRight: "canvas-resize-handle",
};
interface Props {
  width: number;
  height: number;
  scale: number;
  widgets: WidgetSpec[];
  selectedId: string | null;
  selectedIds: string[];
  gridSize: number;
  showGrid: boolean;
  snapToParent: boolean;
  snapToSiblings: boolean;
  tryMode: boolean;
  bindingsSchema: BindingsSchema;
  onSelect: (id: string | null) => void;
  onSelectSingle: (id: string | null) => void;
  onToggleSelect: (id: string) => void;
  onUpdateWidget: (widget: WidgetSpec) => void;
  onUpdateWidgets: (widgets: WidgetSpec[]) => void;
  onAddWidget?: (type: string, x: number, y: number) => void;
}

// Whether `widget`'s "visible" binding (if any) currently resolves to true, using the
// bindings schema's previewValue as a stand-in for the live runtime value. Widgets with no
// "visible" binding are always visible.
function isConditionallyVisible(widget: WidgetSpec, schema: BindingsSchema): boolean {
  const path = widget.bindings?.visible;
  if (!path) return true;
  return getBindingNode(schema, path)?.previewValue !== false;
}

function applyBindingPreviews(widget: WidgetSpec, schema: BindingsSchema): { widget: WidgetSpec; hidden: boolean } {
  if (!widget.bindings || Object.keys(widget.bindings).length === 0) return { widget, hidden: false };
  let w = widget;
  const hidden = !isConditionallyVisible(widget, schema);
  for (const [target, path] of Object.entries(widget.bindings)) {
    const node = getBindingNode(schema, path);
    if (!node) continue;
    const val = node.previewValue;
    if (target === "text" && typeof val === "string") w = { ...w, text: val };
    else if (target === "enabled" && val === false) w = { ...w, props: { ...w.props, _disabled: "1" } };
  }
  return { widget: w, hidden };
}

export default function Canvas({
  width, height, scale, widgets, selectedId, selectedIds, gridSize, showGrid, snapToParent, snapToSiblings, tryMode, bindingsSchema, onSelect, onSelectSingle, onToggleSelect, onUpdateWidget, onUpdateWidgets, onAddWidget,
}: Props) {
  const cssWidth = width * scale;
  const cssHeight = height * scale;
  // snapPx is in MC pixel units (1px = 1 MC px inside the inner canvas).
  // The grid checkbox also gates snap-to-px: unchecked, drags/resizes move freely.
  const snapPx = showGrid ? gridSize : 1;
  const gridDataUrl = showGrid && !tryMode ? buildGridDataUrl(snapPx) : undefined;

  const childMap = buildChildMap(widgets);
  const rootWidgets = widgets.filter(w => !w.parentId);

  // Flag: did selection change during the current click sequence?
  // Reset when a new sequence starts (mousedown gap > 400ms).
  const selectionChangedRef = useRef<boolean>(false);
  const lastMousedownTimeRef = useRef<number>(0);

  // Active tab selection — shared across edit and try mode so switching modes
  // doesn't reset which tab is open.
  const [activeTabIds, setActiveTabIds] = useState<Map<string, string>>(() => new Map());
  const setActiveTab = React.useCallback((tabsWidgetId: string, tabId: string) => {
    setActiveTabIds(prev => new Map(prev).set(tabsWidgetId, tabId));
  }, []);

  // When selection changes, activate every tab in the ancestor chain so the
  // selected widget becomes visible regardless of which tab pane it lives in.
  React.useEffect(() => {
    if (!selectedId) return;
    const byId = new Map(widgets.map(w => [w.id, w]));
    let cur = byId.get(selectedId);
    while (cur?.parentId) {
      const parent = byId.get(cur.parentId);
      if (cur.type === "tab" && parent?.type === "tabs") {
        setActiveTab(parent.id, cur.id);
      }
      cur = parent;
    }
  }, [selectedId, widgets, setActiveTab]);

  // Shared scroll state for try mode — kept in refs so updates don't re-render
  // the whole canvas; individual TryWidget components re-render via their own state.
  const scrollMapRef    = useRef<Map<string, ScrollPos>>(new Map());
  const maxScrollMapRef = useRef<Map<string, ScrollPos>>(new Map());
  const scrollListeners = useRef<Map<string, Set<() => void>>>(new Map());

  const scrollCtxVal = React.useMemo<ScrollCtxVal>(() => ({
    getScroll:    (id) => scrollMapRef.current.get(id) ?? { x: 0, y: 0 },
    setScroll:    (id, pos) => {
      scrollMapRef.current.set(id, pos);
      scrollListeners.current.get(id)?.forEach(fn => fn());
    },
    getMaxScroll: (id) => maxScrollMapRef.current.get(id) ?? { x: 0, y: 0 },
    setMaxScroll: (id, max) => { maxScrollMapRef.current.set(id, max); },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);

  // Tracks the live in-progress drag position of a single widget so its own
  // Rnd, and any ancestor group auto-sizing to wrap it, update in real time
  // before the drag commits.
  const [draggingPos, setDraggingPos] = useState<{ id: string; x: number; y: number } | null>(null);
  const [draggingSize, setDraggingSize] = useState<{ id: string; w: number; h: number; x: number; y: number } | null>(null);
  // Alignment guides shown while dragging: center-snap lines (when the widget is
  // within snapping distance of its container's center) and the shift-lock axis
  // line (the line the widget is constrained to move along while shift is held).
  // `parentId` (null for root widgets) says which container's coordinate space
  // the guide lines are drawn in, matching where the dragged widget itself lives.
  const [dragGuides, setDragGuides] = useState<DragGuidesInfo | null>(null);
  // Live per-axis offset while a multi-selected group is being dragged together —
  // one shared delta applied to every member, analogous to `draggingPos` for a
  // single widget (see GroupSelectionOverlay / EditWidget's liveX/liveY).
  const [groupDrag, setGroupDrag] = useState<GroupDragInfo | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null); // canvas-unit coords
  // canvasRef points to the outer wrapper div so getBoundingClientRect returns the visual bounding box
  const canvasRef = useRef<HTMLDivElement>(null);

  const getWidget = (id: string) => widgets.find(w => w.id === id);

  const handleClickWidget = (clickedId: string) => {
    const changed = selectedId !== clickedId || selectedIds.length > 1;
    selectionChangedRef.current = changed;
    onSelectSingle(clickedId);
  };

  // All dragging is driven from a single listener here rather than from each
  // widget's own <Rnd>, because letting every nested Rnd manage its own drag
  // makes it impossible to redirect movement to an ancestor: react-draggable
  // doesn't stop propagation on its own (multiple ancestors would all start
  // dragging at once), and even after preventing that, a child's own Rnd has
  // no way to move a *different* (ancestor) widget instead of itself. Rnd's
  // built-in dragging is disabled everywhere (see EditWidget); this handler
  // is the sole source of drag movement, keyed to the resolved target only.
  const handleCanvasContextMenu = (e: React.MouseEvent) => {
    if (tryMode || !onAddWidget) return;
    e.preventDefault();
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = Math.max(0, Math.round((e.clientX - rect.left) / scale));
    const y = Math.max(0, Math.round((e.clientY - rect.top) / scale));
    setCtxMenu({ x, y });
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (tryMode) return;
    if (e.button !== 0) return; // ignore right/middle click — right-click is handled by contextmenu
    const eventTarget = e.target as HTMLElement;
    // Resize handles are driven by react-rnd and must not also start a move.
    if (eventTarget.closest(".canvas-resize-handle")) return;
    // Commit any active inline text edit. e.preventDefault() below suppresses the normal
    // focus-transfer that would blur the input automatically, so do it explicitly.
    if (document.activeElement instanceof HTMLInputElement) document.activeElement.blur();
    e.preventDefault(); // prevent native browser image/text drag hijacking mouse events
    setCtxMenu(null);
    // Reset selection-changed flag when a new click sequence starts (gap > 250ms = not a double-click).
    const now = Date.now();
    const gap = now - lastMousedownTimeRef.current;
    if (gap > 250) { selectionChangedRef.current = false; }
    lastMousedownTimeRef.current = now;
    const el = eventTarget.closest("[data-widget-id]");
    if (!el) { onSelectSingle(null); return; }
    const clickedId = el.getAttribute("data-widget-id")!;

    // When a group is selected from the layers tree, dragging any visible
    // descendant should move that group. Keep the actual clicked ID for a
    // simple click, so users can still select the child itself without moving.
    const selectedGroupId = selectedId && getWidget(selectedId)?.type === "group" ? selectedId : null;
    let ancestorId = getWidget(clickedId)?.parentId;
    while (ancestorId && ancestorId !== selectedGroupId) {
      ancestorId = getWidget(ancestorId)?.parentId;
    }
    const dragSelectedGroup = !!selectedGroupId && (clickedId === selectedGroupId || ancestorId === selectedGroupId);

    // Cmd/Ctrl-click: add/remove exactly the widget under the cursor from the
    // multi-selection instead of starting a drag. Deliberately does NOT use
    // resolveDragTargetId's ancestor-drill-down resolution — that logic picks
    // the outermost container on a first click, which would silently toggle
    // the wrong (parent) widget for anything nested.
    if (e.metaKey || e.ctrlKey) {
      selectionChangedRef.current = true;
      onToggleSelect(clickedId);
      return;
    }

    // Selection depends on whether this gesture turns out to be a plain
    // click or an actual drag. Dragging a selected member moves the full set.
    const targetId = dragSelectedGroup ? selectedGroupId! : clickedId;
    const isGroupMemberClick = selectedIds.length > 1 && selectedIds.includes(targetId);
    const target = getWidget(targetId);
    if (!target) return;
    const groupMembers = isGroupMemberClick ? widgets.filter(w => selectedIds.includes(w.id)) : [target];
    const selectedSet = new Set(groupMembers.map(w => w.id));
    // A selected descendant follows its selected ancestor; only move the
    // ancestor or the child would receive the same offset twice.
    const moveMembers = groupMembers.filter(w => {
      let parentId = w.parentId;
      while (parentId) {
        if (selectedSet.has(parentId)) return false;
        parentId = widgets.find(parent => parent.id === parentId)?.parentId;
      }
      return true;
    });
    const isGroupDrag = isGroupMemberClick && groupMembers.length > 1;
    const sameParent = moveMembers.every(w => w.parentId === moveMembers[0]?.parentId);
    const moveRects = new Map(moveMembers.map((w) => {
      const content = w.type === "group" ? getGroupContentBounds(w.id, widgets) : null;
      return [w.id, content
        ? { x: w.x + content.left, y: w.y + content.top, w: content.width, h: content.height }
        : { x: w.x, y: w.y, w: w.w, h: w.h }] as const;
    }));

    // Tab header buttons manage their own drag (move/resize). Canvas must not
    // move the widget, but should still handle click drill-down selection.
    const inTabHeader = !!eventTarget.closest("[data-tab-header]");

    const startClientX = e.clientX;
    const startClientY = e.clientY;
    // Alignment uses one shared coordinate space. Cross-container selections
    // still move by a shared delta but skip alignment guides.
    const bboxX = sameParent ? Math.min(...moveMembers.map(w => moveRects.get(w.id)!.x)) : moveRects.get(moveMembers[0].id)!.x;
    const bboxY = sameParent ? Math.min(...moveMembers.map(w => moveRects.get(w.id)!.y)) : moveRects.get(moveMembers[0].id)!.y;
    const bboxW = sameParent
      ? Math.max(...moveMembers.map(w => moveRects.get(w.id)!.x + moveRects.get(w.id)!.w)) - bboxX
      : moveRects.get(moveMembers[0].id)!.w;
    const bboxH = sameParent
      ? Math.max(...moveMembers.map(w => moveRects.get(w.id)!.y + moveRects.get(w.id)!.h)) - bboxY
      : moveRects.get(moveMembers[0].id)!.h;
    let moved = false;

    const snapToGrid = (v: number) => Math.round(v / snapPx) * snapPx;
    const snapBounds = sameParent
      ? computeDragBounds({ ...moveMembers[0], x: bboxX, y: bboxY, w: bboxW, h: bboxH }, widgets, width, height)
      : null;
    const memberBounds = moveMembers.map((w) => {
      const rect = moveRects.get(w.id)!;
      return computeDragBounds({ ...w, x: rect.x, y: rect.y, w: rect.w, h: rect.h }, widgets, width, height);
    });
    const minDeltaX = Math.max(...moveMembers.map(w => -moveRects.get(w.id)!.x));
    const minDeltaY = Math.max(...moveMembers.map(w => -moveRects.get(w.id)!.y));
    const maxDeltaX = Math.min(...memberBounds.map((b, i) => b.maxX - moveRects.get(moveMembers[i].id)!.x));
    const maxDeltaY = Math.min(...memberBounds.map((b, i) => b.maxY - moveRects.get(moveMembers[i].id)!.y));
    const clamp = (dx: number, dy: number) => ({
      dx: Math.max(minDeltaX, Math.min(maxDeltaX, dx)),
      dy: Math.max(minDeltaY, Math.min(maxDeltaY, dy)),
    });
    // Center-snap: while dragging, a widget (or group) that lands close to
    // horizontally or vertically centered within its parent (or the canvas,
    // for roots) snaps exactly onto that center — independently per axis.
    // dragBounds.maxX/maxY is (container size - box size), so half of it
    // is exactly the x/y at which the box sits centered in its container.
    const centerX = snapBounds ? Math.round(snapBounds.maxX / 2) : 0;
    const centerY = snapBounds ? Math.round(snapBounds.maxY / 2) : 0;
    const SNAP_THRESHOLD_PX = 4;
    // Fixed coordinate of the shift-lock axis line — the box's own center on
    // whichever axis ends up pinned, which never moves during a locked drag.
    const shiftLineX = bboxX + bboxW / 2;
    const shiftLineY = bboxY + bboxH / 2;
    const containerW = snapBounds ? snapBounds.maxX + bboxW : 0;
    const containerH = snapBounds ? snapBounds.maxY + bboxH : 0;
    // Sibling alignment: snap to other widgets under the same parent (excluding
    // the dragged group itself), matching left/center/right edges (x) and
    // top/center/bottom edges (y) independently.
    const groupIds = new Set(groupMembers.map(w => w.id));
    const siblings = sameParent && snapToSiblings
      ? widgets.filter(w => w.parentId === moveMembers[0].parentId && !groupIds.has(w.id)).map((w) => {
        const content = w.type === "group" ? getGroupContentBounds(w.id, widgets) : null;
        return content ? { ...w, x: w.x + content.left, y: w.y + content.top, w: content.width, h: content.height } : w;
      })
      : [];
    // Shift: lock movement to whichever axis has moved further, keeping the
    // other axis pinned to its original value (as in most design tools).
    const resolveTarget = (ev: MouseEvent) => {
      let rawDx = ev.clientX - startClientX;
      let rawDy = ev.clientY - startClientY;
      let shiftAxis: "horizontal" | "vertical" | null = null;
      if (ev.shiftKey) {
        if (Math.abs(rawDx) >= Math.abs(rawDy)) { rawDy = 0; shiftAxis = "horizontal"; }
        else { rawDx = 0; shiftAxis = "vertical"; }
      }
      if (!sameParent) {
        return {
          dx: snapToGrid(rawDx / scale), dy: snapToGrid(rawDy / scale),
          vCenter: false, hCenter: false, shiftAxis, siblingLines: [],
        };
      }
      let nx = snapToGrid(bboxX + rawDx / scale);
      let ny = snapToGrid(bboxY + rawDy / scale);
      const siblingLines: AlignmentLine[] = [];
      // Sibling edge/center alignment takes priority over parent-center snap,
      // since it's the more specific match; each axis resolves independently.
      const xAlign = findAxisAlignment(nx, bboxW, ny, bboxH, siblings, "x", SNAP_THRESHOLD_PX);
      const yAlign = findAxisAlignment(ny, bboxH, nx, bboxW, siblings, "y", SNAP_THRESHOLD_PX);
      let vCenter = false;
      let hCenter = false;
      if (xAlign) {
        nx = xAlign.value;
        siblingLines.push({ axis: "v", pos: xAlign.guidePos, from: xAlign.guideFrom, to: xAlign.guideTo });
      } else if (snapToParent && snapBounds) {
        vCenter = Math.abs(nx - centerX) <= SNAP_THRESHOLD_PX;
        if (vCenter) nx = centerX;
      }
      if (yAlign) {
        ny = yAlign.value;
        siblingLines.push({ axis: "h", pos: yAlign.guidePos, from: yAlign.guideFrom, to: yAlign.guideTo });
      } else if (snapToParent && snapBounds) {
        hCenter = Math.abs(ny - centerY) <= SNAP_THRESHOLD_PX;
        if (hCenter) ny = centerY;
      }
      return { dx: nx - bboxX, dy: ny - bboxY, vCenter, hCenter, shiftAxis, siblingLines };
    };
    const onMove = (ev: MouseEvent) => {
      if (inTabHeader) {
        // Track movement so a drag doesn't trigger click-selection on mouseup,
        // but let the tab's own drag handler move the widget.
        if (Math.abs(ev.clientX - startClientX) > 2 || Math.abs(ev.clientY - startClientY) > 2) moved = true;
        return;
      }
      const { dx, dy, vCenter, hCenter, shiftAxis, siblingLines } = resolveTarget(ev);
      if (dx === 0 && dy === 0 && !shiftAxis) return;
      if (!moved) {
        moved = true;
        // A plain drag starts a fresh selection; a selected-member drag keeps
        // the full multi-selection active.
        if (isGroupDrag) onSelect(targetId);
        else onSelectSingle(targetId);
      }
      const clamped = clamp(dx, dy);
      if (isGroupDrag) {
        setGroupDrag({ ids: moveMembers.map(w => w.id), dx: clamped.dx, dy: clamped.dy });
      } else {
        setDraggingPos({ id: targetId, x: target.x + clamped.dx, y: target.y + clamped.dy });
      }
      setDragGuides(sameParent ? {
        parentId: moveMembers[0].parentId ?? null,
        containerW, containerH,
        vCenter, hCenter, shiftAxis,
        shiftX: shiftLineX, shiftY: shiftLineY,
        siblingLines,
      } : null);
    };
    const onUp = (ev: MouseEvent) => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      if (moved && !inTabHeader) {
        const { dx, dy } = resolveTarget(ev);
        const clamped = clamp(dx, dy);
        if (isGroupDrag) {
          onUpdateWidgets(moveMembers.map(w => ({ ...w, x: w.x + clamped.dx, y: w.y + clamped.dy })));
        } else {
          onUpdateWidget({ ...target, x: target.x + clamped.dx, y: target.y + clamped.dy });
        }
      } else if (!moved) {
        if (inTabHeader) {
          // Tab header buttons map 1:1 to tab widgets — select directly, no drill-down.
          selectionChangedRef.current = true;
          onSelectSingle(clickedId);
        } else if (e.shiftKey) {
          onToggleSelect(clickedId);
        } else {
          // A plain click selects the widget under the pointer and clears the old set.
          handleClickWidget(clickedId);
        }
      }
      // inTabHeader && moved: tab drag handled its own commit, nothing to do here.
      setDraggingPos(null);
      setDragGuides(null);
      setGroupDrag(null);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return (
    // Outer wrapper: holds the visual layout space (cssWidth × cssHeight CSS px)
    // and owns the event handlers so getBoundingClientRect gives the correct visual box.
    <div
      ref={canvasRef}
      data-canvas
      style={{
        width: cssWidth,
        height: cssHeight,
        flexShrink: 0,
        boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
        cursor: tryMode ? "default" : undefined,
      }}
      onMouseDown={handleCanvasMouseDown}
      onContextMenu={handleCanvasContextMenu}
    >
      {/* Inner canvas: renders at 1px = 1 MC pixel; CSS transform scales to fill the wrapper */}
      <div style={{
        position: "relative",
        width,
        height,
        transform: `scale(${scale})`,
        transformOrigin: "top left",
        imageRendering: "pixelated",
      }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={WORLD_IMAGE_URL}
          alt=""
          draggable={false}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none", zIndex: 0 }}
        />
        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.48)", pointerEvents: "none", zIndex: 1 }} />

        {gridDataUrl && (
          <div style={{
            position: "absolute", inset: 0,
            backgroundImage: `url("${gridDataUrl}")`,
            backgroundSize: `${snapPx}px ${snapPx}px`,
            pointerEvents: "none", zIndex: 1, opacity: 0.4,
          }} data-export-ignore />
        )}

        {dragGuides && dragGuides.parentId === null && <GuideLines {...dragGuides} />}
        {!tryMode && <GroupSelectionOverlay canvasRef={canvasRef} selectedIds={selectedIds} scale={scale} groupDrag={groupDrag} />}

        <SelectionChangedCtx.Provider value={selectionChangedRef}>
        <ActiveTabCtx.Provider value={React.useMemo(() => ({ activeTabIds, setActiveTab }), [activeTabIds, setActiveTab])}>
        <BindingsCtx.Provider value={bindingsSchema}>
        {tryMode && <ScrollCtx.Provider value={scrollCtxVal}>
          {rootWidgets.map((widget, idx) =>
            <TryWidgetRoot key={widget.id} widget={widget} scale={scale} childMap={childMap} zBase={idx + 2} allWidgets={widgets} scrollListeners={scrollListeners.current} />
          )}
        </ScrollCtx.Provider>}
          <AllWidgetsCtx.Provider value={widgets}>
          <UpdateWidgetsCtx.Provider value={onUpdateWidgets}>
          <UpdateWidgetCtx.Provider value={onUpdateWidget}>
            {rootWidgets.map((widget, idx) =>
              tryMode ? null
                : (
                  <EditWidget
                    key={widget.id}
                    widget={widget}
                    scale={scale}
                    selectedId={selectedId}
                    selectedIds={selectedIds}
                    snapPx={snapPx}
                    draggingPos={draggingPos}
                    draggingSize={draggingSize}
                    setDraggingSize={setDraggingSize}
                    dragGuides={dragGuides}
                    groupDrag={groupDrag}
                    onResizeCommit={onUpdateWidget}
                    childMap={childMap}
                    zBase={idx + 2}
                  />
                )
            )}
          </UpdateWidgetCtx.Provider>
          </UpdateWidgetsCtx.Provider>
          </AllWidgetsCtx.Provider>
        </BindingsCtx.Provider>
        </ActiveTabCtx.Provider>
        </SelectionChangedCtx.Provider>

        {ctxMenu && onAddWidget && (
          <CanvasContextMenu
            x={ctxMenu.x}
            y={ctxMenu.y}
            scale={scale}
            onAdd={(type) => { onAddWidget(type, ctxMenu.x, ctxMenu.y); setCtxMenu(null); }}
            onClose={() => setCtxMenu(null)}
          />
        )}
      </div>
    </div>
  );
}

function buildChildMap(widgets: WidgetSpec[]): Map<string, WidgetSpec[]> {
  const map = new Map<string, WidgetSpec[]>();
  for (const w of widgets) {
    if (w.parentId) {
      const arr = map.get(w.parentId) ?? [];
      arr.push(w);
      map.set(w.parentId, arr);
    }
  }
  return map;
}

// ── Edit mode widget ──────────────────────────────────────────────────────────

function getGroupContentBounds(groupId: string, widgets: WidgetSpec[]) {
  const childrenByParent = new Map<string, WidgetSpec[]>();
  for (const widget of widgets) {
    if (!widget.parentId) continue;
    const siblings = childrenByParent.get(widget.parentId) ?? [];
    siblings.push(widget);
    childrenByParent.set(widget.parentId, siblings);
  }

  const boxes: Array<{ x: number; y: number; right: number; bottom: number }> = [];
  const visit = (parentId: string, parentX: number, parentY: number) => {
    for (const child of childrenByParent.get(parentId) ?? []) {
      if (child.hidden) continue;
      const x = parentX + child.x;
      const y = parentY + child.y;
      if (child.type !== "group") {
        const size = child.type === "inventory_area" ? getInventoryAreaSize(child.props) : child;
        boxes.push({ x, y, right: x + size.w, bottom: y + size.h });
      }
      visit(child.id, x, y);
    }
  };
  visit(groupId, 0, 0);
  if (boxes.length === 0) return null;

  const left = Math.min(...boxes.map((box) => box.x));
  const top = Math.min(...boxes.map((box) => box.y));
  const right = Math.max(...boxes.map((box) => box.right));
  const bottom = Math.max(...boxes.map((box) => box.bottom));
  return { left, top, width: right - left, height: bottom - top };
}

function EditWidget({ widget, scale, selectedId, selectedIds, snapPx, draggingPos, draggingSize, setDraggingSize, dragGuides, groupDrag, onResizeCommit, childMap, zBase }: {
  widget: WidgetSpec;
  scale: number;
  selectedId: string | null;
  selectedIds: string[];
  snapPx: number;
  draggingPos: { id: string; x: number; y: number } | null;
  draggingSize: { id: string; w: number; h: number; x: number; y: number } | null;
  setDraggingSize: (v: { id: string; w: number; h: number; x: number; y: number } | null) => void;
  dragGuides: DragGuidesInfo | null;
  groupDrag: GroupDragInfo | null;
  onResizeCommit: (widget: WidgetSpec) => void;
  childMap: Map<string, WidgetSpec[]>;
  zBase: number;
}) {
  const bindingsSchema = useContext(BindingsCtx);
  const allWidgets = useContext(AllWidgetsCtx);
  const selectionChangedRef = useContext(SelectionChangedCtx);
  const { textures: editTextures } = useTextures();
  const tex = (name: string) => (editTextures as Record<string, string>)[name];
  const { widget: previewWidget, hidden } = applyBindingPreviews(widget, bindingsSchema);
  // Part of an active multi-selection: suppress this widget's own outline/resize
  // handles (see below) in favor of the single group bounding-box overlay.
  const isGroupMember = selectedIds.length > 1 && selectedIds.includes(widget.id);
  const isSelected = widget.id === selectedId && !isGroupMember;
  const isContainer = CONTAINER_TYPES.has(widget.type);
  const children = isContainer ? (childMap.get(widget.id) ?? []) : [];
  const clips = false;
  const isGroup = widget.type === "group";
  const groupContentBounds = isGroup && (isSelected || isGroupMember)
    ? getGroupContentBounds(widget.id, allWidgets)
    : null;
  const isTabs = widget.type === "tabs";

  // Preview-only: which of this `tabs` widget's `tab` children is shown on the canvas right now.
  // Not persisted — a designer convenience for previewing content that's otherwise hidden,
  // mirroring how SpecScreen picks a default active tab at runtime.
  const tabChildren = isTabs ? children.filter((c) => c.type === "tab" && isConditionallyVisible(c, bindingsSchema)) : [];
  const tabHeaderHeight = isTabs ? parseInt(widget.props.tab_height ?? "20", 10) : 0;
  const { activeTabIds, setActiveTab } = useContext(ActiveTabCtx);
  const storedTabId = isTabs ? (activeTabIds.get(widget.id) ?? null) : null;
  const activeTabId = storedTabId && tabChildren.some((t) => t.id === storedTabId)
    ? storedTabId
    : tabChildren[0]?.id ?? null;
  const setPreviewTabId = (id: string) => setActiveTab(widget.id, id);

  const activeTabChildren = activeTabId ? (childMap.get(activeTabId) ?? []) : [];

  // Tab move/resize (edit mode only)
  const updateWidget = useContext(UpdateWidgetCtx);
  const updateWidgets = useContext(UpdateWidgetsCtx);

  // Inline text editing — double-click any widget or tab button to edit its text in-place
  const [inlineEdit, setInlineEdit] = useState<{ id: string; text: string } | null>(null);
  const inlineInputRef = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => { if (inlineEdit) inlineInputRef.current?.select(); }, [inlineEdit?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const commitInlineEdit = React.useCallback((draft: string) => {
    setInlineEdit(null);
    if (!inlineEdit) return;
    if (inlineEdit.id === widget.id) {
      updateWidget({ ...widget, text: draft });
    } else {
      const tab = tabChildren.find(t => t.id === inlineEdit.id);
      if (tab) updateWidget({ ...tab, text: draft });
    }
  }, [inlineEdit, widget, tabChildren, updateWidget]); // eslint-disable-line react-hooks/exhaustive-deps
  const [tabDrag, setTabDrag] = useState<TabDrag | null>(null);
  const tabDragRef = useRef(tabDrag);
  tabDragRef.current = tabDrag;
  const tabChildrenRef = useRef(tabChildren);
  tabChildrenRef.current = tabChildren;
  const scaleRef = useRef(scale);
  scaleRef.current = scale;

  const handleVisual = (
    <div style={{
      width: 8, height: 8,
      transform: `scale(${1 / scale})`,
      background: "#fff",
      border: `1.5px solid ${SELECTION_COLOR}`,
      borderRadius: 1.5,
      boxShadow: "0 0 0 1px rgba(0,0,0,0.25)",
      pointerEvents: "none",
    }} />
  );
  const resizeHandleComponent: Record<string, React.ReactElement> = {
    top: handleVisual, bottom: handleVisual,
    left: handleVisual, right: handleVisual,
    topLeft: handleVisual, topRight: handleVisual,
    bottomLeft: handleVisual, bottomRight: handleVisual,
  };

  // Modifier keys for resize: shift = lock aspect ratio, alt = center origin
  const [shiftPressed, setShiftPressed] = useState(false);
  const [altPressed, setAltPressed] = useState(false);
  React.useEffect(() => {
    if (!isSelected) return;
    const onKey = (e: KeyboardEvent) => { setShiftPressed(e.shiftKey); setAltPressed(e.altKey); };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("keyup", onKey); };
  }, [isSelected]);
  // Capture start dimensions for alt center-origin and shift aspect-ratio calculations
  const resizeStartRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  // Stash last alt-adjusted commit values so onResizeStop reads them even after re-resizable resets the DOM
  const altResizeRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  // The wrapper's CSS translate at resize-start, in MC pixel space (inner canvas coords).
  const resizeInitTransformRef = useRef<{ x: number; y: number } | null>(null);
  // Ref to the Rnd instance so we can repair its internal offsetFromParent after alt resize.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rndRef = useRef<any>(null);

  // Tab drag — handled via useEffect (started from resize/move handle's onMouseDown)
  React.useEffect(() => {
    if (!tabDrag) return;
    const onMove = (e: MouseEvent) => {
      const d = tabDragRef.current;
      if (!d) return;
      const delta = Math.round((e.clientX - d.startMouseX) / scaleRef.current);
      const tab = tabChildrenRef.current.find(t => t.id === d.id);
      if (!tab) return;
      if (d.type === "move") {
        updateWidget({ ...tab, x: Math.max(d.minX, Math.min(d.maxX, d.startX + delta)) });
      } else if (d.type === "resize-right") {
        updateWidget({ ...tab, w: Math.max(d.minW, Math.min(d.maxW, d.startW + delta)) });
      } else {
        const newW = Math.max(d.minW, Math.min(d.maxW, d.startW - delta));
        updateWidget({ ...tab, x: d.startX + d.startW - newW, w: newW });
      }
    };
    const onUp = () => {
      const d = tabDragRef.current;
      if (d?.type === "move") {
        // Sort all sibling tabs by their current committed x, then redistribute
        // positions so there are no overlaps or gaps between them.
        const gap = widget.parentId ? NESTED_TAB_GAP : TAB_GAP;
        const sorted = [...tabChildrenRef.current].sort((a, b) => a.x - b.x);
        let cursor = 0;
        const reordered = sorted.map(t => {
          const x = cursor;
          cursor += t.w + gap;
          return { ...t, x };
        });
        updateWidgets(reordered);
      }
      setTabDrag(null);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabDrag !== null]);


  // Live drag position substitution: this widget itself may be the current
  // drag target (position moves live before the drag commits)...
  const liveX = draggingPos?.id === widget.id ? draggingPos.x : draggingSize?.id === widget.id ? draggingSize.x : groupDrag?.ids.includes(widget.id) ? widget.x + groupDrag.dx : widget.x;
  const liveY = draggingPos?.id === widget.id ? draggingPos.y : draggingSize?.id === widget.id ? draggingSize.y : groupDrag?.ids.includes(widget.id) ? widget.y + groupDrag.dy : widget.y;

  // ...or, for groups, one of its children may be, which changes auto-size.
  const inventoryAreaSize = widget.type === "inventory_area" ? getInventoryAreaSize(widget.props) : null;
  const renderW = isGroup && children.length > 0
    ? Math.max(...children.map(c => (draggingPos?.id === c.id ? draggingPos.x : c.x) + (c.type === "inventory_area" ? getInventoryAreaSize(c.props).w : c.w)))
    : inventoryAreaSize?.w ?? (draggingSize?.id === widget.id ? draggingSize.w : widget.w);
  const renderH = isGroup && children.length > 0
    ? Math.max(...children.map(c => (draggingPos?.id === c.id ? draggingPos.y : c.y) + (c.type === "inventory_area" ? getInventoryAreaSize(c.props).h : c.h)))
    : inventoryAreaSize?.h ?? (draggingSize?.id === widget.id ? draggingSize.h : widget.h);

  const resizeBounds = computeResizeBounds(widget, allWidgets);

  if (widget.hidden) return null;

  return (
    <Rnd
      ref={rndRef}
      scale={scale}
      position={{ x: liveX, y: liveY }}
      size={{
        width:  widget.type === "scrollbar" && (widget.props.axis ?? "y") === "y" ? SCROLLBAR_FIXED_PX : renderW,
        height: widget.type === "scrollbar" && (widget.props.axis ?? "y") === "x" ? SCROLLBAR_FIXED_PX : renderH,
      }}
      minWidth={
        widget.type === "scrollbar" && (widget.props.axis ?? "y") === "y" ? SCROLLBAR_FIXED_PX :
        isTabs ? tabsMinWidth(children.filter(c => c.type === "tab")) :
        undefined
      }
      maxWidth={widget.type === "scrollbar" && (widget.props.axis ?? "y") === "y" ? SCROLLBAR_FIXED_PX : undefined}
      minHeight={widget.type === "scrollbar" && widget.props.axis === "x" ? SCROLLBAR_FIXED_PX : undefined}
      maxHeight={widget.type === "scrollbar" && widget.props.axis === "x" ? SCROLLBAR_FIXED_PX : undefined}
      resizeGrid={[snapPx, snapPx]}
      lockAspectRatio={shiftPressed && isSelected && !isGroup && widget.type !== "scrollbar"}
      // All dragging is handled centrally by Canvas's own mousedown listener
      // (see handleCanvasMouseDown) — it can redirect movement to an
      // ancestor widget, which react-rnd's own per-node dragging cannot do.
      disableDragging
      data-widget-id={widget.id}
      onResizeStart={() => {
        resizeStartRef.current = { x: widget.x, y: widget.y, w: widget.w, h: widget.h };
        altResizeRef.current = null;
        resizeInitTransformRef.current = null; // captured on first onResize
      }}
      onResize={(e, dir, ref, delta, position) => {
        if (!resizeStartRef.current) return;
        // react-draggable applies its transform directly on `ref` via React.cloneElement —
        // there is no separate wrapper div. Capture the transform from ref itself.
        // With scale={scale} on Rnd, delta values are already in MC pixel units.
        if (!resizeInitTransformRef.current) {
          const m = /translate\(([^,]+)px,\s*([^)]+)px\)/.exec(ref.style.transform);
          resizeInitTransformRef.current = m
            ? { x: parseFloat(m[1]), y: parseFloat(m[2]) }
            : { x: 0, y: 0 };
        }
        const initT = resizeInitTransformRef.current;
        const start = resizeStartRef.current;
        // re-resizable's resizeGrid snaps the element's absolute size to grid multiples even on
        // the axis that isn't being dragged, so delta for the cross-axis is non-zero. Clamp it.
        const dw = (dir === "top" || dir === "bottom") ? 0 : delta.width;
        const dh = (dir === "left" || dir === "right") ? 0 : delta.height;
        if ((e as MouseEvent).altKey) {
          // Alt: resize symmetrically from the original center.
          // delta.{width,height} is the one-sided MC pixel change from react-rnd (already divided by scale).
          // We double it so both sides expand equally; shift the element by one
          // delta in MC pixel space so the center stays fixed.
          const altW = Math.max(1, start.w + 2 * dw);
          const altH = Math.max(1, start.h + 2 * dh);
          const altTX = initT.x - dw;
          const altTY = initT.y - dh;
          ref.style.width     = `${altW}px`;
          ref.style.height    = `${altH}px`;
          ref.style.transform = `translate(${altTX}px, ${altTY}px)`;
          altResizeRef.current = {
            x: Math.max(0, Math.round(start.x - dw)),
            y: Math.max(0, Math.round(start.y - dh)),
            w: Math.max(1, Math.round(altW)),
            h: Math.max(1, Math.round(altH)),
          };
          // Update w/h so Rnd's controlled size prop stays in sync — re-resizable resets to
          // props.size on mouseUp, so without this the widget snaps back to its original size.
          // We keep x/y at widget.x/y (original position) to avoid touching the draggable's
          // position tracking; the visual position shift is handled by ref.style.transform above.
          // (delta is computed from original.width captured at onResizeStart, not from the
          // controlled size, so updating the size prop here does not corrupt delta accumulation.)
          setDraggingSize({ id: widget.id, x: widget.x, y: widget.y, w: altResizeRef.current.w, h: altResizeRef.current.h });
        } else {
          if (altResizeRef.current !== null) {
            // Alt released mid-drag: restore ref to the resize-start transform so the
            // widget snaps back to its natural position cleanly.
            ref.style.transform = `translate(${initT.x}px, ${initT.y}px)`;
            altResizeRef.current = null;
          }
          // Use start + clamped delta instead of ref.style to avoid resizeGrid snapping the
          // cross-axis dimension (e.g. height snapping to grid when only width is resized).
          setDraggingSize({
            id: widget.id,
            x: Math.max(0, Math.round(position.x)),
            y: Math.max(0, Math.round(position.y)),
            w: Math.max(1, start.w + dw),
            h: Math.max(1, start.h + dh),
          });
        }
      }}
      onResizeStop={(_e, dir, ref, delta, position) => {
        setDraggingSize(null);
        const start = resizeStartRef.current;
        const dw = (dir === "top" || dir === "bottom") ? 0 : delta.width;
        const dh = (dir === "left" || dir === "right") ? 0 : delta.height;
        let x: number;
        let y: number;
        let w: number;
        let h: number;
        if (altResizeRef.current) {
          // Use the alt-adjusted values from the last onResize call.
          ({ x, y, w, h } = altResizeRef.current);
          // Repair react-rnd's internal offsetFromParent, which was corrupted by our
          // ref.style.transform overrides during the alt resize preview. At this point
          // ref.style.transform = translate(x, y) (set in the final onResize call), so
          // resetting offsetFromParent to zero is correct: the element is visually at x/y,
          // and draggable.state still holds the original position, so resetting the offset
          // makes the controlled position prop (liveX=x after commit) map directly to the
          // draggable position without any phantom shift.
          if (rndRef.current) {
            rndRef.current.offsetFromParent = { left: 0, top: 0 };
          }
        } else {
          // position.x/y is from react-rnd (already in MC pixels with scale applied).
          // Use start + clamped delta for w/h to avoid resizeGrid snapping the cross-axis.
          x = Math.max(0, Math.round(position.x));
          y = Math.max(0, Math.round(position.y));
          w = start ? Math.max(1, start.w + dw) : Math.max(1, Math.round(parseInt(ref.style.width)));
          h = start ? Math.max(1, start.h + dh) : Math.max(1, Math.round(parseInt(ref.style.height)));
        }
        // Clamp to parent container's content area.
        // Re-anchor to the committed (x, y): alt resize and left/top handle resizes shift the
        // widget's position, so the precomputed bounds (based on widget.x/y) are too narrow.
        if (resizeBounds) {
          const parentW = resizeBounds.maxW + widget.x;
          const parentH = resizeBounds.maxH + widget.y;
          w = Math.min(w, parentW - x);
          h = Math.min(h, parentH - y);
        }
        // Scrollbar: lock the cross-axis to the handle texture width (12px + 2px bevel = 14)
        if (widget.type === "scrollbar") {
          const axis = widget.props.axis ?? "y";
          if (axis === "y") w = SCROLLBAR_FIXED_PX;
          else              h = SCROLLBAR_FIXED_PX;
        }
        resizeStartRef.current = null;
        altResizeRef.current = null;
        if (x === widget.x && y === widget.y && w === widget.w && h === widget.h) return;
        // For tabs: commit container + reflowed tab children in one atomic update
        if (isTabs) {
          const tabGap = widget.parentId ? NESTED_TAB_GAP : TAB_GAP;
          const tabKids = children.filter(c => c.type === "tab");
          const { allDefault, tabs: rawTabs } = computeTabLayout(tabKids, w, tabGap);
          const reflowedTabs = !allDefault ? reflowTabsForWidth(rawTabs, w, tabGap) : rawTabs;
          const movedTabs = reflowedTabs
            .filter((rt, i) => rt.x !== rawTabs[i].x)
            .map(rt => ({ ...rt.tab, x: rt.x }));
          updateWidgets([{ ...widget, x, y, w, h }, ...movedTabs]);
        } else {
          onResizeCommit({ ...widget, x, y, w, h });
        }
      }}
      onDoubleClick={(e: React.MouseEvent) => {
        if (isTabs) return; // tabs: double-click handled per tab button below
        if (!isSelected) return; // must be already selected to enter text edit
        if (selectionChangedRef.current) return; // selection was just established this click sequence
        const EDITABLE = new Set(["label", "button", "toggle_button", "checkbox", "slider", "input"]);
        if (!EDITABLE.has(widget.type)) return;
        e.stopPropagation();
        setInlineEdit({ id: widget.id, text: widget.text });
      }}
      style={{
        outline: isGroup
          ? (!groupContentBounds && (isSelected || isGroupMember)
            ? isGroupMember ? `2px dashed ${MULTI_SELECTION_COLOR}` : SELECTION_OUTLINE
            : "none")
          : isGroupMember
            ? `2px dashed ${MULTI_SELECTION_COLOR}`
            : isSelected ? SELECTION_OUTLINE : "none",
        outlineOffset: 1,
        zIndex: zBase,
        // Groups have no visible surface. Let clicks pass through their empty
        // auto-sized wrapper to the actual widget underneath; child widgets
        // explicitly opt back into pointer events below.
        pointerEvents: isGroup ? "none" : "auto",
        cursor: "move",
        opacity: hidden ? 0.25 : 1,
      }}
      enableResizing={isSelected && !isGroup && widget.type !== "scrollbar" && widget.type !== "inventory_area"
        ? true
        : isSelected && widget.type === "scrollbar"
          ? (widget.props.axis ?? "y") === "y"
            ? { top: true, bottom: true, topLeft: false, topRight: false, bottomLeft: false, bottomRight: false, left: false, right: false }
            : { left: true, right: true, topLeft: false, topRight: false, bottomLeft: false, bottomRight: false, top: false, bottom: false }
          : false
      }
      resizeHandleStyles={isSelected ? RESIZE_HANDLE_STYLES : undefined}
      resizeHandleClasses={isSelected ? RESIZE_HANDLE_CLASSES : undefined}
      resizeHandleComponent={isSelected ? resizeHandleComponent : undefined}
    >
      {!isTabs && <WidgetVisual widget={draggingSize?.id === widget.id ? { ...previewWidget, w: draggingSize.w, h: draggingSize.h } : previewWidget} scale={scale} interactState="idle" />}
      {groupContentBounds && (
        <div
          data-export-ignore
          style={{
            position: "absolute",
            left: groupContentBounds.left,
            top: groupContentBounds.top,
            width: groupContentBounds.width,
            height: groupContentBounds.height,
            outline: isGroupMember ? `2px dashed ${MULTI_SELECTION_COLOR}` : SELECTION_OUTLINE,
            outlineOffset: 1,
            pointerEvents: "none",
            zIndex: 900,
          }}
        />
      )}
      {inlineEdit?.id === widget.id && (() => {
        // Mirror WidgetVisual's text alignment and padding so the edit position matches display.
        const align = widget.type === "label"
          ? (widget.props.align === "center" ? "center" : widget.props.align === "right" ? "right" : "left")
          : "center";
        return (
          <input
            ref={inlineInputRef}
            defaultValue={inlineEdit.text}
            onBlur={(e) => commitInlineEdit(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.currentTarget.blur(); }
              if (e.key === "Escape") { setInlineEdit(null); }
              e.stopPropagation();
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "absolute", inset: 0,
              background: "rgba(0,0,0,0.75)",
              color: "#fff",
              border: "2px solid #ff0",
              outline: "none",
              fontSize: 7,
              fontFamily: '"Minecraft", monospace',
              paddingLeft: "2px", paddingRight: "2px",
              textAlign: align,
              width: "100%", height: "100%",
              boxSizing: "border-box",
              zIndex: 100,
            }}
          />
        );
      })()}
      {isContainer && !isTabs && (
        <div style={{
          position: "absolute",
          inset: 0,
          overflow: clips ? "hidden" : "visible",
        }}>
          {dragGuides && dragGuides.parentId === widget.id && <GuideLines {...dragGuides} />}
          {children.map((child, idx) => (
            <EditWidget
              key={child.id}
              widget={child}
              scale={scale}
              selectedId={selectedId}
              selectedIds={selectedIds}
              snapPx={snapPx}
              draggingPos={draggingPos}
              draggingSize={draggingSize}
              setDraggingSize={setDraggingSize}
              dragGuides={dragGuides}
              groupDrag={groupDrag}
              onResizeCommit={onResizeCommit}
              childMap={childMap}
              zBase={idx + 1}
            />
          ))}
        </div>
      )}
      {isTabs && !widget.parentId && (
        <TabsTopEditHeader
          widget={widget}
          tabChildren={tabChildren}
          tex={tex}
          activeTabId={activeTabId}
          tabDrag={tabDrag}
          setTabDrag={setTabDrag}
          updateWidgets={updateWidgets}
          inlineEdit={inlineEdit}
          setInlineEdit={setInlineEdit}
          inlineInputRef={inlineInputRef}
          commitInlineEdit={commitInlineEdit}
          setPreviewTabId={setPreviewTabId}
          tabHeaderHeight={tabHeaderHeight}
          scale={scale}
          selectedId={selectedId}
          selectedIds={selectedIds}
          selectionChangedRef={selectionChangedRef}
          snapPx={snapPx}
          draggingPos={draggingPos}
          draggingSize={draggingSize}
          setDraggingSize={setDraggingSize}
          dragGuides={dragGuides}
          groupDrag={groupDrag}
          onResizeCommit={onResizeCommit}
          childMap={childMap}
          activeTabChildren={activeTabChildren}
          EditWidget={EditWidget}
        />
      )}
      {isTabs && !!widget.parentId && (
        <TabsNestedEditHeader
          widget={widget}
          tabChildren={tabChildren}
          tex={tex}
          activeTabId={activeTabId}
          inlineEdit={inlineEdit}
          setInlineEdit={setInlineEdit}
          inlineInputRef={inlineInputRef}
          commitInlineEdit={commitInlineEdit}
          setPreviewTabId={setPreviewTabId}
          tabHeaderHeight={tabHeaderHeight}
          scale={scale}
          selectedId={selectedId}
          selectedIds={selectedIds}
          selectionChangedRef={selectionChangedRef}
          snapPx={snapPx}
          draggingPos={draggingPos}
          draggingSize={draggingSize}
          setDraggingSize={setDraggingSize}
          dragGuides={dragGuides}
          groupDrag={groupDrag}
          onResizeCommit={onResizeCommit}
          childMap={childMap}
          activeTabChildren={activeTabChildren}
          EditWidget={EditWidget}
        />
      )}
    </Rnd>
  );
}

function TryWidgetRoot(props: { widget: WidgetSpec; scale: number; childMap: Map<string, WidgetSpec[]>; zBase: number; allWidgets: WidgetSpec[]; scrollListeners: Map<string, Set<() => void>> }) {
  const { textures } = useTextures();
  const { widget, scale, zBase, allWidgets } = props;
  const bindingsSchema = useContext(BindingsCtx);

  // Wire up scroll listeners to context so TryScrollbar re-renders when inventory scrolls
  const scrollCtx = React.useContext(ScrollCtx);
  React.useEffect(() => {
    const ctx = scrollCtx as unknown as { _listeners?: Map<string, Set<() => void>> };
    if (!ctx._listeners) ctx._listeners = new Map();
    // Patch setScroll to also fire _listeners
    const origSet = scrollCtx.setScroll.bind(scrollCtx);
    (scrollCtx as unknown as { setScroll: typeof origSet }).setScroll = (id, pos) => {
      origSet(id, pos);
      ctx._listeners?.get(id)?.forEach(fn => fn());
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Not rendered at all when conditionally invisible — mirrors the runtime's SpecWidgetBuilder,
  // which excludes such widgets from the actual added-widget list (e.g. reclaiming a hidden tab's space).
  if (widget.hidden || !isConditionallyVisible(widget, bindingsSchema)) return null;

  const extScrollbarY = allWidgets.find(w => w.type === "scrollbar" && w.props.target === widget.id && (w.props.axis ?? "y") === "y");
  const extScrollbarX = allWidgets.find(w => w.type === "scrollbar" && w.props.target === widget.id && w.props.axis === "x");

  return (
    <TextureCtx.Provider value={{ textures: textures as Record<string, string> }}>
      {widget.type === "inventory_area"
        ? <InventoryAreaTry widget={widget} scale={scale} zBase={zBase} externalScrollbarIdY={extScrollbarY?.id} externalScrollbarIdX={extScrollbarX?.id} />
        : widget.type === "scrollbar"
          ? <ScrollbarTry widget={widget} scale={scale} zBase={zBase} />
          : <TryWidget widget={widget} scale={scale} childMap={props.childMap} zBase={zBase} allWidgets={allWidgets} />}
    </TextureCtx.Provider>
  );
}

// ── Try mode widget ───────────────────────────────────────────────────────────

function TryWidget({ widget, scale, childMap, zBase, allWidgets }: {
  widget: WidgetSpec;
  scale: number;
  childMap: Map<string, WidgetSpec[]>;
  zBase: number;
  allWidgets: WidgetSpec[];
}) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [toggled, setToggled] = useState(false);
  const [sliderVal, setSliderVal] = useState(() => parseFloat(widget.props.value ?? "50"));
  const [inputVal, setInputVal] = useState(widget.props.default_text ?? "");
  const [focused, setFocused] = useState(false);
  const trackRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const { textures: tryTextures } = React.useContext(TextureCtx);
  const tex = (name: string) => (tryTextures as Record<string, string>)[name];

  const isContainer = CONTAINER_TYPES.has(widget.type);
  const children = isContainer ? (childMap.get(widget.id) ?? []) : [];
  const clips = false;
  const isTabs = widget.type === "tabs";
  const bindingsSchema = useContext(BindingsCtx);
  const tabChildren = isTabs ? children.filter((c) => c.type === "tab" && !c.hidden && isConditionallyVisible(c, bindingsSchema)) : [];
  const tabHeaderHeight = isTabs ? parseInt(widget.props.tab_height ?? "20", 10) : 0;
  const { activeTabIds, setActiveTab } = useContext(ActiveTabCtx);
  const storedTryTabId = isTabs ? (activeTabIds.get(widget.id) ?? null) : null;
  const resolvedTabId = storedTryTabId && tabChildren.some((t) => t.id === storedTryTabId)
    ? storedTryTabId
    : tabChildren[0]?.id ?? null;
  const activeTabChildren = resolvedTabId ? (childMap.get(resolvedTabId) ?? []) : [];

  const isToggle = widget.type === "toggle_button" || widget.type === "checkbox";
  const isSlider = widget.type === "slider";
  const isInput = widget.type === "input";
  const isPassive = widget.type === "panel" || widget.type === "group"
    || widget.type === "label" || widget.type === "icon" || widget.type === "tabs"
    || widget.type === "player_preview";
  const interactState = pressed ? "pressed" : (isInput ? focused : hovered) ? "hovered" : "idle";

  const handleSliderPointer = (e: React.PointerEvent) => {
    if (!isSlider || !trackRef.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const update = (ev: React.PointerEvent) => {
      const rect = trackRef.current!.getBoundingClientRect();
      const min = parseFloat(widget.props.min ?? "0");
      const max = parseFloat(widget.props.max ?? "100");
      const step = parseFloat(widget.props.step ?? "1");
      // handleW is in MC pixels; rect values are CSS px — convert rect to MC px via /scale
      const handleW = 8;
      const trackWidthMC = rect.width / scale;
      const pct = Math.max(0, Math.min(1,
        ((ev.clientX - rect.left) / scale - handleW / 2) / (trackWidthMC - handleW)
      ));
      const raw = min + pct * (max - min);
      const snapped = Math.round(raw / step) * step;
      setSliderVal(Math.max(min, Math.min(max, snapped)));
    };
    update(e);
    const onMove = (ev: PointerEvent) => update(ev as unknown as React.PointerEvent);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", () => window.removeEventListener("pointermove", onMove), { once: true });
  };

  let liveWidget = widget;
  if (isSlider) liveWidget = { ...widget, props: { ...widget.props, value: String(sliderVal) } };
  if (isInput) liveWidget = { ...widget, text: inputVal };

  return (
    <div
      ref={isSlider ? trackRef : undefined}
      data-widget-id={widget.id}
      style={{
        position: "absolute",
        left: widget.x,
        top: widget.y,
        width: widget.w,
        height: widget.h,
        zIndex: zBase,
        cursor: isSlider ? "ew-resize" : isInput ? "text" : isPassive ? "default" : "pointer",
        touchAction: "none",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => {
        if (isInput) { setFocused(true); setTimeout(() => inputRef.current?.focus(), 0); return; }
        if (!isPassive && !isSlider) setPressed(true);
      }}
      onMouseUp={() => {
        if (isPassive || isSlider || isInput) return;
        setPressed(false);
        if (isToggle) setToggled((v) => !v);
        if (widget.action) toast(`Action triggered: ${widget.action}`);
      }}
      onPointerDown={isSlider ? handleSliderPointer : undefined}
    >
      {!isTabs && <WidgetVisual widget={liveWidget} scale={scale} interactState={interactState} toggled={toggled} />}
      {isContainer && !isTabs && (
        <div style={{ position: "absolute", inset: 0, overflow: clips ? "hidden" : "visible" }}>
          {children.map((child, idx) => (
            <TryWidgetRoot key={child.id} widget={child} scale={scale} childMap={childMap} zBase={idx + 1} allWidgets={allWidgets} scrollListeners={new Map()} />
          ))}
        </div>
      )}
      {isTabs && !widget.parentId && (
        <TabsTopTryHeader
          widget={widget}
          tabChildren={tabChildren}
          tex={tex}
          resolvedTabId={resolvedTabId}
          setActiveTab={setActiveTab}
          tabHeaderHeight={tabHeaderHeight}
          scale={scale}
          childMap={childMap}
          activeTabChildren={activeTabChildren}
          allWidgets={allWidgets}
          TryWidgetRoot={TryWidgetRoot}
        />
      )}
      {isTabs && !!widget.parentId && (
        <TabsNestedTryHeader
          widget={widget}
          tabChildren={tabChildren}
          tex={tex}
          resolvedTabId={resolvedTabId}
          setActiveTab={setActiveTab}
          tabHeaderHeight={tabHeaderHeight}
          scale={scale}
          childMap={childMap}
          activeTabChildren={activeTabChildren}
          allWidgets={allWidgets}
          TryWidgetRoot={TryWidgetRoot}
        />
      )}
      {isInput && (
        <input
          ref={inputRef}
          value={inputVal}
          maxLength={parseInt(widget.props.max_length ?? "32")}
          onChange={(e) => setInputVal(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            position: "absolute", inset: 0,
            background: "transparent", color: "transparent", caretColor: "transparent",
            border: "none", outline: "none", padding: 0,
            cursor: "text", fontSize: "inherit",
          }}
        />
      )}
    </div>
  );
}

function CanvasContextMenu({ x, y, scale, onAdd, onClose }: {
  x: number; y: number; scale: number;
  onAdd: (type: string) => void;
  onClose: () => void;
}) {
  // A zero-size trigger div is placed at the right-click position inside the canvas.
  // DropdownMenu opens immediately (open={true}) and anchors its popup to that trigger,
  // so the popup appears exactly where the user right-clicked using the same Radix/base-ui
  // menu component as the LayersTree add-widget button.
  return (
    <DropdownMenu open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DropdownMenuTrigger
        onMouseDown={(e: React.MouseEvent) => e.stopPropagation()}
        style={{ position: "absolute", left: x, top: y, width: 0, height: 0, border: "none", background: "none", padding: 0 }}
      />
      <DropdownMenuContent side="bottom" align="start" className="min-w-40">
        <AddWidgetItems onAdd={(type) => { onAdd(type); onClose(); }} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function buildGridDataUrl(px: number): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}"><path d="M ${px} 0 L 0 0 0 ${px}" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="0.5"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
