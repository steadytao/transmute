// Copyright (c) 2026 Tao
// SPDX-License-Identifier: MPL-2.0
/* TGA format handler. */

import { createMagickImageHandler } from "./magick-image.js";

export const tgaHandler = createMagickImageHandler({
  id: "tga",
  label: "TGA handler",
  formatId: "image/x-tga",
  readError: "The uploaded TGA image could not be decoded",
  writeError: "Transmute failed to encode the TGA output",
});
