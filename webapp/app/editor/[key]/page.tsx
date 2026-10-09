"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { arrayMove } from "@dnd-kit/sortable";
import Canvas from "@/components/Canvas";
import PropertyPanel from "@/components/PropertyPanel";
import AppSidebar from "@/components/Sidebar";
import Toolbar from "@/components/Toolbar";
import { useTextures } from "@/lib/TextureContext";
import { toast } from "sonner";
import { exportWidgetPng } from "@/lib/exportWidgetPng";
import TexturePickerModal from "@/components/TexturePickerModal";
import type { ScreenSpec, WidgetSpec } from "@/lib/types";
import { generateJavaClass } from "@/lib/generateJavaClass";
import { getWidgetDef } from "@/lib/widgetRegistry";
import { SidebarProvider } from "@/components/ui/sidebar";
import { buildContainerSpec, excludeFromExportedWidgets } from "@/components/widgets/inventory_area/inventoryAreaExport";
import { computeInitialSize } from "@/lib/widgetBounds";
import { APP_VERSION, migrateScreenJson, migrateProjectJson } from "@/lib/migrations";

function newId(type: string, existing: WidgetSpec[]): string {
  const used = new Set(existing.map(w => w.id));
  let n = 1;
  while (used.has(`${type}_${n}`)) n++;
  return `${type}_${n}`;
}

/** Composes each widget type's own export transform into the final exported ScreenSpec JSON. */
function buildExportedScreen(screen: ScreenSpec): ScreenSpec {
  const widgets = excludeFromExportedWidgets(screen.widgets);
  const container = buildContainerSpec(screen.widgets);
  return { ...screen, widgets, ...(container ? { container } : {}), appVersion: APP_VERSION };
}

interface ProjectFile {
  name: string;
  screens: ScreenSpec[];
  appVersion: string;
}

const MAX_HISTORY = 100;
const PROJECTS_KEY = "mc-ui-builder-projects";
const LAST_PROJECT_KEY = "mc-ui-builder-last-project";

interface HistoryEntry {
  screens: ScreenSpec[];
  activeIdx: number;
}

interface SavedSession {
  history: HistoryEntry[];
  cursor: number;
  gridSize: number;
  showGrid: boolean;
  scale?: number;
}

interface StoredProject {
  key: string;
  session: SavedSession;
  updatedAt: number;
}

function migrateSession(raw: Record<string, unknown>): SavedSession {
  const hist = raw.history as unknown[];
  if (!Array.isArray(hist) || hist.length === 0) return EMPTY_SESSION;
  if ('widgets' in (hist[0] as object)) {
    return {
      ...raw,
      history: (hist as ScreenSpec[]).map(s => ({ screens: [s], activeIdx: 0 })),
    } as SavedSession;
  }
  return raw as unknown as SavedSession;
}

function normalizeScreen(s: ScreenSpec): ScreenSpec {
  return { ...s, widgets: s.widgets.map((w) => ({ ...w, props: w.props ?? {} })) };
}

function loadProjects(): StoredProject[] {
  try {
    const raw = localStorage.getItem(PROJECTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredProject[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map(p => ({
      ...p,
      session: migrateSession(p.session as unknown as Record<string, unknown>),
    }));
  } catch {
    return [];
  }
}

function saveProjects(projects: StoredProject[]): void {
  try { localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects)); } catch { /* quota */ }
}


const PLACEHOLDER_SCREEN: ScreenSpec = { id: "main", width: 320, height: 180, widgets: [] };
const EMPTY_SESSION: SavedSession = {
  history: [{ screens: [PLACEHOLDER_SCREEN], activeIdx: 0 }],
  cursor: 0,
  gridSize: 4,
  showGrid: true,
};

export default function EditorPage() {
  const params = useParams<{ key: string }>();
  const router = useRouter();
  const projectKey = params.key;

  const { reset, extractPack, initialized, ready, setupRequired, packTextures } = useTextures();
  const [showTextureDebug, setShowTextureDebug] = useState(false);
  const [projectLoaded, setProjectLoaded] = useState(false);

  const handleResetTextures = async () => {
    await reset();
    router.replace("/");
  };

  const [history, setHistory] = useState<HistoryEntry[]>(EMPTY_SESSION.history);
  const [cursor, setCursor] = useState(EMPTY_SESSION.cursor);
  const cursorRef = useRef(EMPTY_SESSION.cursor);
  cursorRef.current = cursor;

  const entry = history[cursor];
  const screens = entry.screens;
  const activeIdx = entry.activeIdx;
  const screen = screens[activeIdx];

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [multiSelect, setMultiSelect] = useState<{ ids: string[] } | null>(null);
  const [gridSize, setGridSize] = useState(EMPTY_SESSION.gridSize);
  const [showGrid, setShowGrid] = useState(EMPTY_SESSION.showGrid);
  const [snapToParent, setSnapToParent] = useState(true);
  const [snapToSiblings, setSnapToSiblings] = useState(true);
  const [scale, setScale] = useState(3);
  const [tryMode, setTryMode] = useState(false);
  const [exportingPng, setExportingPng] = useState(false);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const panRef = useRef({ x: 0, y: 0 });
  const canvasWrapperRef = useRef<HTMLDivElement>(null);
  const clipboardRef = useRef<WidgetSpec | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const importProjectRef = useRef<HTMLInputElement>(null);

  // Redirect to setup if textures aren't ready after init.
  useEffect(() => {
    if (initialized && setupRequired && !ready) router.replace("/");
  }, [initialized, setupRequired, ready, router]);

  // Load project from localStorage by key.
  useEffect(() => {
    const projects = loadProjects();
    const project = projects.find(p => p.key === projectKey);
    if (!project) {
      router.replace("/");
      return;
    }
    const s = project.session;
    setHistory(s.history);
    setCursor(s.cursor);
    setGridSize(s.gridSize);
    setShowGrid(s.showGrid);
    if (s.scale) setScale(s.scale);
    setProjectLoaded(true);
    try { localStorage.setItem(LAST_PROJECT_KEY, projectKey); } catch { /* quota */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectKey]);

  // Persist session whenever state changes.
  useEffect(() => {
    if (!projectLoaded) return;
    const projects = loadProjects();
    const updated = projects.map(p =>
      p.key === projectKey
        ? { ...p, session: { history, cursor, gridSize, showGrid, scale }, updatedAt: Date.now() }
        : p
    );
    saveProjects(updated);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history, cursor, gridSize, showGrid, scale]);

  const zoomIn  = useCallback(() => setScale((s) => Math.min(s + 1, 8)), []);
  const zoomOut = useCallback(() => setScale((s) => Math.max(s - 1, 1)), []);
  const computeFit = useCallback(() => {
    const el = canvasWrapperRef.current;
    if (!el) return 3;
    const buf = 64;
    const cw = el.clientWidth  - buf * 2;
    const ch = el.clientHeight - buf * 2;
    if (cw <= 0 || ch <= 0) return 3;
    const sw = cw / ch > 16 / 9 ? ch * (16 / 9) : cw;
    const sh = cw / ch > 16 / 9 ? ch : cw * (9 / 16);
    return Math.max(1, Math.min(8, Math.floor(Math.min(sw / screen.width, sh / screen.height))));
  }, [screen.width, screen.height]);

  const zoomReset = useCallback(() => setScale(computeFit()), [computeFit]);

  const fittedForRef = useRef<string | null>(null);
  useEffect(() => {
    if (fittedForRef.current === projectKey) return;
    fittedForRef.current = projectKey;
    const id = requestAnimationFrame(() => setScale(computeFit()));
    return () => cancelAnimationFrame(id);
  }, [projectKey, computeFit]);

  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      const el = canvasWrapperRef.current;
      if (!el || !el.contains(e.target as Node)) return;
      e.preventDefault();
      e.stopPropagation();
      setScale((s) => Math.max(1, Math.min(8, s * Math.pow(0.999, e.deltaY))));
    };
    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 1) return;
      const el = canvasWrapperRef.current;
      if (!el || !el.contains(e.target as Node)) return;
      e.preventDefault();
      e.stopPropagation();
      el.style.cursor = "grabbing";
      const startX = e.clientX, startY = e.clientY;
      const startPanX = panRef.current.x, startPanY = panRef.current.y;
      const onMove = (ev: MouseEvent) => {
        const x = startPanX + ev.clientX - startX;
        const y = startPanY + ev.clientY - startY;
        panRef.current = { x, y };
        setPanX(x);
        setPanY(y);
      };
      const onUp = () => {
        el.style.cursor = "";
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    };
    window.addEventListener("wheel", onWheel, { passive: false, capture: true });
    window.addEventListener("mousedown", onMouseDown, { capture: true });
    return () => {
      window.removeEventListener("wheel", onWheel, { capture: true });
      window.removeEventListener("mousedown", onMouseDown, { capture: true });
    };
  }, []);

  const selectedWidget = screen.widgets.find((w) => w.id === selectedId) ?? null;
  const selectedIds = multiSelect && selectedId && multiSelect.ids.includes(selectedId)
    ? multiSelect.ids
    : selectedId ? [selectedId] : [];

  // Cmd/Ctrl-click (canvas or layers tree): add/remove one widget from the
  // current multi-selection. Only allowed within the same parent as the
  // existing selection — group drag/snap assumes all selected widgets are siblings.
  const toggleSelectWidget = useCallback((id: string) => {
    const widget = screen.widgets.find((w) => w.id === id);
    if (!widget) return;
    if (selectedIds.includes(id)) {
      const next = selectedIds.filter((i) => i !== id);
      if (next.length <= 1) {
        setMultiSelect(null);
        setSelectedId(next[0] ?? null);
      } else {
        setMultiSelect({ ids: next });
        if (!next.includes(selectedId!)) setSelectedId(next[0]);
      }
      return;
    }
    const anchorParent = selectedIds.length > 0
      ? screen.widgets.find((w) => w.id === selectedIds[0])?.parentId
      : widget.parentId;
    if (selectedIds.length > 0 && widget.parentId !== anchorParent) {
      // Different parent than the current selection — start a fresh selection.
      setMultiSelect(null);
      setSelectedId(id);
      return;
    }
    setMultiSelect({ ids: [...selectedIds, id] });
    setSelectedId(id);
  }, [screen.widgets, selectedId, selectedIds]);

  const selectWidgetInTree = useCallback((id: string, shiftKey: boolean, modKey: boolean) => {
    if (modKey) {
      toggleSelectWidget(id);
      return;
    }
    if (shiftKey && selectedId) {
      const anchor = screen.widgets.find((w) => w.id === selectedId);
      const target = screen.widgets.find((w) => w.id === id);
      if (anchor && target && anchor.parentId === target.parentId) {
        const siblings = screen.widgets.filter((w) => w.parentId === anchor.parentId);
        const i = siblings.findIndex((w) => w.id === anchor.id);
        const j = siblings.findIndex((w) => w.id === target.id);
        const [lo, hi] = i < j ? [i, j] : [j, i];
        setMultiSelect({ ids: siblings.slice(lo, hi + 1).map((w) => w.id) });
        setSelectedId(id);
        return;
      }
    }
    setMultiSelect(null);
    setSelectedId(id);
  }, [screen.widgets, selectedId, toggleSelectWidget]);

  const commit = useCallback((next: HistoryEntry) => {
    const c = cursorRef.current;
    cursorRef.current = Math.min(c + 1, MAX_HISTORY - 1);
    setHistory((h) => {
      const trimmed = h.slice(0, c + 1);
      const capped = trimmed.length >= MAX_HISTORY ? trimmed.slice(1) : trimmed;
      return [...capped, next];
    });
    setCursor(cursorRef.current);
  }, []);

  const commitScreen = useCallback((next: ScreenSpec) => {
    commit({ screens: screens.map((s, i) => i === activeIdx ? next : s), activeIdx });
  }, [screens, activeIdx, commit]);

  const undo = useCallback(() => { setCursor((c) => Math.max(0, c - 1)); setSelectedId(null); }, []);
  const redo = useCallback(() => { setCursor((c) => Math.min(history.length - 1, c + 1)); setSelectedId(null); }, [history.length]);

  const updateWidget = useCallback((updated: WidgetSpec) => {
    // Most callers (drag/resize/nudge) update a widget in place with its id unchanged, so
    // matching on updated.id finds it. Renaming a widget's id (PropertyPanel's ID field) is the
    // one case where updated.id is the new, not-yet-present id — fall back to selectedId then.
    const matchId = screen.widgets.some((w) => w.id === updated.id) ? updated.id : selectedId;
    commitScreen({ ...screen, widgets: screen.widgets.map((w) => (w.id === matchId ? updated : w)) });
    if (updated.id !== selectedId) setSelectedId(updated.id);
  }, [screen, commitScreen, selectedId]);

  const toggleHiddenWidget = useCallback((id: string) => {
    const widget = screen.widgets.find(w => w.id === id);
    if (!widget) return;
    commitScreen({ ...screen, widgets: screen.widgets.map(w => w.id === id ? { ...w, hidden: !w.hidden } : w) });
  }, [screen, commitScreen]);

  const renameWidget = useCallback((id: string, name: string) => {
    const widget = screen.widgets.find(w => w.id === id);
    if (!widget) return;
    updateWidget({ ...widget, id: name });
  }, [screen, updateWidget]);

  const deleteWidget = useCallback((id = selectedId) => {
    if (!id) return;
    const target = screen.widgets.find(w => w.id === id);
    if (target?.type === "tab" && target.parentId) {
      const siblings = screen.widgets.filter(w => w.type === "tab" && w.parentId === target.parentId);
      if (siblings.length <= 1) return;
    }
    const collectDescendants = (rootId: string, all: WidgetSpec[]): Set<string> => {
      const ids = new Set<string>([rootId]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const w of all) {
          if (w.parentId && ids.has(w.parentId) && !ids.has(w.id)) {
            ids.add(w.id);
            changed = true;
          }
        }
      }
      return ids;
    };
    const toRemove = collectDescendants(id, screen.widgets);
    commitScreen({ ...screen, widgets: screen.widgets.filter((w) => !toRemove.has(w.id)) });
    setSelectedId(null);
  }, [screen, commitScreen, selectedId]);

  const addWidget = useCallback((type: string, parentId?: string, atX?: number, atY?: number) => {
    const def = getWidgetDef(type);
    if (!def) return;
    const id = newId(type, screen.widgets);
    const pos = atX !== undefined && atY !== undefined ? { x: atX, y: atY } : {};
    const sizeClamp = computeInitialSize(def.defaultWidget.w, def.defaultWidget.h, parentId, screen.widgets);
    const widget: WidgetSpec = { ...def.defaultWidget, id, ...sizeClamp, ...pos, ...(parentId ? { parentId } : {}) };
    const extra: WidgetSpec[] = [];
    if (type === "tabs") {
      const tabDef = getWidgetDef("tab");
      if (tabDef) extra.push({ ...tabDef.defaultWidget, id: newId("tab", [...screen.widgets, widget]), parentId: id });
    }
    commitScreen({ ...screen, widgets: [...screen.widgets, widget, ...extra] });
    setSelectedId(id);
  }, [screen, commitScreen]);

  const reorderWidget = useCallback((draggedIds: string[], overId: string, placement: "before" | "after" | "inside") => {
    if (draggedIds.length === 0 || draggedIds.includes(overId)) return;
    const widgets = screen.widgets;
    const draggedSet = new Set(draggedIds);
    const over = widgets.find(w => w.id === overId);
    if (!over) return;

    const absPos = (wid: string): { x: number; y: number } => {
      const w = widgets.find(v => v.id === wid);
      if (!w) return { x: 0, y: 0 };
      if (!w.parentId) return { x: w.x, y: w.y };
      const parent = absPos(w.parentId);
      return { x: parent.x + w.x, y: parent.y + w.y };
    };

    const newParentId: string | undefined = placement === "inside" ? overId : over.parentId;

    const isSelfOrDescendant = (candidate: string | undefined): boolean => {
      let cur = candidate;
      while (cur) {
        if (draggedSet.has(cur)) return true;
        cur = widgets.find(w => w.id === cur)?.parentId;
      }
      return false;
    };
    if (newParentId && isSelfOrDescendant(newParentId)) return;

    const newParentAbs = newParentId ? absPos(newParentId) : { x: 0, y: 0 };
    const without = widgets.filter(w => !draggedSet.has(w.id));
    const overIdx = without.findIndex(w => w.id === overId);
    const insertIdx = placement === "before" ? overIdx : overIdx + 1;
    const orderedDragged = widgets.filter(w => draggedSet.has(w.id));
    const updatedDragged = orderedDragged.map(w => {
      const abs = absPos(w.id);
      return { ...w, x: abs.x - newParentAbs.x, y: abs.y - newParentAbs.y, parentId: newParentId };
    });
    commitScreen({ ...screen, widgets: [...without.slice(0, insertIdx), ...updatedDragged, ...without.slice(insertIdx)] });
  }, [screen, commitScreen]);

  const updateBindingsSchema = useCallback((schema: import("@/lib/types").BindingsSchema) => {
    commitScreen({ ...screen, bindingsSchema: Object.keys(schema).length ? schema : undefined });
  }, [screen, commitScreen]);

  const updateActions = useCallback((actions: string[]) => {
    commitScreen({ ...screen, actions: actions.length ? actions : undefined });
  }, [screen, commitScreen]);

  const reparentWidget = useCallback((id: string, newParentId: string | null) => {
    const widget = screen.widgets.find(w => w.id === id);
    if (!widget) return;
    const absPos = (wid: string): { x: number; y: number } => {
      const w = screen.widgets.find(v => v.id === wid);
      if (!w) return { x: 0, y: 0 };
      if (!w.parentId) return { x: w.x, y: w.y };
      const parent = absPos(w.parentId);
      return { x: parent.x + w.x, y: parent.y + w.y };
    };
    const current = absPos(id);
    const newParentAbs = newParentId ? absPos(newParentId) : { x: 0, y: 0 };
    commitScreen({
      ...screen,
      widgets: screen.widgets.map(w =>
        w.id === id ? { ...w, x: current.x - newParentAbs.x, y: current.y - newParentAbs.y, parentId: newParentId ?? undefined } : w
      ),
    });
  }, [screen, commitScreen]);

  const copyWidget    = useCallback(() => { if (selectedWidget) clipboardRef.current = selectedWidget; }, [selectedWidget]);
  const pasteWidget   = useCallback(() => {
    const src = clipboardRef.current;
    if (!src) return;
    const id = newId(src.type, screen.widgets);
    commitScreen({ ...screen, widgets: [...screen.widgets, { ...src, id, x: src.x + 8, y: src.y + 8 }] });
    setSelectedId(id);
  }, [screen, commitScreen]);
  const duplicateWidget = useCallback(() => {
    if (!selectedWidget) return;
    const id = newId(selectedWidget.type, screen.widgets);
    commitScreen({ ...screen, widgets: [...screen.widgets, { ...selectedWidget, id, x: selectedWidget.x + 8, y: selectedWidget.y + 8 }] });
    setSelectedId(id);
  }, [screen, commitScreen, selectedWidget]);
  const nudgeWidget = useCallback((dx: number, dy: number) => {
    if (!selectedWidget) return;
    updateWidget({ ...selectedWidget, x: selectedWidget.x + dx, y: selectedWidget.y + dy });
  }, [selectedWidget, updateWidget]);

  const addScreen = useCallback(() => {
    const newScreen: ScreenSpec = { id: `screen_${screens.length + 1}`, modId: screen.modId, width: 320, height: 180, widgets: [] };
    commit({ screens: [...screens, newScreen], activeIdx: screens.length });
    setSelectedId(null);
  }, [screens, screen.modId, commit]);

  const removeScreen = useCallback((idx: number) => {
    if (screens.length <= 1) return;
    const next = screens.filter((_, i) => i !== idx);
    const newActiveIdx = idx < activeIdx ? activeIdx - 1 : idx === activeIdx ? Math.min(activeIdx, next.length - 1) : activeIdx;
    commit({ screens: next, activeIdx: newActiveIdx });
    setSelectedId(null);
  }, [screens, activeIdx, commit]);

  const renameScreen = useCallback((idx: number, name: string) => {
    commit({ screens: screens.map((s, i) => i === idx ? { ...s, id: name } : s), activeIdx });
  }, [screens, activeIdx, commit]);

  const moveScreen = useCallback((fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx) return;
    const next = arrayMove(screens, fromIdx, toIdx);
    const newActiveIdx = fromIdx === activeIdx ? toIdx
      : fromIdx < activeIdx && toIdx >= activeIdx ? activeIdx - 1
      : fromIdx > activeIdx && toIdx <= activeIdx ? activeIdx + 1
      : activeIdx;
    commit({ screens: next, activeIdx: newActiveIdx });
  }, [screens, activeIdx, commit]);

  const switchScreen = useCallback((idx: number) => {
    setHistory(h => h.map((e, i) => i === cursor ? { ...e, activeIdx: idx } : e));
    setSelectedId(null);
  }, [cursor]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const inInput = !!target.closest?.("input, textarea, select, [contenteditable='true']");
      if (inInput) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); return; }
      if (mod && (e.key === "y" || (e.key === "z" && e.shiftKey))) { e.preventDefault(); redo(); return; }
      if (mod && (e.key === "=" || e.key === "+")) { e.preventDefault(); zoomIn(); return; }
      if (mod && e.key === "-") { e.preventDefault(); zoomOut(); return; }
      if (mod && e.key === "0") { e.preventDefault(); zoomReset(); return; }
      if (mod && e.key === "c") { e.preventDefault(); copyWidget(); return; }
      if (mod && e.key === "v") { e.preventDefault(); pasteWidget(); return; }
      if (mod && e.key === "d") { e.preventDefault(); duplicateWidget(); return; }
      if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); deleteWidget(); return; }
      if (e.key === "Escape") { if (tryMode) setTryMode(false); else setSelectedId(null); return; }
      if (e.key === "t" || e.key === "T") { setTryMode((v) => { if (!v) setSelectedId(null); return !v; }); return; }
      const step = e.shiftKey ? gridSize : 1;
      if (e.key === "ArrowLeft")  { e.preventDefault(); nudgeWidget(-step, 0); return; }
      if (e.key === "ArrowRight") { e.preventDefault(); nudgeWidget(step, 0);  return; }
      if (e.key === "ArrowUp")    { e.preventDefault(); nudgeWidget(0, -step); return; }
      if (e.key === "ArrowDown")  { e.preventDefault(); nudgeWidget(0, step);  return; }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undo, redo, copyWidget, pasteWidget, duplicateWidget, deleteWidget, nudgeWidget, gridSize, tryMode, zoomIn, zoomOut, zoomReset]);

  const handleExportScreen = useCallback((idx: number) => {
    try {
      const target = screens[idx];
      const exported = buildExportedScreen(target);
      const json = JSON.stringify(exported, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${target.id}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(`Could not export: ${e instanceof Error ? e.message : e}`);
    }
  }, [screens]);

  const handleCopyJava = useCallback(async () => {
    try {
      const java = generateJavaClass(screen);
      await navigator.clipboard.writeText(java);
    } catch (e) {
      alert(`Could not copy: ${e instanceof Error ? e.message : e}`);
    }
  }, [screen]);

  const handleImportClick = () => importRef.current?.click();
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const migrated = migrateScreenJson(JSON.parse(ev.target?.result as string) as Record<string, unknown>);
        const parsed = normalizeScreen(migrated);
        if (!parsed.id || !Array.isArray(parsed.widgets)) throw new Error("Invalid ScreenSpec");
        const existingIds = new Set(screens.map((s) => s.id));
        let id = parsed.id;
        let suffix = 2;
        while (existingIds.has(id)) id = `${parsed.id}_${suffix++}`;
        const newScreen: ScreenSpec = { ...parsed, id };
        commit({ screens: [...screens, newScreen], activeIdx: screens.length });
        setSelectedId(null);
      } catch {
        alert("Failed to parse ScreenSpec JSON.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleExportProject = useCallback(() => {
    try {
      const project: ProjectFile = {
        name: projectKey,
        screens: screens.map(buildExportedScreen),
        appVersion: APP_VERSION,
      };
      const json = JSON.stringify(project, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${projectKey}.project.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(`Could not export project: ${e instanceof Error ? e.message : e}`);
    }
  }, [projectKey, screens]);

  const handleExportPng = useCallback(async () => {
    if (!selectedWidget) {
      toast.error("Select a widget to export as PNG.");
      return;
    }
    const widgetElement = [...(canvasWrapperRef.current?.querySelectorAll<HTMLElement>("[data-widget-id]") ?? [])]
      .find((element) => element.dataset.widgetId === selectedWidget.id);
    if (!widgetElement) {
      toast.error(`Could not find widget ${selectedWidget.id} to export.`);
      return;
    }

    setExportingPng(true);
    try {
      const blob = await exportWidgetPng(widgetElement, selectedWidget.w, selectedWidget.h);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${selectedWidget.id}.png`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success(`Exported ${selectedWidget.id}.png (${selectedWidget.w} × ${selectedWidget.h}px)`);
    } catch (error) {
      toast.error(`Could not export PNG: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setExportingPng(false);
    }
  }, [selectedWidget]);

  const handleImportProjectClick = () => importProjectRef.current?.click();
  const handleImportProjectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const migrated = migrateProjectJson(JSON.parse(ev.target?.result as string) as Record<string, unknown>) as unknown as ProjectFile;
        if (!Array.isArray(migrated.screens) || migrated.screens.length === 0) throw new Error("Invalid project file");
        const importedScreens = migrated.screens
          .map((s) => migrateScreenJson(s as unknown as Record<string, unknown>))
          .map(normalizeScreen);
        for (const s of importedScreens) {
          if (!s.id || !Array.isArray(s.widgets)) throw new Error("Invalid ScreenSpec in project");
        }
        commit({ screens: importedScreens, activeIdx: 0 });
        setSelectedId(null);
      } catch {
        alert("Failed to parse project JSON.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleSaveToTestMod = useCallback(async () => {
    try {
      const exported = buildExportedScreen(screen);
      const res = await fetch("/api/dev/test-screen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(exported),
      });
      if (!res.ok) throw new Error("Server error");
    } catch (e) {
      alert(`Could not save to test mod: ${e instanceof Error ? e.message : e}`);
    }
  }, [screen]);

  if (!projectLoaded || !initialized) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-200">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-gray-400 border-t-transparent" />
      </div>
    );
  }

  return (
    <>
      <TexturePickerModal
        open={showTextureDebug}
        packTextures={packTextures}
        current=""
        onSelect={() => {}}
        onClose={() => setShowTextureDebug(false)}
      />
      <SidebarProvider>
        {!tryMode && (
          <AppSidebar
            screens={screens}
            activeIdx={activeIdx}
            modId={screen.modId}
            widgets={screen.widgets}
            selectedId={selectedId}
            selectedIds={selectedIds}
            onGoHome={() => router.push("/")}
            onSelectScreen={switchScreen}
            onAddScreen={addScreen}
            onRemoveScreen={removeScreen}
            onRenameScreen={renameScreen}
            onMoveScreen={moveScreen}
            onImportScreen={handleImportClick}
            onExportScreen={handleExportScreen}
            onAddWidget={addWidget}
            onSelectWidget={selectWidgetInTree}
            onDeleteWidget={deleteWidget}
            onToggleHiddenWidget={toggleHiddenWidget}
            onRenameWidget={renameWidget}
            onReparentWidget={reparentWidget}
            onReorderWidget={reorderWidget}
          />
        )}

        <div className="flex flex-1 flex-col overflow-hidden h-svh">
          <Toolbar
            screen={screen}
            selectedWidget={selectedWidget}
            gridSize={gridSize}
            showGrid={showGrid}
            snapToParent={snapToParent}
            snapToSiblings={snapToSiblings}
            canUndo={cursor > 0}
            canRedo={cursor < history.length - 1}
            tryMode={tryMode}
            onUndo={undo}
            onRedo={redo}
            onGridSizeChange={setGridSize}
            onToggleGrid={() => setShowGrid((v) => !v)}
            onToggleSnapToParent={() => setSnapToParent((v) => !v)}
            onToggleSnapToSiblings={() => setSnapToSiblings((v) => !v)}
            onToggleTryMode={() => { setTryMode((v) => { if (!v) setSelectedId(null); return !v; }); }}
            onScreenChange={(patch) => commitScreen({ ...screen, ...patch })}
            onExportProject={handleExportProject}
            onImportProject={handleImportProjectClick}
            onCopyJava={handleCopyJava}
            onExportPng={handleExportPng}
            exportingPng={exportingPng}
            onResetTextures={handleResetTextures}
            onViewTextures={() => setShowTextureDebug(true)}
            onExtractPack={extractPack}
            onSaveToTestMod={process.env.NODE_ENV === "development" ? handleSaveToTestMod : undefined}
            scale={scale}
            onZoomIn={zoomIn}
            onZoomOut={zoomOut}
            onZoomReset={zoomReset}
            bindingsSchema={screen.bindingsSchema ?? {}}
            onUpdateBindingsSchema={updateBindingsSchema}
            actions={screen.actions ?? []}
            onUpdateActions={updateActions}
            modId={screen.modId}
          />

          <div className="flex flex-1 overflow-hidden">
            <div
              ref={canvasWrapperRef}
              className="flex flex-1 overflow-hidden p-8"
              onMouseDown={(e) => {
                if (e.target !== e.currentTarget) return; // only the wrapper background, not canvas
                if (document.activeElement instanceof HTMLInputElement) document.activeElement.blur();
                setSelectedId(null);
              }}
            >
              <div style={{ transform: `translate(${panX}px, ${panY}px)`, margin: "auto", flexShrink: 0 }}>
              <Canvas
                width={screen.width}
                height={screen.height}
                scale={scale}
                widgets={screen.widgets}
                selectedId={selectedId}
                selectedIds={selectedIds}
                gridSize={gridSize}
                showGrid={showGrid}
                snapToParent={snapToParent}
                snapToSiblings={snapToSiblings}
                tryMode={tryMode}
                onSelect={setSelectedId}
                onToggleSelect={toggleSelectWidget}
                onUpdateWidget={updateWidget}
                onUpdateWidgets={(updated) => {
                  const updatedIds = new Set(updated.map(w => w.id));
                  const merged = screen.widgets.map(w => updatedIds.has(w.id) ? updated.find(u => u.id === w.id)! : w);
                  commitScreen({ ...screen, widgets: merged });
                }}
                bindingsSchema={screen.bindingsSchema ?? {}}
                onAddWidget={(type, x, y) => addWidget(type, undefined, x, y)}
              />
              </div>
            </div>

            {!tryMode && (
              <aside className="w-64 shrink-0 border-l bg-background overflow-y-auto">
                <PropertyPanel
                  widget={selectedWidget}
                  onUpdate={updateWidget}
                  bindingsSchema={screen.bindingsSchema ?? {}}
                  actions={screen.actions ?? []}
                  onCreateAction={(name) => {
                    const updatedWidgets = selectedWidget
                      ? screen.widgets.map(w => w.id === selectedWidget.id ? { ...w, action: name } : w)
                      : screen.widgets;
                    commitScreen({ ...screen, actions: [...(screen.actions ?? []), name], widgets: updatedWidgets });
                  }}
                  inventoryAreaIds={screen.widgets.filter((w) => w.type === "inventory_area").map((w) => w.id)}
                />
              </aside>
            )}
          </div>
        </div>

        <input
          ref={importRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={handleImportFile}
        />
        <input
          ref={importProjectRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={handleImportProjectFile}
        />
      </SidebarProvider>
    </>
  );
}
