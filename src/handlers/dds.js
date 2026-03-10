// Copyright (c) 2026 Tao
// SPDX-License-Identifier: MPL-2.0
/* DDS format handler. */

import { createMagickImageHandler } from "./magick-image.js";

export const ddsHandler = createMagickImageHandler({
  id: "dds",
  label: "DDS handler",
  formatId: "image/vnd-ms.dds",
  readError: "The uploaded DDS image could not be decoded",
  writeError: "Transmute failed to encode the DDS output",
});
