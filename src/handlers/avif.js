// Copyright (c) 2026 Tao
// SPDX-License-Identifier: MPL-2.0
/* AVIF format handler. */

import { createBrowserImageHandler } from "./browser-image.js";
import { encodeAvifCanvas } from "../wasm/avif.js";

export const avifHandler = createBrowserImageHandler({
  id: "avif",
  label: "AVIF handler",
  formatId: "image/avif",
  readError: "The uploaded AVIF image could not be decoded",
  writeError: "Transmute failed to encode the AVIF output",
  output: {
    alpha: true,
    quality: "lossy",
    defaultQuality: 0.9,
    encodeCanvas: encodeAvifCanvas,
  },
});
