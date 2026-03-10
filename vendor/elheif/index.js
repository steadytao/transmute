// Copyright (c) 2026 Tao
// SPDX-License-Identifier: MPL-2.0
/* ELHEIF vendor wrapper. */

import "./elheif-wasm.js";

const initElheif = globalThis.__init__ELHEIF_MODULE;
const elheif = {};

let readyPromise = null;
let ready = false;

export async function ensureInitialized() {
  if (ready) {
    return;
  }

  if (!readyPromise) {
    if (typeof initElheif !== "function") {
      throw new Error("ELHEIF failed to load");
    }

    readyPromise = new Promise((resolve) => {
      elheif.onRuntimeInitialized = () => {
        ready = true;
        resolve();
      };
      initElheif(elheif);
    });
  }

  await readyPromise;
}

function ensureReady() {
  if (!ready) {
    throw new Error("ELHEIF is not initialised");
  }
}

export function jsDecodeImage(buffer) {
  ensureReady();
  return elheif.jsDecodeImage(buffer);
}

export function jsEncodeImage(buffer, width, height) {
  ensureReady();
  return elheif.jsEncodeImage(buffer, width, height);
}
