// Copyright (c) 2026 Tao
// SPDX-License-Identifier: MPL-2.0
/* JPEG XR format handler. */

import { createMagickImageHandler } from "./magick-image.js";

export const jxrHandler = createMagickImageHandler({
  id: "jxr",
  label: "JPEG XR handler",
  formatId: "image/jxr",
  readError: "The uploaded JPEG XR image could not be decoded",
  canWrite: false,
});
