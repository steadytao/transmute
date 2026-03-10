// Copyright (c) 2026 Tao
// SPDX-License-Identifier: MPL-2.0
/* APNG format handler. */

import { encodeApngCanvases } from "./apng-codec.js";
import { createMagickCodecHandler } from "./magick-codec.js";

export const apngHandler = createMagickCodecHandler({
  id: "apng",
  label: "APNG handler",
  formatId: "image/apng",
  readError: "The uploaded APNG could not be decoded",
  writeError: "Transmute failed to encode the APNG output",
  readMode: "sequence",
  sequenceWriteMode: "container",
  encodeCanvas: async (canvas, context = {}) =>
    encodeApngCanvases([canvas], context),
  encodeSequence: encodeApngCanvases,
});
