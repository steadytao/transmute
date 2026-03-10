// Copyright (c) 2026 Tao
// SPDX-License-Identifier: MPL-2.0
/* GIF format handler. */

import { createBrowserImageHandler } from "./browser-image.js";
import { encodeGifCanvas } from "./encoders.js";

export const gifHandler = createBrowserImageHandler({
  id: "gif",
  label: "GIF handler",
  formatId: "image/gif",
  readError: "The uploaded GIF could not be decoded",
  writeError: "Transmute failed to encode the GIF output",
  readMode: "sequence",
  output: {
    alpha: false,
    flattenAlpha: true,
    quality: "indexed",
    encodeCanvas: encodeGifCanvas,
  },
});
