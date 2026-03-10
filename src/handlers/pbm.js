// Copyright (c) 2026 Tao
// SPDX-License-Identifier: MPL-2.0
/* PBM format handler. */

import { createMagickImageHandler } from "./magick-image.js";

export const pbmHandler = createMagickImageHandler({
  id: "pbm",
  label: "PBM handler",
  formatId: "image/x-portable-bitmap",
  readError: "The uploaded PBM image could not be decoded",
  writeError: "Transmute failed to encode the PBM output",
});
