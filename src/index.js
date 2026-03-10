export {
  createTransmuteRuntime,
  formatFileSize,
  DEFAULT_TRANSMUTE_FORMATS,
  DEFAULT_TRANSMUTE_KINDS,
  DEFAULT_TRANSMUTE_HANDLERS,
  DEFAULT_TRANSMUTE_NORMALISERS,
} from "./runtime.js";

export { TransmuteRegistry } from "./registry.js";

export {
  PNG_FORMAT,
  JPG_FORMAT,
  WEBP_FORMAT,
  SVG_FORMAT,
  GIF_FORMAT,
  BMP_FORMAT,
  TIFF_FORMAT,
  ICO_FORMAT,
  AVIF_FORMAT,
  TRANSMUTE_IMAGE_FORMATS,
  TRANSMUTE_FORMATS,
} from "./formats.js";

export { RASTER_IMAGE_KIND, TRANSMUTE_KINDS } from "./kinds.js";

export {
  BROWSER_IMAGE_RASTER_NORMALISER,
  TRANSMUTE_NORMALISERS,
} from "./normalisers.js";

export {
  readRasterAsset,
  renderRasterToCanvas,
  canvasToBlob,
} from "./handlers/raster.js";

export async function loadPngHandler() {
  return (await import("./handlers/png.js")).pngHandler;
}

export async function loadJpgHandler() {
  return (await import("./handlers/jpg.js")).jpgHandler;
}

export async function loadBrowserImageRasterNormaliser() {
  return (await import("./normalisers/browser-image-raster.js"))
    .browserImageRasterNormaliser;
}
