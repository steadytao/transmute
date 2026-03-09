import { TRANSMUTE_FORMATS } from "./formats.js";
import { TRANSMUTE_KINDS } from "./kinds.js";
import { TransmuteRegistry } from "./registry.js";
import { jpgHandler } from "./handlers/jpg.js";
import { pngHandler } from "./handlers/png.js";

export const DEFAULT_TRANSMUTE_FORMATS = TRANSMUTE_FORMATS;
export const DEFAULT_TRANSMUTE_KINDS = TRANSMUTE_KINDS;
export const DEFAULT_TRANSMUTE_HANDLERS = Object.freeze([pngHandler, jpgHandler]);

export function createTransmuteRuntime({
  formats = DEFAULT_TRANSMUTE_FORMATS,
  kinds = DEFAULT_TRANSMUTE_KINDS,
  handlers = DEFAULT_TRANSMUTE_HANDLERS,
} = {}) {
  const registry = new TransmuteRegistry();
  formats.forEach((format) => {
    registry.registerFormat(format);
  });
  kinds.forEach((kind) => {
    registry.registerKind(kind);
  });
  handlers.forEach((handler) => {
    registry.registerHandler(handler);
  });
  return registry;
}

export function formatFileSize(bytes) {
  const value = Number(bytes) || 0;
  if (value < 1024) {
    return `${value} B`;
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }
  return `${(value / (1024 * 1024)).toFixed(2)} MB`;
}
