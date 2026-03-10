// Copyright (c) 2026 Tao
// SPDX-License-Identifier: MPL-2.0
/* PAM format handler. */

import { createMagickImageHandler } from "./magick-image.js";

export const pamHandler = createMagickImageHandler({
  id: "pam",
  label: "PAM handler",
  formatId: "image/x-portable-arbitrarymap",
  readError: "The uploaded PAM image could not be decoded",
  writeError: "Transmute failed to encode the PAM output",
});
