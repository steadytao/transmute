// Copyright (c) 2026 Tao
// SPDX-License-Identifier: MPL-2.0
/* JPG format handler. */

import { createBrowserImageHandler } from "./browser-image.js";

export const jpgHandler = createBrowserImageHandler({
  id: "jpg",
  label: "JPG handler",
  formatId: "image/jpeg",
  readError: "The uploaded JPG could not be decoded",
  writeError: "The browser failed to encode the JPG output",
  output: {
    alpha: false,
    flattenAlpha: true,
    quality: "lossy",
    defaultQuality: 0.92,
  },
});
