// Copyright (c) 2026 Tao
// SPDX-License-Identifier: MPL-2.0
/* PGM format handler. */

import { createMagickImageHandler } from "./magick-image.js";

export const pgmHandler = createMagickImageHandler({
  id: "pgm",
  label: "PGM handler",
  formatId: "image/x-portable-graymap",
  readError: "The uploaded PGM image could not be decoded",
  writeError: "Transmute failed to encode the PGM output",
});
