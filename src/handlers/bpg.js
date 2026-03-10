// Copyright (c) 2026 Tao
// SPDX-License-Identifier: MPL-2.0
/* BPG format handler. */

import { createMagickImageHandler } from "./magick-image.js";

export const bpgHandler = createMagickImageHandler({
  id: "bpg",
  label: "BPG handler",
  formatId: "image/bpg",
  readError: "The uploaded BPG image could not be decoded",
  canWrite: false,
});
