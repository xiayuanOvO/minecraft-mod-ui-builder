const XHTML_NS = "http://www.w3.org/1999/xhtml";
const SVG_NS = "http://www.w3.org/2000/svg";

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Could not read image asset."));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read image asset."));
    reader.readAsDataURL(blob);
  });
}

async function inlineAsset(url: string): Promise<string> {
  if (url.startsWith("data:")) return url;
  const absoluteUrl = new URL(url, document.baseURI).href;
  const response = await fetch(absoluteUrl, { mode: "cors", credentials: "same-origin" });
  if (!response.ok) throw new Error(`Could not load image asset (${response.status}).`);
  return blobToDataUrl(await response.blob());
}

function copyComputedStyles(source: Element, target: Element): void {
  const computed = getComputedStyle(source);
  const style = (target as HTMLElement | SVGElement).style;
  // cloneNode preserves React's original inline styles, including CSS shorthands
  // with blob URLs. Start clean so those shorthands cannot override the inlined
  // computed longhand values below.
  style.cssText = "";
  for (let index = 0; index < computed.length; index++) {
    const property = computed.item(index);
    // Chromium exposes this prefixed alias as well as the standard property.
    // Keeping it can preserve the original non-inlined border-image URL.
    if (property === "-webkit-border-image") continue;
    style.setProperty(property, computed.getPropertyValue(property), computed.getPropertyPriority(property));
  }
}

async function inlineCssUrls(value: string): Promise<string> {
  const matches = [...value.matchAll(/url\((?:"([^"]*)"|'([^']*)'|([^)]*))\)/g)];
  let result = value;
  for (const match of matches) {
    const sourceUrl = (match[1] ?? match[2] ?? match[3] ?? "").trim();
    if (!sourceUrl || sourceUrl.startsWith("data:") || sourceUrl.startsWith("#")) continue;
    const dataUrl = await inlineAsset(sourceUrl);
    result = result.replace(match[0], `url("${dataUrl}")`);
  }
  return result;
}

function svgDataUrl(svg: string): string {
  const bytes = new TextEncoder().encode(svg);
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return `data:image/svg+xml;base64,${btoa(binary)}`;
}

/** Rasterizes one selected widget at its native Minecraft-pixel size. */
export async function exportWidgetPng(element: HTMLElement, width: number, height: number): Promise<Blob> {
  const bounds = element.getBoundingClientRect();
  if (!bounds.width || !bounds.height || !width || !height) throw new Error("The widget has no size to export.");

  const clone = element.cloneNode(true) as HTMLElement;
  const sourceElements = [element, ...element.querySelectorAll("*")];
  const clonedElements = [clone, ...clone.querySelectorAll("*")];
  for (let index = 0; index < sourceElements.length; index++) {
    copyComputedStyles(sourceElements[index], clonedElements[index]);
  }

  // A widget normally sits at its screen position inside the editor canvas.
  // Move its cloned root to the export origin while preserving descendant
  // positions, so the PNG contains only this widget and its nested contents.
  clone.style.position = "relative";
  clone.style.left = "0";
  clone.style.top = "0";
  clone.style.right = "auto";
  clone.style.bottom = "auto";
  clone.style.transform = "none";
  clone.style.width = `${width}px`;
  clone.style.height = `${height}px`;
  clone.style.zIndex = "auto";

  const assets = new Map<string, Promise<string>>();
  const getAsset = (url: string) => {
    let asset = assets.get(url);
    if (!asset) {
      asset = inlineAsset(url);
      assets.set(url, asset);
    }
    return asset;
  };

  const sourceImages = [...element.querySelectorAll("img")];
  const clonedImages = [...clone.querySelectorAll("img")];
  await Promise.all(clonedImages.map(async (image, index) => {
    image.removeAttribute("srcset");
    const sourceUrl = sourceImages[index]?.currentSrc || sourceImages[index]?.src;
    if (sourceUrl) {
      image.src = await getAsset(sourceUrl);
    }
  }));

  // Inline every CSS URL, not only backgrounds and border images. Sprite icons and
  // user-provided textures can be used by other CSS properties too; leaving any
  // remote URL in the SVG taints the raster canvas in Chromium-based browsers.
  const styledElements = [clone, ...clone.querySelectorAll<HTMLElement | SVGElement>("*")];
  await Promise.all(styledElements.map(async (node) => {
    for (let index = 0; index < node.style.length; index++) {
      const property = node.style.item(index);
      const value = node.style.getPropertyValue(property);
      if (value.includes("url(")) {
        node.style.setProperty(property, await inlineCssUrls(value), node.style.getPropertyPriority(property));
      }
    }
  }));

  const linkedImages = [...clone.querySelectorAll<SVGImageElement>("image")];
  await Promise.all(linkedImages.map(async (image) => {
    const attribute = image.hasAttribute("href") ? "href" : "xlink:href";
    const sourceUrl = image.getAttribute(attribute);
    if (sourceUrl && !sourceUrl.startsWith("data:") && !sourceUrl.startsWith("#")) {
      image.setAttribute(attribute, await getAsset(sourceUrl));
    }
  }));

  await Promise.all([...clone.querySelectorAll("img")].map((image) => image.decode().catch(() => {})));

  // Editor-only overlays should not appear in the exported design. Remove them
  // after resource inlining so the source/clone image lists stay aligned.
  clone.querySelectorAll("[data-export-ignore], .react-resizable-handle").forEach((node) => node.remove());
  [clone, ...clone.querySelectorAll<HTMLElement>("[data-widget-id]")].forEach((node) => {
    node.style.outline = "none";
    node.style.cursor = "default";
  });

  const wrapper = document.createElementNS(XHTML_NS, "div");
  wrapper.setAttribute("xmlns", XHTML_NS);
  wrapper.style.cssText = `position:relative;width:${width}px;height:${height}px;overflow:hidden;`;
  const fontData = await getAsset("/fonts/Minecraft.otf");
  const fontStyle = document.createElementNS(XHTML_NS, "style");
  fontStyle.textContent = `@font-face{font-family:Minecraft;src:url("${fontData}") format("opentype");font-weight:normal;font-style:normal}`;
  wrapper.append(fontStyle, clone);

  const serialized = new XMLSerializer().serializeToString(wrapper);
  const svg = `<svg xmlns="${SVG_NS}" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><foreignObject x="0" y="0" width="100%" height="100%">${serialized}</foreignObject></svg>`;
  const svgUrl = svgDataUrl(svg);
  const image = new Image();
  image.src = svgUrl;
  await image.decode();

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not create an image canvas.");
  context.imageSmoothingEnabled = false;
  context.drawImage(image, 0, 0, width, height);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Could not encode the PNG image.")), "image/png");
  });
}
