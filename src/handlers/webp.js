// Copyright (c) 2026 Tao
// SPDX-License-Identifier: MPL-2.0
/* WEBP format handler. */

import { createBrowserImageHandler } from "./browser-image.js";

export const webpHandler = createBrowserImageHandler({
  id: "webp",
  label: "WEBP handler",
  formatId: "image/webp",
  readError: "The uploaded WEBP could not be decoded",
  writeError: "The browser failed to encode the WEBP output",
  output: {
    alpha: true,
    quality: "lossy",
    defaultQuality: 0.92,
  },
});
