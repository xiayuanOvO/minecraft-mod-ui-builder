"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { clearTextures, loadAllTextures, saveTexture } from "./textureStore";
import { extractFromPack, type ExtractResult } from "./extractFromPack";
import { extractFromLocal, extractSlotHintTexturesFromLocal, fetchLocalTextureCatalog } from "./extractFromLocal";

export const REQUIRED_TEXTURES = [
  "mc_panel_slice.png",
  "mc_slider_track_slice.png",
  "mc_slider_handle_slice.png",
  "mc_button_normal.png",
  "mc_button_hover.png",
  "mc_slot_tile.png",
  "mc_scrollbar_handle.png",
  "mc_checkbox.png",
  "mc_checkbox_selected.png",
  "mc_checkbox_highlighted.png",
  "mc_checkbox_selected_highlighted.png",
  "tab_selected_left.png",
  "tab_selected_middle.png",
  "tab_selected_right.png",
  "tab_unselected_left.png",
  "tab_unselected_middle.png",
  "tab_unselected_right.png",
  "widget_tab_selected.png",
  "widget_tab_unselected.png",
] as const;

export const OPTIONAL_TEXTURES = [
  "mc_slot_hint_helmet.png",
  "mc_slot_hint_chestplate.png",
  "mc_slot_hint_leggings.png",
  "mc_slot_hint_boots.png",
  "mc_slot_hint_shield.png",
] as const;

const ALL_TEXTURES = [...REQUIRED_TEXTURES, ...OPTIONAL_TEXTURES] as const;
export type TextureName = (typeof ALL_TEXTURES)[number];

interface TextureCtx {
  textures: Partial<Record<TextureName, string>>;
  packTextures: Record<string, string>;
  ready: boolean;
  initialized: boolean;
  setupRequired: boolean;
  uploadFiles: (files: FileList) => Promise<void>;
  extractPack: (file: File) => Promise<ExtractResult>;
  reload: () => Promise<void>;
  reset: () => Promise<void>;
}

const Ctx = createContext<TextureCtx>({
  textures: {},
  packTextures: {},
  ready: false,
  initialized: false,
  setupRequired: false,
  uploadFiles: async () => {},
  extractPack: async () => ({ extracted: [], missing: [] }),
  reload: async () => {},
  reset: async () => {},
});

export function useTextures() {
  return useContext(Ctx);
}

export function TextureProvider({ children }: { children: React.ReactNode }) {
  const [textures, setTextures] = useState<Partial<Record<TextureName, string>>>({});
  const [packTextures, setPackTextures] = useState<Record<string, string>>({});
  const [initialized, setInitialized] = useState(false);
  const [setupRequired, setSetupRequired] = useState(false);
  const urlsRef = useRef<string[]>([]);
  // Local Minecraft texture URLs for sprite/icon widgets, merged under any
  // keys an uploaded pack provides.
  const localCatalogRef = useRef<Record<string, string>>({});

  const applyBlobs = (blobs: Record<string, Blob>) => {
    urlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    urlsRef.current = [];
    const next: Partial<Record<TextureName, string>> = {};
    const pack: Record<string, string> = { ...localCatalogRef.current };
    for (const name of ALL_TEXTURES) {
      if (blobs[name]) {
        const url = URL.createObjectURL(blobs[name]);
        urlsRef.current.push(url);
        next[name] = url;
        // Also expose derived textures in the picker under a virtual folder
        pack[`extracted/${name}`] = url;
      }
    }
    setTextures(next);
    for (const [key, blob] of Object.entries(blobs)) {
      if (key.startsWith("pack:")) {
        const url = URL.createObjectURL(blob);
        urlsRef.current.push(url);
        pack[key.slice(5)] = url; // uploaded pack files override bundled texture URLs
      }
    }
    setPackTextures(pack);
  };

  /**
   * Loads cached textures, then fills missing defaults from the project's
   * locally bundled Minecraft 26.3 assets. Shared by mount and reset().
   */
  const loadOrPrepareLocalTextures = async () => {
    let blobs = await loadAllTextures();
    if (Object.keys(blobs).length === 0) {
      const result = await extractFromLocal().catch(() => null);
      blobs = await loadAllTextures();
      const gotAllRequired = result && result.missing.length === 0;
      if (!gotAllRequired || Object.keys(blobs).length === 0) {
        setSetupRequired(true);
        setInitialized(true);
        return;
      }
    } else if (OPTIONAL_TEXTURES.some((name) => !blobs[name])) {
      // Backfill slot hints missing from older local caches.
      await extractSlotHintTexturesFromLocal().catch(() => {});
      blobs = await loadAllTextures();
    }
    applyBlobs(blobs);
    setSetupRequired(false);
    setInitialized(true);
  };

  useEffect(() => {
    fetchLocalTextureCatalog().then((catalog) => {
      localCatalogRef.current = catalog;
      setPackTextures((prev) => ({ ...catalog, ...prev }));
    });

    loadOrPrepareLocalTextures().catch((e) => {
      console.error(e);
      setSetupRequired(true);
      setInitialized(true);
    });
    return () => { urlsRef.current.forEach((u) => URL.revokeObjectURL(u)); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const uploadFiles = async (files: FileList) => {
    const blobs = await loadAllTextures();
    for (const file of Array.from(files)) {
      if ((ALL_TEXTURES as readonly string[]).includes(file.name)) {
        await saveTexture(file.name, file);
        blobs[file.name] = file;
      }
    }
    applyBlobs(blobs);
  };

  const extractPackFn = async (file: File): Promise<ExtractResult> => {
    const buffer = await file.arrayBuffer();
    const result = await extractFromPack(buffer);
    applyBlobs(await loadAllTextures());
    setSetupRequired(false);
    setInitialized(true);
    return result;
  };

  const reload = async () => {
    applyBlobs(await loadAllTextures());
  };

  const reset = async () => {
    await clearTextures();
    urlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    urlsRef.current = [];
    setTextures({});
    setPackTextures({});
    // Same local asset loading flow as first mount.
    await loadOrPrepareLocalTextures();
  };

  const ready = REQUIRED_TEXTURES.every((n) => !!textures[n]);

  return (
    <Ctx.Provider value={{ textures, packTextures, ready, initialized, setupRequired, uploadFiles, extractPack: extractPackFn, reload, reset }}>
      {children}
    </Ctx.Provider>
  );
}
