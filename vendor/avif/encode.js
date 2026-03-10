/**
 * Adapted for local Transmute runtime use from @jsquash/avif.
 * Original upstream: https://github.com/jamsinclair/jSquash
 * License: Apache-2.0
 */

import { defaultOptions } from "./meta.js";
import { initEmscriptenModule } from "./utils.js";

let emscriptenModule;

export async function init(moduleOptions) {
  if (emscriptenModule) {
    return emscriptenModule;
  }

  const avifEncoder = await import("./codec/enc/avif_enc.js");
  emscriptenModule = initEmscriptenModule(
    avifEncoder.default,
    undefined,
    moduleOptions,
  );
  return emscriptenModule;
}

export default async function encode(data, options = {}) {
  const module = await init();
  const resolvedOptions = { ...defaultOptions, ...options };

  if (
    resolvedOptions.bitDepth !== 8 &&
    resolvedOptions.bitDepth !== 10 &&
    resolvedOptions.bitDepth !== 12
  ) {
    throw new Error("Invalid bit depth. Supported values are 8, 10, or 12");
  }

  if (!(data.data instanceof Uint16Array) && resolvedOptions.bitDepth !== 8) {
    throw new Error(
      "Invalid image data for bit depth. Use Uint16Array for bit depths greater than 8",
    );
  }

  if (resolvedOptions.lossless) {
    resolvedOptions.quality = 100;
    resolvedOptions.qualityAlpha = -1;
    resolvedOptions.subsample = 3;
  }

  const output = module.encode(
    new Uint8Array(data.data.buffer),
    data.width,
    data.height,
    resolvedOptions,
  );

  if (!output) {
    throw new Error("Encoding error");
  }

  return output.buffer;
}
