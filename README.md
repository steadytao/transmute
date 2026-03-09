# Transmute

Transmute is a browser-side local file conversion runtime. It detects supported files from magic bytes, MIME type, or extension, plans the shortest registered conversion route with breadth-first search, and executes the conversion entirely in the browser.

This extracted repo contains the reusable runtime only. It does not include the `steadytao.com` page controller or site styling.

## What is in this folder

- `src/registry.js`: format registry, route planning, file detection, and conversion orchestration
- `src/runtime.js`: default runtime bootstrap with bundled formats, kinds, and handlers
- `src/formats.js`: bundled format definitions
- `src/kinds.js`: bundled intermediate kind definitions
- `src/handlers/`: bundled handlers and shared raster utilities
- `src/index.js`: package entrypoint

## Current bundled support

- PNG
- JPG / JPEG

Current conversions:

- PNG -> JPG
- JPG -> PNG

Current detection order:

1. File signature / magic bytes
2. Browser MIME type
3. Filename extension

## Quick start

```js
import { createTransmuteRuntime } from "./src/index.js";

const runtime = createTransmuteRuntime();

const description = await runtime.describeFile(file);
if (!description.isSupportedSource) {
  throw new Error("This file is not supported by the current runtime.");
}

const targets = runtime.listTargets(description.formatId);
const result = await runtime.convert(file, targets[0].formatId, {
  backgroundColor: "#ffffff",
  quality: 0.92,
});

console.log(description);
console.log(targets);
console.log(result.asset.fileName, result.asset.mimeType, result.asset.fileSize);
```

## Custom runtime setup

If you want to supply your own formats, kinds, or handlers:

```js
import {
  createTransmuteRuntime,
  DEFAULT_TRANSMUTE_FORMATS,
  DEFAULT_TRANSMUTE_KINDS,
  DEFAULT_TRANSMUTE_HANDLERS,
} from "./src/index.js";

const runtime = createTransmuteRuntime({
  formats: DEFAULT_TRANSMUTE_FORMATS,
  kinds: DEFAULT_TRANSMUTE_KINDS,
  handlers: DEFAULT_TRANSMUTE_HANDLERS,
});
```

If you want full manual control:

```js
import { TransmuteRegistry } from "./src/index.js";

const registry = new TransmuteRegistry();
```

## Browser requirements

Transmute currently assumes a browser environment with:

- `Blob`
- `URL.createObjectURL`
- `Image` and/or `createImageBitmap`
- `HTMLCanvasElement`
- `canvas.toBlob`

The bundled raster handlers are browser-only by design.