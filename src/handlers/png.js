// Copyright (c) 2026 Tao
// SPDX-License-Identifier: MPL-2.0
/* PNG format handler. */

import { createBrowserImageHandler } from "./browser-image.js";

export const pngHandler = createBrowserImageHandler({
  id: "png",
  label: "PNG handler",
  formatId: "image/png",
  readError: "The uploaded PNG could not be decoded",
  writeError: "The browser failed to encode the PNG output",
  output: {
    alpha: true,
    quality: "lossless",
  },
});
