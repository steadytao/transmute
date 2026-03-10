// Copyright (c) 2026 Tao
// SPDX-License-Identifier: MPL-2.0
/* Radiance HDR format handler. */

import { createMagickImageHandler } from "./magick-image.js";

export const hdrHandler = createMagickImageHandler({
  id: "hdr",
  label: "Radiance HDR handler",
  formatId: "image/vnd.radiance",
  readError: "The uploaded Radiance HDR image could not be decoded",
  writeError: "Transmute failed to encode the Radiance HDR output",
});
