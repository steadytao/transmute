// Copyright (c) 2026 Tao
// SPDX-License-Identifier: MPL-2.0
/* UPNG vendor wrapper. */

import "./pako.js";
import "./UPNG.js";

const { UPNG } = globalThis;

if (!UPNG) {
  throw new Error("UPNG failed to initialise");
}

export { UPNG };
export default UPNG;
