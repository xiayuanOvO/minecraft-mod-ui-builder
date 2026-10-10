"use client";

import type { ComponentType, MutableRefObject, RefObject } from "react";
import type { WidgetSpec } from "@/lib/types";
import { NESTED_TAB_SLICE, NESTED_TAB_GAP, computeTabLayout, reflowTabsForWidth } from "../tabLayout";
import { SelectionOverlay } from "@/components/SelectionOverlay";
import { TabBackground, TabLabel } from "../TabParts";
import { GuideLines, type DragGuidesInfo } from "@/components/DragGuides";
import type { GroupDragInfo } from "@/components/GroupSelectionOverlay";

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

export function TabsNestedEditHeader({
  widget, tabChildren, tex, activeTabId, inlineEdit, setInlineEdit,
  inlineInputRef, commitInlineEdit, setPreviewTabId, tabHeaderHeight,
  scale, selectedId, selectedIds, selectionChangedRef, snapPx, draggingPos, draggingSize, setDraggingSize, dragGuides, groupDrag, onResizeCommit, childMap, activeTabChildren, EditWidget,
}: {
  widget: WidgetSpec;
  tabChildren: WidgetSpec[];
  tex: (name: string) => string | undefined;
  activeTabId: string | null;
  inlineEdit: { id: string; text: string } | null;
  setInlineEdit: (edit: { id: string; text: string } | null) => void;
  inlineInputRef: RefObject<HTMLInputElement | null>;
  commitInlineEdit: (draft: string) => void;
  setPreviewTabId: (id: string) => void;
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
  const slice = NESTED_TAB_SLICE;
  const liveW = draggingSize?.id === widget.id ? draggingSize.w : widget.w;
  const { tabs: rawTabs } = computeTabLayout(tabChildren, liveW, NESTED_TAB_GAP);
  const computedTabs = draggingSize?.id === widget.id
    ? reflowTabsForWidth(rawTabs, liveW, NESTED_TAB_GAP)
    : rawTabs;

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <div data-tab-header style={{ position: "absolute", top: 0, left: 0, right: 0, height: tabHeaderHeight, overflow: "visible", zIndex: 2 }}>
        {computedTabs.filter(({ tab }) => !tab.hidden).map(({ tab, x: tabX, w: tabW }) => {
          const isActive = tab.id === activeTabId;
          const tabTex = tex(isActive ? "widget_tab_selected.png" : "widget_tab_unselected.png");
          const tabH = tabHeaderHeight + slice;
          return (
            <div
              key={tab.id}
              data-widget-id={tab.id}
              style={{
                position: "absolute",
                left: tabX, width: tabW, top: -1, height: tabH,
                zIndex: isActive ? 3 : 2,
                overflow: "visible", userSelect: "none", cursor: "default",
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
                  borderImageCss={`url("${tabTex}") ${slice} fill / ${slice}px stretch`} />
              )}
              <TabLabel tab={tab} isActive={isActive} inactivePaddingTop={4} tabHeaderHeight={tabHeaderHeight} editing={inlineEdit?.id === tab.id} />
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
                    position: "absolute", inset: `0 ${slice}px`,
                    background: "rgba(0,0,0,0.75)",
                    color: "#fff", border: "none", outline: "2px solid #ff0",
                    fontSize: 6, fontFamily: '"Minecraft", monospace',
                    textAlign: "center", width: `calc(100% - ${slice * 2}px)`,
                    zIndex: 10, padding: 0,
                  }}
                />
              )}
              {selectedId === tab.id && <SelectionOverlay scale={scale} knobs={[]} />}
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
