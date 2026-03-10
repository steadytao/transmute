// Copyright (c) 2026 Tao
// SPDX-License-Identifier: MPL-2.0
/* Lazy WASM-backed module loader. */

const wasmModuleCache = new Map();

export function loadWasmModule(moduleId, loadModule) {
  if (!moduleId) {
    throw new Error("A WASM module id is required");
  }
  if (typeof loadModule !== "function") {
    throw new Error("A WASM module loader function is required");
  }

  if (!wasmModuleCache.has(moduleId)) {
    wasmModuleCache.set(
      moduleId,
      Promise.resolve()
        .then(loadModule)
        .catch((error) => {
          wasmModuleCache.delete(moduleId);
          throw error;
        }),
    );
  }

  return wasmModuleCache.get(moduleId);
}
