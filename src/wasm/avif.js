// Copyright (c) 2026 Tao
// SPDX-License-Identifier: MPL-2.0
/* AVIF WASM encoder fallback. */

import { createWasmBackedCanvasEncoder } from "./canvas-encoder.js";

async function loadAvifEncoderModule() {
  const module = await import("../../vendor/avif/encode.js");
  if (typeof module.init === "function") {
    await module.init();
  }
  return module;
}

export const encodeAvifCanvas = createWasmBackedCanvasEncoder({
  encoderId: "transmute-avif-encoder",
  mimeType: "image/avif",
  defaultQuality: 0.9,
  loadModule: loadAvifEncoderModule,
  async encodeImageData({ imageData, module, quality }) {
    return module.default(imageData, {
      quality: Math.round(quality * 100),
      qualityAlpha: -1,
      bitDepth: 8,
      lossless: quality >= 0.999,
    });
  },
});
