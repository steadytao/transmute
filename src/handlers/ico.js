// Copyright (c) 2026 Tao
// SPDX-License-Identifier: MPL-2.0
/* ICO format handler. */

import { createBrowserImageHandler } from "./browser-image.js";
import { encodeIcoCanvas } from "./encoders.js";

export const icoHandler = createBrowserImageHandler({
  id: "ico",
  label: "ICO handler",
  formatId: "image/x-icon",
  readError: "The uploaded ICO image could not be decoded",
  writeError: "Transmute failed to encode the ICO output",
  output: {
    alpha: true,
    quality: "lossless",
    encodeCanvas: encodeIcoCanvas,
  },
});
