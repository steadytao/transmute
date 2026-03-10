// Copyright (c) 2026 Tao
// SPDX-License-Identifier: MPL-2.0
/* PSD format handler. */

import { createMagickImageHandler } from "./magick-image.js";

export const psdHandler = createMagickImageHandler({
  id: "psd",
  label: "PSD handler",
  formatId: "image/vnd.adobe.photoshop",
  readError: "The uploaded PSD image could not be decoded",
  writeError: "Transmute failed to encode the PSD output",
});
