# Transmute

Transmute is a browser-side local file conversion runtime. It identifies files from signatures, MIME types, and extensions, plans the shortest available conversion route with breadth-first search, and executes the resulting path entirely in the browser.

This repository contains the reusable runtime only. It does not include the `steadytao.com` page controller, page styling, or site-specific UI behaviour.

## Runtime model

Transmute is built around four layers:
- formats: canonical file definitions, aliases, extensions, browser hints, and signatures
- kinds: shared intermediate representations such as `raster-image`
- handlers: explicit read/write implementations for a format
- normalisers: fallback source transforms used when a file can be rendered locally but does not yet have a dedicated handler
The runtime prefers direct handler routes first. If there is no direct path, it can fall back to a normalisation step and then continue routing from the resulting format.

## Bundled support

Bundled explicit handlers:
- PNG
- JPG / JPEG

Bundled catalogue entries:
- PNG
- JPG / JPEG
- WEBP
- SVG
- GIF
- BMP
- TIFF
- ICO
- AVIF

Bundled normaliser:
- `browser-image-raster`
  - intended for browser-renderable image inputs that do not yet have a dedicated handler
  - can currently normalise into PNG or JPG before routing continues

Current direct conversions:
- PNG -> JPG
- JPG -> PNG

Current detection order:
1. File signature / magic bytes
2. Browser MIME type
3. Filename extension

## Package structure

- `src/registry.js`: format registry, route planning, file detection, target planning, and conversion orchestration
- `src/runtime.js`: default runtime bootstrap with bundled formats, kinds, handlers, and normalisers
- `src/formats.js`: bundled format catalogue definitions
- `src/kinds.js`: bundled intermediate kind definitions
- `src/handlers/`: bundled explicit handlers and shared raster utilities
- `src/normalisers/`: bundled fallback source normalisers
- `src/index.js`: package entrypoint

## Quick start

```js
import { createTransmuteRuntime } from "./src/index.js";

const runtime = createTransmuteRuntime();
const description = await runtime.describeFile(file);

if (!description.isSupportedSource) {
  throw new Error("This file is not supported by the current runtime.");
}

const targets = runtime.listTargetsForDescription(description);
if (!targets.length) {
  throw new Error("No output formats are available for this file.");
}

const target = targets[0];
const result = await runtime.convert(file, target.formatId, {
  backgroundColour: "#ffffff",
  quality: 0.92,
});

console.log(description);
console.log(targets);
console.log(result.normalisation);
console.log(result.asset.fileName, result.asset.mimeType, result.asset.fileSize);
```

## Custom runtime setup

If you want to supply your own runtime components:
```js
import {
  createTransmuteRuntime,
  DEFAULT_TRANSMUTE_FORMATS,
  DEFAULT_TRANSMUTE_KINDS,
  DEFAULT_TRANSMUTE_HANDLERS,
  DEFAULT_TRANSMUTE_NORMALISERS,
} from "./src/index.js";

const runtime = createTransmuteRuntime({
  formats: DEFAULT_TRANSMUTE_FORMATS,
  kinds: DEFAULT_TRANSMUTE_KINDS,
  handlers: DEFAULT_TRANSMUTE_HANDLERS,
  normalisers: DEFAULT_TRANSMUTE_NORMALISERS,
});
```

If you want full manual control:
```js
import { TransmuteRegistry } from "./src/index.js";

const registry = new TransmuteRegistry();
```

## Browser requirements

The bundled raster handlers and normalisers assume a browser environment with:
- `Blob`
- `URL.createObjectURL`
- `Image` and/or `createImageBitmap`
- `HTMLCanvasElement`
- `canvas.toBlob`
- `TextDecoder`
The bundled raster tooling is browser-only by design.
