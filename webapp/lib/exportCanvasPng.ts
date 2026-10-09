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
  for (let index = 0; index < computed.length; index++) {
    const property = computed.item(index);
    style.setProperty(property, computed.getPropertyValue(property), computed.getPropertyPriority(property));
  }
}

async function inlineCssUrls(value: string): Promise<string> {
  const matches = [...value.matchAll(/url\((?:"([^"]*)"|'([^']*)'|([^)]*))\)/g)];
  let result = value;
  for (const match of matches) {
    const sourceUrl = (match[1] ?? match[2] ?? match[3] ?? "").trim();
    if (!sourceUrl || sourceUrl.startsWith("data:")) continue;
    const dataUrl = await inlineAsset(sourceUrl);
    result = result.replace(match[0], `url("${dataUrl}")`);
  }
  return result;
}

/** Rasterizes the rendered editor canvas at the screen's native Minecraft-pixel size. */
export async function exportCanvasPng(element: HTMLElement, width: number, height: number): Promise<Blob> {
  const bounds = element.getBoundingClientRect();
  if (!bounds.width || !bounds.height || !width || !height) throw new Error("The canvas has no size to export.");

  const clone = element.cloneNode(true) as HTMLElement;
  const sourceElements = [element, ...element.querySelectorAll("*")];
  const clonedElements = [clone, ...clone.querySelectorAll("*")];
  for (let index = 0; index < sourceElements.length; index++) {
    copyComputedStyles(sourceElements[index], clonedElements[index]);
  }

  // Editor-only overlays should not appear in the exported design.
  clone.querySelectorAll("[data-export-ignore], .react-resizable-handle").forEach((node) => node.remove());
  clone.querySelectorAll<HTMLElement>("[data-widget-id]").forEach((node) => {
    node.style.outline = "none";
    node.style.cursor = "default";
  });

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
    const sourceUrl = sourceImages[index]?.currentSrc || sourceImages[index]?.src;
    if (sourceUrl) image.src = await getAsset(sourceUrl);
  }));

  const styledElements = [clone, ...clone.querySelectorAll<HTMLElement | SVGElement>("*")];
  await Promise.all(styledElements.map(async (node) => {
    const background = node.style.backgroundImage;
    const borderImage = node.style.borderImageSource;
    if (background && background !== "none") node.style.backgroundImage = await inlineCssUrls(background);
    if (borderImage && borderImage !== "none") node.style.borderImageSource = await inlineCssUrls(borderImage);
  }));

  // Minecraft labels use a local pixel font; embedding it keeps the export independent of page CSS.
  const fontData = await getAsset("/fonts/Minecraft.otf");
  const wrapper = document.createElementNS(XHTML_NS, "div");
  wrapper.setAttribute("xmlns", XHTML_NS);
  wrapper.style.cssText = `position:relative;width:${bounds.width}px;height:${bounds.height}px;overflow:hidden;`;
  const fontStyle = document.createElementNS(XHTML_NS, "style");
  fontStyle.textContent = `@font-face{font-family:Minecraft;src:url("${fontData}") format("opentype");font-weight:normal;font-style:normal}`;
  wrapper.append(fontStyle, clone);

  const serialized = new XMLSerializer().serializeToString(wrapper);
  const svg = `<svg xmlns="${SVG_NS}" width="${bounds.width}" height="${bounds.height}" viewBox="0 0 ${bounds.width} ${bounds.height}"><foreignObject x="0" y="0" width="100%" height="100%">${serialized}</foreignObject></svg>`;
  const svgUrl = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));

  try {
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
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}
