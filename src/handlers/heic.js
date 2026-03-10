// Copyright (c) 2026 Tao
// SPDX-License-Identifier: MPL-2.0
/* HEIC format handler. */

import { createMagickCodecHandler } from "./magick-codec.js";
import { encodeHeicCanvas } from "../wasm/heif.js";

export const heicHandler = createMagickCodecHandler({
  id: "heic",
  label: "HEIC handler",
  formatId: "image/heic",
  readError: "The uploaded HEIC image could not be decoded",
  writeError: "Transmute failed to encode the HEIC output",
  encodeCanvas: encodeHeicCanvas,
});
