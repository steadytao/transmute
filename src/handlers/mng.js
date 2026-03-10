// Copyright (c) 2026 Tao
// SPDX-License-Identifier: MPL-2.0
/* MNG format handler. */

import { createMagickImageHandler } from "./magick-image.js";

export const mngHandler = createMagickImageHandler({
  id: "mng",
  label: "MNG handler",
  formatId: "image/x-mng",
  readError: "The uploaded MNG image could not be decoded",
  writeError: "Transmute failed to encode the MNG output",
  readMode: "sequence",
  sequenceWriteMode: "container",
});
