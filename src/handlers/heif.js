// Copyright (c) 2026 Tao
// SPDX-License-Identifier: MPL-2.0
/* HEIF format handler. */

import { createMagickCodecHandler } from "./magick-codec.js";
import { encodeHeifCanvas } from "../wasm/heif.js";

export const heifHandler = createMagickCodecHandler({
  id: "heif",
  label: "HEIF handler",
  formatId: "image/heif",
  readError: "The uploaded HEIF image could not be decoded",
  writeError: "Transmute failed to encode the HEIF output",
  encodeCanvas: encodeHeifCanvas,
});
