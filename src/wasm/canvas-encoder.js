// Copyright (c) 2026 Tao
// SPDX-License-Identifier: MPL-2.0
/* Shared WASM-backed canvas encoder helpers. */

import { canvasToBlob } from "../handlers/raster.js";
import { loadWasmModule } from "./loader.js";

function clampQuality(value, fallback = 0.92) {
  return Math.max(0, Math.min(1, Number(value) || fallback));
}

function getCanvasImageData(canvas) {
  const drawingContext = canvas.getContext("2d", {
    alpha: true,
    willReadFrequently: true,
  });
  if (!drawingContext) {
    throw new Error("Canvas 2D is unavailable in this browser");
  }

  return drawingContext.getImageData(0, 0, canvas.width, canvas.height);
}

export function createWasmBackedCanvasEncoder({
  encoderId,
  mimeType,
  defaultQuality = 0.92,
  nativeFirst = true,
  loadModule,
  encodeImageData,
}) {
  if (!encoderId) {
    throw new Error("A WASM encoder id is required");
  }
  if (!mimeType) {
    throw new Error("A target MIME type is required");
  }
  if (typeof loadModule !== "function") {
    throw new Error("A WASM encoder loader function is required");
  }
  if (typeof encodeImageData !== "function") {
    throw new Error("A WASM image-data encoder function is required");
  }

  return async function encodeCanvas(canvas, context = {}) {
    const quality = clampQuality(context.quality, defaultQuality);

    if (nativeFirst) {
      try {
        return await canvasToBlob(
          canvas,
          mimeType,
          quality,
          `__native_${mimeType.replace(/[^a-z0-9]+/gi, "_").toLowerCase()}_encoder_failed__`,
        );
      } catch {
        // Fall through to the WASM encoder.
      }
    }

    const encoderModule = await loadWasmModule(encoderId, loadModule);
    const imageData = getCanvasImageData(canvas);
    const encodedBuffer = await encodeImageData({
      canvas,
      context,
      imageData,
      module: encoderModule,
      quality,
    });

    return new Blob([encodedBuffer], { type: mimeType });
  };
}
