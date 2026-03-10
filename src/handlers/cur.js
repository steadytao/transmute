// Copyright (c) 2026 Tao
// SPDX-License-Identifier: MPL-2.0
/* CUR format handler. */

import { createMagickCodecHandler } from "./magick-codec.js";
import { encodeCurCanvas } from "./encoders.js";

export const curHandler = createMagickCodecHandler({
  id: "cur",
  label: "CUR handler",
  formatId: "image/x-win-bitmap-cursor",
  readError: "The uploaded CUR image could not be decoded",
  writeError: "Transmute failed to encode the CUR output",
  encodeCanvas: encodeCurCanvas,
});
