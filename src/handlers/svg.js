// Copyright (c) 2026 Tao
// SPDX-License-Identifier: MPL-2.0
/* SVG format handler. */

import { createBrowserImageHandler } from "./browser-image.js";
import { encodeSvgCanvas } from "./encoders.js";

export const svgHandler = createBrowserImageHandler({
  id: "svg",
  label: "SVG handler",
  formatId: "image/svg+xml",
  readError: "The uploaded SVG could not be decoded",
  writeError: "Transmute failed to encode the SVG output",
  output: {
    alpha: true,
    quality: "lossless",
    encodeCanvas: encodeSvgCanvas,
  },
});
