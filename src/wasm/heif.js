// Copyright (c) 2026 Tao
// SPDX-License-Identifier: MPL-2.0
/* HEIC and HEIF WASM encoder helpers. */

import { createWasmBackedCanvasEncoder } from "./canvas-encoder.js";

async function loadHeifEncoderModule() {
  const module = await import("../../vendor/elheif/index.js");
  await module.ensureInitialized();
  return module;
}

function normaliseErrorMessage(value, fallback = "") {
  const message = String(value || fallback).trim();
  return message.endsWith(".") ? message.slice(0, -1) : message;
}

function encodeHeifImageData(module, imageData, errorMessage = "") {
  const encoded = module.jsEncodeImage(
    new Uint8Array(imageData.data),
    imageData.width,
    imageData.height,
  );

  if (encoded?.err || !encoded?.data?.length) {
    throw new Error(
      normaliseErrorMessage(
        encoded?.err,
        errorMessage || "Transmute failed to encode the HEIF output",
      ),
    );
  }

  return encoded.data;
}

const HEIF_ENCODER_ID = "transmute-heif-encoder";

export const encodeHeicCanvas = createWasmBackedCanvasEncoder({
  encoderId: HEIF_ENCODER_ID,
  mimeType: "image/heic",
  nativeFirst: false,
  loadModule: loadHeifEncoderModule,
  async encodeImageData({ imageData, module, context }) {
    return encodeHeifImageData(
      module,
      imageData,
      context.writeError,
    );
  },
});

export const encodeHeifCanvas = createWasmBackedCanvasEncoder({
  encoderId: HEIF_ENCODER_ID,
  mimeType: "image/heif",
  nativeFirst: false,
  loadModule: loadHeifEncoderModule,
  async encodeImageData({ imageData, module, context }) {
    return encodeHeifImageData(
      module,
      imageData,
      context.writeError,
    );
  },
});
