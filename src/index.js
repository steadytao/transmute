export {
  createTransmuteRuntime,
  formatFileSize,
  DEFAULT_TRANSMUTE_FORMATS,
  DEFAULT_TRANSMUTE_KINDS,
  DEFAULT_TRANSMUTE_HANDLERS,
} from "./runtime.js";

export { TransmuteRegistry } from "./registry.js";

export { PNG_FORMAT, JPG_FORMAT, TRANSMUTE_FORMATS } from "./formats.js";
export { RASTER_IMAGE_KIND, TRANSMUTE_KINDS } from "./kinds.js";

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
