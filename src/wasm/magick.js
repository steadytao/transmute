// Copyright (c) 2026 Tao
// SPDX-License-Identifier: MPL-2.0
/* ImageMagick WASM helpers for broad image read/write support. */

import { loadWasmModule } from "./loader.js";

const MAGICK_FORMAT_KEYS = Object.freeze({
  "image/apng": "APng",
  "image/png": "Png",
  "image/jpeg": "Jpeg",
  "image/webp": "WebP",
  "image/svg+xml": "Svg",
  "image/gif": "Gif",
  "image/bmp": "Bmp",
  "image/tiff": "Tiff",
  "image/x-tga": "Tga",
  "image/x-icon": "Ico",
  "image/avif": "Avif",
  "image/heic": "Heic",
  "image/heif": "Heif",
  "image/jxl": "Jxl",
  "image/jp2": "Jp2",
  "image/x-win-bitmap-cursor": "Cur",
  "image/qoi": "Qoi",
  "image/vnd-ms.dds": "Dds",
  "image/x-exr": "Exr",
  "image/vnd.radiance": "Hdr",
  "image/vnd.adobe.photoshop": "Psd",
  "image/x-portable-bitmap": "Pbm",
  "image/x-portable-graymap": "Pgm",
  "image/x-portable-pixmap": "Ppm",
  "image/x-portable-arbitrarymap": "Pam",
  "image/x-mng": "Mng",
});

function buildCanvasFrame(width, height, draw) {
  return {
    kind: "raster-frame",
    width,
    height,
    drawToContext(drawingContext) {
      draw(drawingContext);
    },
    release() {},
  };
}

function buildCanvasRasterAsset(canvas) {
  return {
    kind: "raster-image",
    width: canvas.width,
    height: canvas.height,
    drawToContext(drawingContext) {
      drawingContext.drawImage(canvas, 0, 0);
    },
    release() {},
  };
}

function buildCanvasSequence(frames) {
  const firstFrame = frames[0];
  return {
    kind: "raster-frame-sequence",
    width: firstFrame.width,
    height: firstFrame.height,
    frameCount: frames.length,
    frames: Object.freeze(frames),
    release() {},
    drawFrameToContext(frameIndex, drawingContext) {
      const frame = frames[frameIndex];
      if (!frame) {
        throw new Error("Frame index is out of range");
      }
      frame.drawToContext(drawingContext);
    },
  };
}

function getMagickFormat(module, formatId) {
  const key = MAGICK_FORMAT_KEYS[formatId];
  const format = key ? module.MagickFormat?.[key] : null;
  if (!format) {
    throw new Error(`No ImageMagick format mapping is registered for ${formatId}`);
  }
  return format;
}

async function loadMagickModule() {
  return loadWasmModule("transmute-imagemagick", async () => {
    const module = await import("../../vendor/magick/index.js");
    const wasmUrl = new URL(
      "../../vendor/magick/magick.wasm",
      import.meta.url,
    );
    const wasmBytes = new Uint8Array(
      await (await fetch(wasmUrl)).arrayBuffer(),
    );
    await module.initializeImageMagick(wasmBytes);
    return module;
  });
}

async function blobToBytes(blob) {
  return new Uint8Array(await blob.arrayBuffer());
}

function imageToCanvas(image) {
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  image.writeToCanvas(canvas, { alpha: true });
  return canvas;
}

function setMagickQuality(image, quality) {
  if (!Number.isFinite(quality)) {
    return;
  }
  image.quality = Math.max(1, Math.min(100, Math.round(quality * 100)));
}

export async function readMagickBlob(blob, { readMode = "raster", errorMessage = "" } = {}) {
  const module = await loadMagickModule();
  const bytes = await blobToBytes(blob);

  try {
    const collection = module.MagickImageCollection.create(bytes);
    if (!collection.length) {
      throw new Error(errorMessage);
    }

    if (readMode === "sequence" && collection.length > 1) {
      collection.coalesce?.();
      const frames = collection.map((image) => {
        const canvas = imageToCanvas(image);
        return buildCanvasFrame(canvas.width, canvas.height, (drawingContext) => {
          drawingContext.drawImage(canvas, 0, 0);
        });
      });
      collection.dispose?.();
      return buildCanvasSequence(frames);
    }

    const image = collection[0];
    const canvas = imageToCanvas(image);
    collection.dispose?.();
    return buildCanvasRasterAsset(canvas);
  } catch {
    throw new Error(errorMessage);
  }
}

export async function writeMagickCanvas(canvas, {
  formatId,
  mimeType,
  quality,
  errorMessage = "",
} = {}) {
  const module = await loadMagickModule();
  const image = module.MagickImage.create();

  try {
    image.readFromCanvas(canvas, { alpha: true });
    setMagickQuality(image, quality);
    const magickFormat = getMagickFormat(module, formatId);
    let resultBytes = null;
    image.write(magickFormat, (data) => {
      resultBytes = new Uint8Array(data);
    });
    if (!resultBytes?.length) {
      throw new Error(errorMessage);
    }
    return new Blob([resultBytes], { type: mimeType || "" });
  } catch {
    throw new Error(errorMessage);
  } finally {
    image.dispose?.();
  }
}

export async function writeMagickSequence(canvases, {
  formatId,
  mimeType,
  quality,
  errorMessage = "",
} = {}) {
  const module = await loadMagickModule();
  const collection = module.MagickImageCollection.create();
  const createdImages = [];

  try {
    canvases.forEach((canvas) => {
      const image = module.MagickImage.create();
      image.readFromCanvas(canvas, { alpha: true });
      setMagickQuality(image, quality);
      createdImages.push(image);
      collection.push(image);
    });

    const magickFormat = getMagickFormat(module, formatId);
    let resultBytes = null;
    collection.write(magickFormat, (data) => {
      resultBytes = new Uint8Array(data);
    });
    if (!resultBytes?.length) {
      throw new Error(errorMessage);
    }
    return new Blob([resultBytes], { type: mimeType || "" });
  } catch {
    throw new Error(errorMessage);
  } finally {
    collection.dispose?.();
    createdImages.forEach((image) => image.dispose?.());
  }
}
