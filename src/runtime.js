// Copyright (c) 2026 Tao
// SPDX-License-Identifier: MPL-2.0
/* Transmute runtime bootstrap. */

import { TRANSMUTE_FORMATS } from "./formats.js";
import { TRANSMUTE_KINDS } from "./kinds.js";
import { TRANSMUTE_NORMALISERS } from "./normalisers.js";
import { TransmuteRegistry } from "./registry.js";

const WRITABLE_IMAGE_MIME_TYPES = Object.freeze(["image/webp", "image/avif"]);
const encoderSupportCache = new Map();

function createLazyHandlerManifest({
  id,
  label,
  formatId,
  produces,
  consumes,
  sequenceWriteMode = "",
  load,
}) {
  return Object.freeze({
    id,
    label,
    formatId,
    produces: Object.freeze([...(produces || [])]),
    consumes: Object.freeze([...(consumes || [])]),
    sequenceWriteMode,
    load,
  });
}

function canEncodeImageMimeType(mimeType) {
  if (typeof document === "undefined") {
    return mimeType === "image/png" || mimeType === "image/jpeg";
  }

  if (mimeType === "image/png" || mimeType === "image/jpeg") {
    return true;
  }

  const hasOffscreenEncoder =
    typeof OffscreenCanvas === "function" &&
    typeof OffscreenCanvas.prototype.convertToBlob === "function";
  const hasImageEncoder = typeof ImageEncoder === "function";
  const hasCanvasToBlob =
    typeof HTMLCanvasElement === "function" &&
    typeof HTMLCanvasElement.prototype.toBlob === "function";
  if (
    (mimeType === "image/webp" || mimeType === "image/avif") &&
    (hasOffscreenEncoder || hasImageEncoder || hasCanvasToBlob)
  ) {
    return true;
  }

  const canvas = document.createElement("canvas");
  if (typeof canvas.toDataURL !== "function") {
    return false;
  }

  try {
    return canvas.toDataURL(mimeType).startsWith(`data:${mimeType}`);
  } catch {
    return false;
  }
}

async function probeImageEncoder(mimeType) {
  if (typeof ImageEncoder !== "function") {
    return false;
  }

  if (typeof ImageEncoder.isConfigSupported === "function") {
    try {
      const result = await ImageEncoder.isConfigSupported({
        type: mimeType,
        width: 1,
        height: 1,
      });
      if (result?.supported) {
        return true;
      }
    } catch {
      // Fall through to other probes.
    }
  }

  try {
    const encoder = new ImageEncoder({
      type: mimeType,
      width: 1,
      height: 1,
    });
    encoder.close?.();
    return true;
  } catch {
    return false;
  }
}

async function probeOffscreenCanvasEncoding(mimeType) {
  if (
    typeof OffscreenCanvas !== "function" ||
    typeof OffscreenCanvas.prototype.convertToBlob !== "function"
  ) {
    return false;
  }

  try {
    const canvas = new OffscreenCanvas(1, 1);
    const context = canvas.getContext("2d", { alpha: true });
    context?.clearRect(0, 0, 1, 1);
    context?.fillRect(0, 0, 1, 1);
    const blob = await canvas.convertToBlob({
      type: mimeType,
      quality: 0.92,
    });
    return blob?.type === mimeType;
  } catch {
    return false;
  }
}

function probeHtmlCanvasEncoding(mimeType) {
  if (
    typeof document === "undefined" ||
    typeof HTMLCanvasElement !== "function" ||
    typeof HTMLCanvasElement.prototype.toBlob !== "function"
  ) {
    return Promise.resolve(false);
  }

  return new Promise((resolve) => {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      const context = canvas.getContext("2d", { alpha: true });
      context?.clearRect(0, 0, 1, 1);
      context?.fillRect(0, 0, 1, 1);
      canvas.toBlob(
        (blob) => {
          resolve(blob?.type === mimeType);
        },
        mimeType,
        0.92,
      );
    } catch {
      resolve(false);
    }
  });
}

async function probeImageEncodingSupport(mimeType) {
  if (encoderSupportCache.has(mimeType)) {
    return encoderSupportCache.get(mimeType);
  }

  const probePromise = (async () => {
    if (mimeType === "image/png" || mimeType === "image/jpeg") {
      return true;
    }

    if (typeof document === "undefined") {
      return false;
    }

    if (await probeImageEncoder(mimeType)) {
      return true;
    }
    if (await probeOffscreenCanvasEncoding(mimeType)) {
      return true;
    }
    if (await probeHtmlCanvasEncoding(mimeType)) {
      return true;
    }

    const canvas = document.createElement("canvas");
    if (typeof canvas.toDataURL !== "function") {
      return false;
    }

    try {
      return canvas.toDataURL(mimeType).startsWith(`data:${mimeType}`);
    } catch {
      return false;
    }
  })();

  encoderSupportCache.set(mimeType, probePromise);
  return probePromise;
}

function createImageHandlerManifest({
  id,
  label,
  formatId,
  modulePath,
  exportName,
  outputMimeType = "",
  canWriteOverride,
  produces = ["raster-image"],
  consumes = [],
  sequenceWriteMode = "",
}) {
  const canWrite = typeof canWriteOverride === "boolean"
    ? canWriteOverride
    : outputMimeType
      ? canEncodeImageMimeType(outputMimeType)
      : false;
  const writeConsumes = canWrite
    ? [...new Set([...(consumes || []), "raster-image", "raster-frame-sequence"])]
    : [];

  return createLazyHandlerManifest({
    id,
    label,
    formatId,
    produces,
    consumes: writeConsumes,
    sequenceWriteMode,
    load: async () => (await import(modulePath))[exportName],
  });
}

function buildDefaultTransmuteHandlers({
  webpWritable = true,
  avifWritable = true,
} = {}) {
  return Object.freeze([
    createLazyHandlerManifest({
      id: "apng",
      label: "APNG handler",
      formatId: "image/apng",
      produces: ["raster-frame-sequence"],
      consumes: ["raster-image", "raster-frame-sequence"],
      sequenceWriteMode: "container",
      load: async () => (await import("./handlers/apng.js")).apngHandler,
    }),
    createLazyHandlerManifest({
      id: "png",
      label: "PNG handler",
      formatId: "image/png",
      produces: ["raster-image"],
      consumes: ["raster-image", "raster-frame-sequence"],
      load: async () => (await import("./handlers/png.js")).pngHandler,
    }),
    createLazyHandlerManifest({
      id: "jpg",
      label: "JPG handler",
      formatId: "image/jpeg",
      produces: ["raster-image"],
      consumes: ["raster-image", "raster-frame-sequence"],
      load: async () => (await import("./handlers/jpg.js")).jpgHandler,
    }),
    createImageHandlerManifest({
      id: "webp",
      label: "WEBP handler",
      formatId: "image/webp",
      modulePath: "./handlers/webp.js",
      exportName: "webpHandler",
      outputMimeType: "image/webp",
      canWriteOverride: webpWritable,
    }),
    createImageHandlerManifest({
      id: "avif",
      label: "AVIF handler",
      formatId: "image/avif",
      modulePath: "./handlers/avif.js",
      exportName: "avifHandler",
      outputMimeType: "image/avif",
      canWriteOverride: avifWritable,
    }),
    createImageHandlerManifest({
      id: "tiff",
      label: "TIFF handler",
      formatId: "image/tiff",
      modulePath: "./handlers/tiff.js",
      exportName: "tiffHandler",
      canWriteOverride: true,
    }),
    createImageHandlerManifest({
      id: "tga",
      label: "TGA handler",
      formatId: "image/x-tga",
      modulePath: "./handlers/tga.js",
      exportName: "tgaHandler",
      canWriteOverride: true,
    }),
    createImageHandlerManifest({
      id: "heic",
      label: "HEIC handler",
      formatId: "image/heic",
      modulePath: "./handlers/heic.js",
      exportName: "heicHandler",
      canWriteOverride: true,
    }),
    createImageHandlerManifest({
      id: "heif",
      label: "HEIF handler",
      formatId: "image/heif",
      modulePath: "./handlers/heif.js",
      exportName: "heifHandler",
      canWriteOverride: true,
    }),
    createImageHandlerManifest({
      id: "jxl",
      label: "JPEG XL handler",
      formatId: "image/jxl",
      modulePath: "./handlers/jxl.js",
      exportName: "jxlHandler",
      canWriteOverride: true,
    }),
    createImageHandlerManifest({
      id: "jp2",
      label: "JPEG 2000 handler",
      formatId: "image/jp2",
      modulePath: "./handlers/jp2.js",
      exportName: "jp2Handler",
      canWriteOverride: true,
    }),
    createImageHandlerManifest({
      id: "jxr",
      label: "JPEG XR handler",
      formatId: "image/jxr",
      modulePath: "./handlers/jxr.js",
      exportName: "jxrHandler",
      canWriteOverride: false,
    }),
    createImageHandlerManifest({
      id: "svg",
      label: "SVG handler",
      formatId: "image/svg+xml",
      modulePath: "./handlers/svg.js",
      exportName: "svgHandler",
      canWriteOverride: true,
    }),
    createImageHandlerManifest({
      id: "gif",
      label: "GIF handler",
      formatId: "image/gif",
      modulePath: "./handlers/gif.js",
      exportName: "gifHandler",
      canWriteOverride: true,
      produces: ["raster-frame-sequence"],
      consumes: ["raster-image", "raster-frame-sequence"],
    }),
    createImageHandlerManifest({
      id: "bmp",
      label: "BMP handler",
      formatId: "image/bmp",
      modulePath: "./handlers/bmp.js",
      exportName: "bmpHandler",
      canWriteOverride: true,
    }),
    createImageHandlerManifest({
      id: "ico",
      label: "ICO handler",
      formatId: "image/x-icon",
      modulePath: "./handlers/ico.js",
      exportName: "icoHandler",
      canWriteOverride: true,
    }),
    createImageHandlerManifest({
      id: "icns",
      label: "ICNS handler",
      formatId: "image/icns",
      modulePath: "./handlers/icns.js",
      exportName: "icnsHandler",
      canWriteOverride: true,
    }),
    createImageHandlerManifest({
      id: "cur",
      label: "CUR handler",
      formatId: "image/x-win-bitmap-cursor",
      modulePath: "./handlers/cur.js",
      exportName: "curHandler",
      canWriteOverride: true,
    }),
    createImageHandlerManifest({
      id: "bpg",
      label: "BPG handler",
      formatId: "image/bpg",
      modulePath: "./handlers/bpg.js",
      exportName: "bpgHandler",
      canWriteOverride: false,
    }),
    createImageHandlerManifest({
      id: "qoi",
      label: "QOI handler",
      formatId: "image/qoi",
      modulePath: "./handlers/qoi.js",
      exportName: "qoiHandler",
      canWriteOverride: true,
    }),
    createImageHandlerManifest({
      id: "dds",
      label: "DDS handler",
      formatId: "image/vnd-ms.dds",
      modulePath: "./handlers/dds.js",
      exportName: "ddsHandler",
      canWriteOverride: true,
    }),
    createImageHandlerManifest({
      id: "exr",
      label: "OpenEXR handler",
      formatId: "image/x-exr",
      modulePath: "./handlers/exr.js",
      exportName: "exrHandler",
      canWriteOverride: true,
    }),
    createImageHandlerManifest({
      id: "hdr",
      label: "Radiance HDR handler",
      formatId: "image/vnd.radiance",
      modulePath: "./handlers/hdr.js",
      exportName: "hdrHandler",
      canWriteOverride: true,
    }),
    createImageHandlerManifest({
      id: "psd",
      label: "PSD handler",
      formatId: "image/vnd.adobe.photoshop",
      modulePath: "./handlers/psd.js",
      exportName: "psdHandler",
      canWriteOverride: true,
    }),
    createImageHandlerManifest({
      id: "ktx",
      label: "KTX handler",
      formatId: "image/ktx",
      modulePath: "./handlers/ktx.js",
      exportName: "ktxHandler",
      canWriteOverride: true,
    }),
    createImageHandlerManifest({
      id: "ktx2",
      label: "KTX2 handler",
      formatId: "image/ktx2",
      modulePath: "./handlers/ktx2.js",
      exportName: "ktx2Handler",
      canWriteOverride: true,
    }),
    createImageHandlerManifest({
      id: "pbm",
      label: "PBM handler",
      formatId: "image/x-portable-bitmap",
      modulePath: "./handlers/pbm.js",
      exportName: "pbmHandler",
      canWriteOverride: true,
    }),
    createImageHandlerManifest({
      id: "pgm",
      label: "PGM handler",
      formatId: "image/x-portable-graymap",
      modulePath: "./handlers/pgm.js",
      exportName: "pgmHandler",
      canWriteOverride: true,
    }),
    createImageHandlerManifest({
      id: "ppm",
      label: "PPM handler",
      formatId: "image/x-portable-pixmap",
      modulePath: "./handlers/ppm.js",
      exportName: "ppmHandler",
      canWriteOverride: true,
    }),
    createImageHandlerManifest({
      id: "pam",
      label: "PAM handler",
      formatId: "image/x-portable-arbitrarymap",
      modulePath: "./handlers/pam.js",
      exportName: "pamHandler",
      canWriteOverride: true,
    }),
    createImageHandlerManifest({
      id: "mng",
      label: "MNG handler",
      formatId: "image/x-mng",
      modulePath: "./handlers/mng.js",
      exportName: "mngHandler",
      produces: ["raster-frame-sequence"],
      consumes: ["raster-image", "raster-frame-sequence"],
      canWriteOverride: true,
      sequenceWriteMode: "container",
    }),
  ]);
}

export const DEFAULT_TRANSMUTE_FORMATS = TRANSMUTE_FORMATS;
export const DEFAULT_TRANSMUTE_KINDS = TRANSMUTE_KINDS;
export const DEFAULT_TRANSMUTE_HANDLERS = buildDefaultTransmuteHandlers();
export const DEFAULT_TRANSMUTE_NORMALISERS = TRANSMUTE_NORMALISERS;

export function createTransmuteRuntime({
  formats = DEFAULT_TRANSMUTE_FORMATS,
  kinds = DEFAULT_TRANSMUTE_KINDS,
  handlers = DEFAULT_TRANSMUTE_HANDLERS,
  normalisers = DEFAULT_TRANSMUTE_NORMALISERS,
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
  normalisers.forEach((normaliser) => {
    registry.registerNormaliser(normaliser);
  });
  return registry;
}

export async function createPreparedTransmuteRuntime() {
  await Promise.allSettled(
    WRITABLE_IMAGE_MIME_TYPES.map((mimeType) =>
      probeImageEncodingSupport(mimeType),
    ),
  );

  return createTransmuteRuntime();
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
