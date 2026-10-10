import { saveTexture } from "./textureStore";
import {
  TASKS_9SLICE, NESTED_TAB_TASKS, CHECKBOX_SPRITES, SLOT_HINT_SPRITES, TAB_SPRITES,
  SLOT_SPRITE_PATH, SLOT_CROP, SCROLLBAR_SPRITE_PATH, SCROLLBAR_ATLAS_FALLBACK,
  sample9slice, bitmapToImageData, imageDataToBlob, cropImageData,
} from "./textureTasks";
import type { ExtractResult } from "./extractFromPack";

/** Fetches a texture from the locally bundled Minecraft assets as an ImageBitmap. */
async function readBitmap(assetPath: string): Promise<ImageBitmap | null> {
  try {
    const texturePath = assetPath.replace(/^assets\/minecraft\/textures\//, "");
    const res = await fetch(`/textures/minecraft/${texturePath}`);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await createImageBitmap(blob);
  } catch {
    return null;
  }
}

/**
 * Extracts the standard GUI assets from the locally bundled Minecraft 26.3
 * textures with the same processing used for uploaded resource packs.
 */
export async function extractFromLocal(): Promise<ExtractResult> {
  const extracted: string[] = [];
  const missing: string[] = [];

  for (const task of [...TASKS_9SLICE, ...NESTED_TAB_TASKS]) {
    const bitmap = await readBitmap(task.path);
    if (!bitmap) { missing.push(task.name); continue; }
    const srcData = bitmapToImageData(bitmap);
    const bitmapWidth = bitmap.width;
    bitmap.close();
    const blob = await imageDataToBlob(sample9slice(srcData, bitmapWidth, task));
    await saveTexture(task.name, blob);
    extracted.push(task.name);
  }

  for (const { name, path } of [...CHECKBOX_SPRITES, ...SLOT_HINT_SPRITES, ...TAB_SPRITES]) {
    const bitmap = await readBitmap(path);
    if (bitmap) {
      const blob = await imageDataToBlob(bitmapToImageData(bitmap));
      bitmap.close();
      await saveTexture(name, blob);
      extracted.push(name);
    } else if (!SLOT_HINT_SPRITES.some((sprite) => sprite.name === name)) {
      missing.push(name);
    }
  }

  const slotBitmap = await readBitmap(SLOT_SPRITE_PATH);
  if (slotBitmap) {
    const blob = await imageDataToBlob(bitmapToImageData(slotBitmap));
    slotBitmap.close();
    await saveTexture("mc_slot_tile.png", blob);
    extracted.push("mc_slot_tile.png");
  } else {
    const inventoryBitmap = await readBitmap(SLOT_CROP.path);
    if (inventoryBitmap) {
      const srcData = bitmapToImageData(inventoryBitmap);
      inventoryBitmap.close();
      const cropped = cropImageData(srcData, SLOT_CROP.x, SLOT_CROP.y, SLOT_CROP.w, SLOT_CROP.h);
      const blob = await imageDataToBlob(cropped);
      await saveTexture("mc_slot_tile.png", blob);
      extracted.push("mc_slot_tile.png");
    } else {
      missing.push("mc_slot_tile.png");
    }
  }

  const scrollbarBitmap = await readBitmap(SCROLLBAR_SPRITE_PATH);
  if (scrollbarBitmap) {
    const blob = await imageDataToBlob(bitmapToImageData(scrollbarBitmap));
    scrollbarBitmap.close();
    await saveTexture("mc_scrollbar_handle.png", blob);
    extracted.push("mc_scrollbar_handle.png");
  } else {
    const tabsBitmap = await readBitmap(SCROLLBAR_ATLAS_FALLBACK.path);
    if (tabsBitmap) {
      const srcData = bitmapToImageData(tabsBitmap);
      tabsBitmap.close();
      const cropped = cropImageData(
        srcData,
        SCROLLBAR_ATLAS_FALLBACK.x, SCROLLBAR_ATLAS_FALLBACK.y,
        SCROLLBAR_ATLAS_FALLBACK.w, SCROLLBAR_ATLAS_FALLBACK.h
      );
      const blob = await imageDataToBlob(cropped);
      await saveTexture("mc_scrollbar_handle.png", blob);
      extracted.push("mc_scrollbar_handle.png");
    } else {
      missing.push("mc_scrollbar_handle.png");
    }
  }

  return { extracted, missing };
}

/**
 * Backfills the optional vanilla slot silhouettes for users who already have
 * the required GUI textures cached from an older app version. These assets
 * are intentionally optional: failure must not block the editor.
 */
export async function extractSlotHintTexturesFromLocal(): Promise<void> {
  for (const { name, path } of SLOT_HINT_SPRITES) {
    const bitmap = await readBitmap(path);
    if (!bitmap) continue;
    const blob = await imageDataToBlob(bitmapToImageData(bitmap));
    bitmap.close();
    await saveTexture(name, blob);
  }
}

// ── Local catalog for sprite and icon widgets ──
export async function fetchLocalTextureCatalog(): Promise<Record<string, string>> {
  try {
    const res = await fetch("/textures/minecraft/catalog.json");
    if (!res.ok) return {};
    const paths: string[] = await res.json();
    const catalog: Record<string, string> = {};
    for (const path of paths) catalog[path] = `/textures/minecraft/${path}`;
    return catalog;
  } catch {
    return {};
  }
}
