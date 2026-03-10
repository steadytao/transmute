// Copyright (c) 2026 Tao
// SPDX-License-Identifier: MPL-2.0
/* JPEG XL format handler. */

import { createMagickImageHandler } from "./magick-image.js";

export const jxlHandler = createMagickImageHandler({
  id: "jxl",
  label: "JPEG XL handler",
  formatId: "image/jxl",
  readError: "The uploaded JPEG XL image could not be decoded",
  writeError: "Transmute failed to encode the JPEG XL output",
});
