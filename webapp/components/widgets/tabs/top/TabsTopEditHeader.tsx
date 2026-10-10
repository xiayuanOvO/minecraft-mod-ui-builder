"use client";

import type { ComponentType, MutableRefObject, RefObject } from "react";
import type { WidgetSpec } from "@/lib/types";
import { TAB_TOP_SLICE, TAB_SIDE_SLICE, TAB_LEFT_SLICE, TAB_GAP, computeTabLayout, reflowTabsForWidth, tabEdgePosition, defaultTabLayout, type TabDrag } from "../tabLayout";
import { SelectionOverlay } from "@/components/SelectionOverlay";
import { TabBackground, TabLabel } from "../TabParts";
import { GuideLines, type DragGuidesInfo } from "@/components/DragGuides";
import type { GroupDragInfo } from "@/components/GroupSelectionOverlay";

export type { TabDrag };

interface EditWidgetProps {
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
}

export function TabsTopEditHeader({
  widget, tabChildren, tex, activeTabId, tabDrag, setTabDrag, inlineEdit, setInlineEdit,
  inlineInputRef, commitInlineEdit, setPreviewTabId, updateWidgets, tabHeaderHeight,
  scale, selectedId, selectedIds, selectionChangedRef, snapPx, draggingPos, draggingSize, setDraggingSize, dragGuides, groupDrag, onResizeCommit, childMap, activeTabChildren, EditWidget,
}: {
  widget: WidgetSpec;
  tabChildren: WidgetSpec[];
  tex: (name: string) => string | undefined;
  activeTabId: string | null;
  tabDrag: TabDrag | null;
  setTabDrag: (drag: TabDrag | null) => void;
  inlineEdit: { id: string; text: string } | null;
  setInlineEdit: (edit: { id: string; text: string } | null) => void;
  inlineInputRef: RefObject<HTMLInputElement | null>;
  commitInlineEdit: (draft: string) => void;
  setPreviewTabId: (id: string) => void;
  updateWidgets: (widgets: WidgetSpec[]) => void;
  tabHeaderHeight: number;
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
  activeTabChildren: WidgetSpec[];
  selectionChangedRef: MutableRefObject<boolean>;
  EditWidget: ComponentType<EditWidgetProps>;
}) {
  const topSlice = TAB_TOP_SLICE;
  const sideSlice = TAB_SIDE_SLICE;
  const leftSlice = TAB_LEFT_SLICE;
  const GAP = TAB_GAP;
  const liveW = draggingSize?.id === widget.id ? draggingSize.w : widget.w;
  const { allDefault, getW, getX, tabs: rawTabs } = computeTabLayout(tabChildren, liveW);
  const computedTabs = draggingSize?.id === widget.id && !allDefault
    ? reflowTabsForWidth(rawTabs, liveW, GAP)
    : rawTabs;
  const getMinW = (t: WidgetSpec) => Math.max(16, (t.text || t.id || "").length * 4 + 16);

  const initIfDefault = () => {
    if (allDefault) updateWidgets(defaultTabLayout(tabChildren, liveW, GAP));
  };

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <div data-tab-header style={{ position: "absolute", top: 0, left: 0, right: 0, height: tabHeaderHeight, overflow: "visible" }}>
        {computedTabs.filter(({ tab }) => !tab.hidden).map(({ tab, x: tabX, w: tabW }, idx) => {
          const isActive = tab.id === activeTabId;
          const pos = tabEdgePosition(tabX, tabW, liveW);
          const tabTex = tex(isActive ? `tab_selected_${pos}.png` : `tab_unselected_${pos}.png`);
          const minW = getMinW(tab);
          const prev = computedTabs[idx - 1];
          const next = computedTabs[idx + 1];
          const moveMinX = 0;
          const moveMaxX = liveW - tabW;
          const resizeRightMaxW = next ? next.x - tabX - GAP : liveW - tabX;
          const resizeLeftMaxW = prev ? tabX + tabW - (prev.x + prev.w + GAP) : tabX + tabW;
          const isMoving = tabDrag?.type === "move" && tabDrag.id === tab.id;
          const tabH = tabHeaderHeight + topSlice;
          return (
            <div
              key={tab.id}
              data-widget-id={tab.id}
              style={{
                position: "absolute",
                left: tabX, width: tabW, top: -1, height: tabH,
                zIndex: isActive ? 3 : 2,
                overflow: "visible", userSelect: "none",
                cursor: isMoving ? "grabbing" : "grab",
              }}
              onMouseDown={(e) => {
                if ((e.target as HTMLElement).dataset.resizeHandle) return;
                if (inlineEdit?.id === tab.id) return;
                initIfDefault();
                setTabDrag({ type: "move", id: tab.id, startMouseX: e.clientX,
                  startX: tabX, startW: tabW,
                  minX: moveMinX, maxX: moveMaxX,
                  minW: 0, maxW: 0 });
              }}
              onClick={(e) => { if (!(e.target as HTMLElement).dataset.resizeHandle) setPreviewTabId(tab.id); }}
              onDoubleClick={(e) => {
                if (selectedId !== tab.id) return;
                if (selectionChangedRef.current) return;
                e.stopPropagation();
                e.nativeEvent.stopImmediatePropagation();
                setInlineEdit({ id: tab.id, text: tab.text });
              }}
            >
              {tabTex && (
                <TabBackground tex={tabTex} tabW={tabW} tabH={tabH}
                  borderImageCss={`url("${tabTex}") ${4} ${3} ${0} ${4} fill / ${topSlice}px ${sideSlice}px 0px ${leftSlice}px stretch`} />
              )}
              <TabLabel tab={tab} isActive={isActive} inactivePaddingTop={topSlice} tabHeaderHeight={tabHeaderHeight} editing={inlineEdit?.id === tab.id} />
              {inlineEdit?.id === tab.id && (
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
                    position: "absolute", inset: `0 ${sideSlice}px`,
                    background: "rgba(0,0,0,0.75)",
                    color: "#fff", border: "none", outline: "2px solid #ff0",
                    fontSize: 6, fontFamily: '"Minecraft", monospace',
                    textAlign: "center", width: `calc(100% - ${sideSlice * 2}px)`,
                    zIndex: 10, padding: 0,
                  }}
                />
              )}
              {selectedId === tab.id && <SelectionOverlay scale={scale} knobs={["left", "right"]} />}
              <div data-resize-handle="left"
                onMouseDown={(e) => {
                  e.stopPropagation(); e.preventDefault();
                  e.nativeEvent.stopImmediatePropagation();
                  initIfDefault();
                  setTabDrag({ type: "resize-left", id: tab.id, startMouseX: e.clientX,
                    startX: tabX, startW: tabW, minX: 0, maxX: 0, minW, maxW: resizeLeftMaxW });
                }}
                style={{ position: "absolute", left: -sideSlice, top: 0, bottom: 0, width: sideSlice + 4, cursor: "ew-resize", zIndex: 3 }}
              />
              <div data-resize-handle="right"
                onMouseDown={(e) => {
                  e.stopPropagation(); e.preventDefault();
                  e.nativeEvent.stopImmediatePropagation();
                  initIfDefault();
                  setTabDrag({ type: "resize-right", id: tab.id, startMouseX: e.clientX,
                    startX: tabX, startW: tabW, minX: 0, maxX: 0, minW, maxW: resizeRightMaxW });
                }}
                style={{ position: "absolute", right: -sideSlice, top: 0, bottom: 0, width: sideSlice + 4, cursor: "ew-resize", zIndex: 3 }}
              />
            </div>
          );
        })}
      </div>
      <div style={{
        position: "absolute", left: 0, top: tabHeaderHeight,
        width: draggingSize?.id === widget.id ? draggingSize.w : widget.w,
        height: (draggingSize?.id === widget.id ? draggingSize.h : widget.h) - tabHeaderHeight,
        overflow: "hidden", zIndex: 1,
      }}>
        {tex("mc_panel_slice.png") && (
          <div style={{ position: "absolute", inset: 0, boxSizing: "border-box",
            borderImage: `url("${tex("mc_panel_slice.png")}") 3 fill / 3px stretch` }} />
        )}
        {dragGuides && dragGuides.parentId === activeTabId && <GuideLines {...dragGuides} />}
        {!tabChildren.find(t => t.id === activeTabId)?.hidden && activeTabChildren.map((child, idx) => (
          <EditWidget key={child.id} widget={child} scale={scale} selectedId={selectedId} selectedIds={selectedIds}
            snapPx={snapPx} draggingPos={draggingPos} draggingSize={draggingSize}
            setDraggingSize={setDraggingSize} dragGuides={dragGuides} groupDrag={groupDrag} onResizeCommit={onResizeCommit}
            childMap={childMap} zBase={idx + 1} />
        ))}
      </div>
    </div>
  );
}
