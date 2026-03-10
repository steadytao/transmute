// Copyright (c) 2026 Tao
// SPDX-License-Identifier: MPL-2.0
/* TIFF format handler. */

import { createMagickImageHandler } from "./magick-image.js";

export const tiffHandler = createMagickImageHandler({
  id: "tiff",
  label: "TIFF handler",
  formatId: "image/tiff",
  readError: "The uploaded TIFF could not be decoded",
  writeError: "Transmute failed to encode the TIFF output",
  sequenceWriteMode: "container",
});
