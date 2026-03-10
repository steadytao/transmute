// Copyright (c) 2026 Tao
// SPDX-License-Identifier: MPL-2.0
/* KTX2 format handler. */

import { createTextureContainerHandler } from "./texture-container.js";

export const ktx2Handler = createTextureContainerHandler({
  id: "ktx2",
  label: "KTX2 handler",
  formatId: "image/ktx2",
  variant: "ktx2",
  readError: "The uploaded KTX2 image could not be decoded",
  writeError: "Transmute failed to encode the KTX2 output",
});
