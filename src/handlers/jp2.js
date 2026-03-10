// Copyright (c) 2026 Tao
// SPDX-License-Identifier: MPL-2.0
/* JPEG 2000 format handler. */

import { createMagickImageHandler } from "./magick-image.js";

export const jp2Handler = createMagickImageHandler({
  id: "jp2",
  label: "JPEG 2000 handler",
  formatId: "image/jp2",
  readError: "The uploaded JPEG 2000 image could not be decoded",
  writeError: "Transmute failed to encode the JPEG 2000 output",
});
