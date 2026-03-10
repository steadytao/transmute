// Copyright (c) 2026 Tao
// SPDX-License-Identifier: MPL-2.0
/* KTX format handler. */

import { createTextureContainerHandler } from "./texture-container.js";

export const ktxHandler = createTextureContainerHandler({
  id: "ktx",
  label: "KTX handler",
  formatId: "image/ktx",
  variant: "ktx",
  readError: "The uploaded KTX image could not be decoded",
  writeError: "Transmute failed to encode the KTX output",
});
