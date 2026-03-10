// Copyright (c) 2026 Tao
// SPDX-License-Identifier: MPL-2.0
/* QOI format handler. */

import { createMagickImageHandler } from "./magick-image.js";

export const qoiHandler = createMagickImageHandler({
  id: "qoi",
  label: "QOI handler",
  formatId: "image/qoi",
  readError: "The uploaded QOI image could not be decoded",
  writeError: "Transmute failed to encode the QOI output",
});
