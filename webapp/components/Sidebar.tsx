"use client";

import { useState, useRef, useEffect, type ReactNode } from "react";
import { Plus, Pencil, Trash2, GripVertical, ChevronDown, ChevronRight, ChevronLeft, Upload, Download } from "lucide-react";
import {
  DndContext, PointerSensor, useSensor, useSensors, closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import LayersTree from "@/components/LayersTree";
import type { ScreenSpec, WidgetSpec } from "@/lib/types";
import { useLocale } from "@/lib/i18n";

interface Props {
  screens: ScreenSpec[];
  activeIdx: number;
  modId?: string;
  widgets: WidgetSpec[];
  selectedId: string | null;
  selectedIds?: string[];
  onGoHome: () => void;
  onSelectScreen: (idx: number) => void;
  onAddScreen: () => void;
  onRemoveScreen: (idx: number) => void;
  onRenameScreen: (idx: number, name: string) => void;
  onMoveScreen: (fromIdx: number, toIdx: number) => void;
  onImportScreen: () => void;
  onExportScreen: (idx: number) => void;
  onAddWidget: (type: string, parentId?: string) => void;
  onSelectWidget: (id: string, shiftKey: boolean, modKey: boolean) => void;
  onDeleteWidget: (id: string) => void;
  onToggleHiddenWidget: (id: string) => void;
  onRenameWidget: (id: string, name: string) => void;
  onReparentWidget: (id: string, newParentId: string | null) => void;
  onReorderWidget: (draggedIds: string[], overId: string, placement: "before" | "after" | "inside") => void;
}

function SortableScreenItem({ id, children }: { id: string; children: ReactNode }) {
  const { t } = useLocale();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <SidebarMenuItem
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? "opacity-50" : undefined}
    >
      <button
        {...attributes}
        {...listeners}
        title={t("Drag to reorder")}
        className="absolute left-0.5 top-1.5 flex h-5 w-4 cursor-grab items-center justify-center text-muted-foreground hover:text-foreground [&>svg]:size-3.5"
      >
        <GripVertical />
      </button>
      {children}
    </SidebarMenuItem>
  );
}

export default function AppSidebar({
  screens, activeIdx, modId, widgets, selectedId, selectedIds,
  onGoHome, onSelectScreen, onAddScreen, onRemoveScreen, onRenameScreen, onMoveScreen, onImportScreen, onExportScreen,
  onAddWidget, onSelectWidget, onDeleteWidget, onToggleHiddenWidget, onRenameWidget, onReparentWidget, onReorderWidget,
}: Props) {
  const { t } = useLocale();
  const [screensOpen, setScreensOpen] = useState(true);
  const [layersOpen, setLayersOpen] = useState(true);
  const [renamingIdx, setRenamingIdx] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );
  const screenIds = screens.map(s => s.id);

  const handleScreenDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const fromIdx = screens.findIndex(s => s.id === active.id);
    const toIdx = screens.findIndex(s => s.id === over.id);
    if (fromIdx === -1 || toIdx === -1) return;
    onMoveScreen(fromIdx, toIdx);
  };

  useEffect(() => {
    if (renamingIdx !== null) renameRef.current?.focus();
  }, [renamingIdx]);

  const startRename = (idx: number) => {
    setRenamingIdx(idx);
    setRenameValue(screens[idx].id);
  };

  const commitRename = () => {
    if (renamingIdx !== null && renameValue.trim()) onRenameScreen(renamingIdx, renameValue.trim());
    setRenamingIdx(null);
  };

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader className="border-b">
        <div className="flex h-8 items-center gap-1 px-1">
          <Button variant="ghost" size="sm" className="h-7 w-7 px-0 shrink-0" onClick={onGoHome} title={t("Back to projects")}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="font-semibold truncate text-sidebar-foreground">
            {modId || t("Unnamed project")}
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent>

        {/* ── Screens ────────────────────────────────────────── */}
        <SidebarGroup>
          <SidebarGroupLabel
            className="cursor-pointer select-none"
            onClick={() => setScreensOpen(v => !v)}
          >
            {screensOpen
              ? <ChevronDown className="mr-1 h-3.5 w-3.5" />
              : <ChevronRight className="mr-1 h-3.5 w-3.5" />}
            {t("Screens")}
          </SidebarGroupLabel>

          <SidebarGroupAction title={t("Import screen JSON")} onClick={onImportScreen} className="right-8">
            <Upload />
          </SidebarGroupAction>
          <SidebarGroupAction title={t("Add screen")} onClick={onAddScreen}>
            <Plus />
          </SidebarGroupAction>

          {screensOpen && (
            <SidebarGroupContent>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleScreenDragEnd}>
                <SortableContext items={screenIds} strategy={verticalListSortingStrategy}>
                  <SidebarMenu>
                    {screens.map((s, idx) => (
                      <SortableScreenItem key={s.id} id={s.id}>
                        {renamingIdx === idx ? (
                          <div className="px-2 py-0.5">
                            <Input
                              ref={renameRef}
                              className="h-6 text-xs"
                              value={renameValue}
                              onChange={e => setRenameValue(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === "Enter") commitRename();
                                if (e.key === "Escape") setRenamingIdx(null);
                              }}
                              onBlur={commitRename}
                            />
                          </div>
                        ) : (
                          <>
                            <SidebarMenuButton
                              size="sm"
                              isActive={idx === activeIdx}
                              onClick={() => onSelectScreen(idx)}
                              onDoubleClick={() => startRename(idx)}
                              className="pl-5 pr-16"
                            >
                              <span className="truncate">{s.id || "(unnamed)"}</span>
                            </SidebarMenuButton>
                            {/* Hover actions — three buttons in a row, absolutely positioned */}
                            <div className="absolute right-1 top-1.5 hidden items-center gap-0.5 group-hover/menu-item:flex">
                              <button
                                title={t("Export screen JSON")}
                                onClick={e => { e.stopPropagation(); onExportScreen(idx); }}
                                className="flex h-5 w-5 items-center justify-center rounded-md hover:bg-sidebar-accent [&>svg]:size-3.5"
                              >
                                <Download />
                              </button>
                              <button
                                title={t("Rename")}
                                onClick={e => { e.stopPropagation(); startRename(idx); }}
                                className="flex h-5 w-5 items-center justify-center rounded-md hover:bg-sidebar-accent [&>svg]:size-3.5"
                              >
                                <Pencil />
                              </button>
                              <button
                                title={t("Delete")}
                                disabled={screens.length <= 1}
                                onClick={e => { e.stopPropagation(); onRemoveScreen(idx); }}
                                className="flex h-5 w-5 items-center justify-center rounded-md hover:bg-sidebar-accent disabled:pointer-events-none disabled:opacity-30 [&>svg]:size-3.5"
                              >
                                <Trash2 />
                              </button>
                            </div>
                          </>
                        )}
                      </SortableScreenItem>
                    ))}
                  </SidebarMenu>
                </SortableContext>
              </DndContext>
            </SidebarGroupContent>
          )}
        </SidebarGroup>

        <SidebarSeparator />

        {/* ── Layers ─────────────────────────────────────────── */}
        <SidebarGroup>
          <SidebarGroupLabel
            className="cursor-pointer select-none"
            onClick={() => setLayersOpen(v => !v)}
          >
            {layersOpen
              ? <ChevronDown className="mr-1 h-3.5 w-3.5" />
              : <ChevronRight className="mr-1 h-3.5 w-3.5" />}
            {t("Layers")}
          </SidebarGroupLabel>

          {layersOpen && (
            <SidebarGroupContent>
              <LayersTree
                widgets={widgets}
                selectedId={selectedId}
                selectedIds={selectedIds}
                onSelect={onSelectWidget}
                onAdd={onAddWidget}
                onDelete={onDeleteWidget}
                onToggleHidden={onToggleHiddenWidget}
                onRename={onRenameWidget}
                onReorder={onReorderWidget}
              />
            </SidebarGroupContent>
          )}
        </SidebarGroup>


      </SidebarContent>
    </Sidebar>
  );
}
