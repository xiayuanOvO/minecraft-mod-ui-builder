"use client";

import { createContext, use, useState, useRef, useEffect } from "react";
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  closestCenter,
  type DragEndEvent, type DragStartEvent, type DragMoveEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ChevronDown, ChevronRight, Plus, Trash2, HelpCircle, Eye, EyeOff, Pencil,
} from "lucide-react";
import {
  SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarGroupAction,
} from "@/components/ui/sidebar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import WIDGET_REGISTRY from "@/lib/widgetRegistry";
import { WIDGET_ICONS, AddWidgetItems } from "@/components/AddWidgetItems";
import type { WidgetSpec } from "@/lib/types";
import { useLocale } from "@/lib/i18n";

// ── constants ──────────────────────────────────────────────────────────────────

const CONTAINER_TYPES = new Set(
  WIDGET_REGISTRY.filter(d => d.isContainer).map(d => d.type),
);

// Indent per depth level in px
const INDENT = 12;
const BASE_PL = 8;

// ── context for keeping action bar visible while a dropdown is open ─────────────

const OpenCountCtx = createContext<{ onOpen: () => void; onClose: () => void }>({
  onOpen: () => {},
  onClose: () => {},
});

// ── drop indicator state ───────────────────────────────────────────────────────

type Placement = "before" | "after" | "inside";
type DragOverState = { overId: string; placement: Placement } | null;

function computePlacement(pointerY: number, over: NonNullable<DragEndEvent["over"]>, isContainer: boolean): Placement {
  const { top, height } = over.rect;
  const pct = (pointerY - top) / height;
  if (isContainer && pct > 0.25 && pct < 0.75) return "inside";
  return pct < 0.5 ? "before" : "after";
}

// ── flat tree (recursive) ─────────────────────────────────────────────────────

interface FlatItem {
  id: string;
  depth: number;
  parentId: string | undefined;
  isContainer: boolean;
}

function flattenTree(
  widgets: WidgetSpec[],
  expanded: Set<string>,
  parentId: string | undefined = undefined,
  depth = 0,
): FlatItem[] {
  const items: FlatItem[] = [];
  for (const w of widgets.filter(w => w.parentId === parentId)) {
    const isContainer = CONTAINER_TYPES.has(w.type);
    items.push({ id: w.id, depth, parentId, isContainer });
    if (isContainer && expanded.has(w.id)) {
      items.push(...flattenTree(widgets, expanded, w.id, depth + 1));
    }
  }
  return items;
}

// ── props ──────────────────────────────────────────────────────────────────────

export interface LayersTreeProps {
  widgets: WidgetSpec[];
  selectedId: string | null;
  selectedIds?: string[];
  onSelect: (id: string, shiftKey: boolean, modKey: boolean) => void;
  onAdd: (type: string, parentId?: string) => void;
  onDelete: (id: string) => void;
  onToggleHidden: (id: string) => void;
  onReorder: (draggedIds: string[], overId: string, placement: Placement) => void;
  onRename: (id: string, name: string) => void;
}

// ── main component ─────────────────────────────────────────────────────────────

export default function LayersTree({
  widgets, selectedId, selectedIds, onSelect, onAdd, onDelete, onToggleHidden, onReorder, onRename,
}: LayersTreeProps) {
  const [expanded, setExpanded] = useState<Set<string>>(() =>
    new Set(widgets.filter(w => CONTAINER_TYPES.has(w.type)).map(w => w.id)),
  );
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<DragOverState>(null);
  const pointerY = useRef(0);

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renamingId !== null) renameRef.current?.focus();
  }, [renamingId]);

  const startRename = (id: string) => {
    setRenamingId(id);
    setRenameValue(id);
  };

  const commitRename = () => {
    if (renamingId !== null && renameValue.trim()) onRename(renamingId, renameValue.trim());
    setRenamingId(null);
  };

  const toggle = (id: string) => setExpanded(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const expandAndAdd = (type: string, parentId: string) => {
    setExpanded(prev => new Set([...prev, parentId]));
    onAdd(type, parentId);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const flatItems = flattenTree(widgets, expanded);
  const sortedIds = flatItems.map(f => f.id);

  const handleDragStart = (e: DragStartEvent) => {
    setDraggingId(String(e.active.id));
    setDragOver(null);
  };

  const handleDragMove = (e: DragMoveEvent) => {
    const native = e.activatorEvent as PointerEvent;
    pointerY.current = native.clientY + e.delta.y;

    const { active, over } = e;
    if (!over || active.id === over.id) { setDragOver(null); return; }
    const overId = String(over.id);
    const overItem = flatItems.find(f => f.id === overId);
    if (!overItem) { setDragOver(null); return; }
    const placement = computePlacement(pointerY.current, over, overItem.isContainer);
    setDragOver(prev =>
      prev?.overId === overId && prev.placement === placement ? prev : { overId, placement },
    );
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setDraggingId(null);
    setDragOver(null);
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    const overItem = flatItems.find(f => f.id === overId);
    if (!overItem) return;
    const placement = dragOver?.overId === overId
      ? dragOver.placement
      : computePlacement(pointerY.current, over, overItem.isContainer);
    // Dragging a member of the current multi-selection moves the whole group together.
    const draggedIds = selectedIds?.includes(activeId) ? selectedIds : [activeId];
    onReorder(draggedIds, overId, placement);
  };

  const draggingWidget = draggingId ? widgets.find(w => w.id === draggingId) : null;
  const draggingGroupSize = draggingId && selectedIds?.includes(draggingId) ? selectedIds.length : 1;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onDragCancel={() => { setDraggingId(null); setDragOver(null); }}
    >
      <AddWidgetButton onAdd={(type) => onAdd(type, undefined)} asGroupAction />

      <SortableContext items={sortedIds} strategy={() => null}>
        <SidebarMenu>
          {flatItems.map((item) => {
            const widget = widgets.find(w => w.id === item.id);
            if (!widget) return null;
            return (
              <TreeNode
                key={item.id}
                widget={widget}
                depth={item.depth}
                isOpen={item.isContainer && expanded.has(item.id)}
                hasChildren={widgets.some(w => w.parentId === item.id)}
                selectedId={selectedId}
                isMultiSelected={!!selectedIds && selectedIds.length > 1 && selectedIds.includes(item.id)}
                dragOver={dragOver}
                onSelect={onSelect}
                onAdd={(type) => expandAndAdd(type, widget.id)}
                onDelete={onDelete}
                onToggleHidden={onToggleHidden}
                onToggle={() => toggle(item.id)}
                isRenaming={renamingId === item.id}
                renameValue={renameValue}
                onRenameValueChange={setRenameValue}
                onStartRename={() => startRename(item.id)}
                onCommitRename={commitRename}
                onCancelRename={() => setRenamingId(null)}
                renameRef={renameRef}
              />
            );
          })}
        </SidebarMenu>
      </SortableContext>

      <DragOverlay>
        {draggingWidget && (
          <div className="flex items-center gap-1.5 rounded bg-sidebar-accent px-2 py-1 text-xs shadow-lg opacity-90 border border-sidebar-border">
            {(() => { const I = WIDGET_ICONS[draggingWidget.type] ?? HelpCircle; return <I className="size-3.5" />; })()}
            <span>{draggingWidget.id}</span>
            {draggingGroupSize > 1 && (
              <span className="ml-1 rounded-full bg-blue-500 px-1.5 text-[10px] font-medium text-white">
                +{draggingGroupSize - 1}
              </span>
            )}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

// ── unified tree node (all depths) ────────────────────────────────────────────

function TreeNode({
  widget, depth, isOpen, hasChildren, selectedId, isMultiSelected, dragOver, onSelect, onAdd, onDelete, onToggleHidden, onToggle,
  isRenaming, renameValue, onRenameValueChange, onStartRename, onCommitRename, onCancelRename, renameRef,
}: {
  widget: WidgetSpec;
  depth: number;
  isOpen: boolean;
  hasChildren: boolean;
  selectedId: string | null;
  isMultiSelected: boolean;
  dragOver: DragOverState;
  onSelect: (id: string, shiftKey: boolean, modKey: boolean) => void;
  onAdd: (type: string) => void;
  onDelete: (id: string) => void;
  onToggleHidden: (id: string) => void;
  onToggle: () => void;
  isRenaming: boolean;
  renameValue: string;
  onRenameValueChange: (v: string) => void;
  onStartRename: () => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  renameRef: React.RefObject<HTMLInputElement | null>;
}) {
  const { t } = useLocale();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: widget.id });

  const Icon = WIDGET_ICONS[widget.type] ?? HelpCircle;
  const isContainer = CONTAINER_TYPES.has(widget.type);
  const dropIndicator = dragOver?.overId === widget.id ? dragOver.placement : null;
  const insideHighlight = dropIndicator === "inside";

  return (
    <SidebarMenuItem
      ref={setNodeRef}
      data-layer-id={widget.id}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1, position: "relative" }}
    >
      <DropLine placement={dropIndicator} depth={depth} />

      {isRenaming ? (
        <div className="py-0.5" style={{ paddingLeft: BASE_PL + depth * INDENT, paddingRight: 8 }}>
          <Input
            ref={renameRef}
            className="h-6 text-xs"
            value={renameValue}
            onChange={e => onRenameValueChange(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") onCommitRename();
              if (e.key === "Escape") onCancelRename();
            }}
            onBlur={onCommitRename}
          />
        </div>
      ) : (
        <>
          <SidebarMenuButton
            isActive={widget.id === selectedId}
            onClick={(e) => onSelect(widget.id, e.shiftKey, e.metaKey || e.ctrlKey)}
            onDoubleClick={() => onStartRename()}
            className={`${isDragging ? "cursor-grabbing" : "cursor-default"} pr-24`}
            style={{
              paddingLeft: BASE_PL + depth * INDENT,
              ...(isMultiSelected && widget.id !== selectedId ? { background: "hsl(217 91% 60% / 0.15)" } : {}),
              ...(insideHighlight ? { outline: "2px solid hsl(217 91% 60%)", outlineOffset: "-2px", borderRadius: "4px" } : {}),
            }}
            {...attributes}
            {...listeners}
          >
            {isContainer && hasChildren ? (
              <span
                role="button"
                tabIndex={0}
                className="mr-0.5 size-3 shrink-0 flex items-center justify-center opacity-60 hover:opacity-100"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); onToggle(); }}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); onToggle(); } }}
              >
                {isOpen ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
              </span>
            ) : (
              <span className="mr-0.5 size-3 shrink-0 inline-block" />
            )}
            <Icon className={`size-3.5 shrink-0 ${widget.hidden ? "opacity-40" : ""}`} />
            <span className={`truncate text-xs ${widget.hidden ? "opacity-40" : ""}`}>{widget.id}</span>
          </SidebarMenuButton>

          {/* Eye toggle — always visible so position never shifts on hover */}
          <button
            className="absolute right-1 top-1.5 flex size-5 items-center justify-center rounded hover:bg-sidebar-accent opacity-40 hover:opacity-100"
            title={widget.hidden ? t("Show") : t("Hide")}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onToggleHidden(widget.id); }}
          >
            {widget.hidden ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
          </button>

          <NodeActionBar>
            {widget.type === "tabs" && (
              <button
                className="flex size-5 items-center justify-center rounded hover:bg-sidebar-accent"
                title={t("Add tab")}
                onClick={(e) => { e.stopPropagation(); onAdd("tab"); }}
              >
                <Plus className="size-3" />
              </button>
            )}
            {isContainer && widget.type !== "tabs" && <AddWidgetButton onAdd={onAdd} />}
            <button
              className="flex size-5 items-center justify-center rounded hover:bg-sidebar-accent"
              title={t("Rename")}
              onClick={(e) => { e.stopPropagation(); onStartRename(); }}
            >
              <Pencil className="size-3" />
            </button>
            <button
              className="flex size-5 items-center justify-center rounded hover:bg-sidebar-accent"
              title={t("Delete")}
              onClick={(e) => { e.stopPropagation(); onDelete(widget.id); }}
            >
              <Trash2 className="size-3" />
            </button>
          </NodeActionBar>
        </>
      )}
    </SidebarMenuItem>
  );
}

// ── drop indicator line ────────────────────────────────────────────────────────

function DropLine({ placement, depth }: { placement: Placement | null; depth: number }) {
  if (!placement || placement === "inside") return null;
  return (
    <div
      className="pointer-events-none absolute h-0.5 bg-blue-400 rounded-full z-50"
      style={{
        left: BASE_PL + depth * INDENT,
        right: 4,
        top: placement === "before" ? 0 : "auto",
        bottom: placement === "after" ? 0 : "auto",
      }}
    />
  );
}

// ── action bar ─────────────────────────────────────────────────────────────────

function NodeActionBar({ children }: { children: React.ReactNode }) {
  const [openCount, setOpenCount] = useState(0);
  return (
    <OpenCountCtx value={{
      onOpen: () => setOpenCount(c => c + 1),
      onClose: () => setTimeout(() => setOpenCount(c => Math.max(0, c - 1)), 150),
    }}>
      <div
        className="absolute right-7 top-1.5 items-center gap-0.5 hidden group-hover/menu-item:flex"
        style={openCount > 0 ? { display: "flex" } : undefined}
      >
        {children}
      </div>
    </OpenCountCtx>
  );
}

// ── add widget dropdown ────────────────────────────────────────────────────────

function AddWidgetButton({ onAdd, asGroupAction }: {
  onAdd: (type: string) => void;
  asGroupAction?: boolean;
}) {
  const { onOpen, onClose } = use(OpenCountCtx);
  const { t } = useLocale();

  const trigger = asGroupAction
    ? <SidebarGroupAction title={t("Add widget")} render={<DropdownMenuTrigger />}><Plus /></SidebarGroupAction>
    : (
      <DropdownMenuTrigger
        className="flex size-5 items-center justify-center rounded hover:bg-sidebar-accent"
        title={t("Add child")}
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        <Plus className="size-3" />
      </DropdownMenuTrigger>
    );

  return (
    <DropdownMenu onOpenChange={(open) => open ? onOpen() : onClose()}>
      {trigger}
      <DropdownMenuContent side="right" align="start" className="min-w-40">
        <AddWidgetItems onAdd={onAdd} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
