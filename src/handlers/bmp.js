// Copyright (c) 2026 Tao
// SPDX-License-Identifier: MPL-2.0
/* BMP format handler. */

import { createBrowserImageHandler } from "./browser-image.js";
import { encodeBmpCanvas } from "./encoders.js";

export const bmpHandler = createBrowserImageHandler({
  id: "bmp",
  label: "BMP handler",
  formatId: "image/bmp",
  readError: "The uploaded BMP could not be decoded",
  writeError: "Transmute failed to encode the BMP output",
  output: {
    alpha: true,
    quality: "lossless",
    encodeCanvas: encodeBmpCanvas,
  },
});
