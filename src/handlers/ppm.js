// Copyright (c) 2026 Tao
// SPDX-License-Identifier: MPL-2.0
/* PPM format handler. */

import { createMagickImageHandler } from "./magick-image.js";

export const ppmHandler = createMagickImageHandler({
  id: "ppm",
  label: "PPM handler",
  formatId: "image/x-portable-pixmap",
  readError: "The uploaded PPM image could not be decoded",
  writeError: "Transmute failed to encode the PPM output",
});
