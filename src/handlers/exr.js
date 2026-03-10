// Copyright (c) 2026 Tao
// SPDX-License-Identifier: MPL-2.0
/* OpenEXR format handler. */

import { createMagickImageHandler } from "./magick-image.js";

export const exrHandler = createMagickImageHandler({
  id: "exr",
  label: "OpenEXR handler",
  formatId: "image/x-exr",
  readError: "The uploaded OpenEXR image could not be decoded",
  writeError: "Transmute failed to encode the OpenEXR output",
});
