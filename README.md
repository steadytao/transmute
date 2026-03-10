# Transmute

Transmute is a browser-side local file conversion runtime. It identifies files from signatures, MIME types, and extensions, plans the shortest available route with breadth-first search, and executes the resulting path entirely in the browser.

This repository contains the reusable runtime only. It does not include the `steadytao.com` page controller, page styling, or site-specific UI behaviour.

## Runtime model

Transmute is built around four layers:
- formats: canonical file definitions, aliases, extensions, browser hints, and signatures
- kinds: shared intermediate representations such as `raster-image` and `raster-frame-sequence`
- handlers: explicit read and write implementations for a format
- normalisers: fallback source transforms used when a file can be rendered locally but does not yet have a dedicated handler

The runtime prefers direct handler routes first. If there is no direct path, it can fall back to a normalisation step and then continue routing from the resulting format.

## Bundled support

Bundled explicit handlers:
- APNG
- PNG
- JPG / JPEG
- WEBP
- SVG
- GIF
- BMP
- TIFF
- TGA
- ICO
- ICNS
- AVIF
- HEIC
- HEIF
- JPEG XL
- JPEG 2000
- CUR
- QOI
- DDS
- PSD
- OpenEXR
- Radiance HDR
- KTX
- KTX2
- PBM
- PGM
- PPM
- PAM
- MNG
- JPEG XR
- BPG

Writable targets bundled by default:
- APNG
- PNG
- JPG / JPEG
- WEBP when the current browser can encode it
- SVG
- GIF
- BMP
- TIFF
- TGA
- ICO
- ICNS
- AVIF
- HEIC
- HEIF
- JPEG XL
- JPEG 2000
- CUR
- QOI
- DDS
- PSD
- OpenEXR
- Radiance HDR
- KTX
- KTX2
- PBM
- PGM
- PPM
- PAM
- MNG

Input-only bundled formats:
- JPEG XR
- BPG

Current route advisories include cases such as:
- transparency flattening for JPG output
- rasterisation of SVG inputs
- archive frame-set exports for animated image routes
- single-image extraction or repackaging for icon and cursor formats
- locally encoded outputs that may be lossy, such as AVIF, HEIC, and HEIF

## Vendored runtime assets

The package ships vendored runtime assets under `vendor/` for formats that need more than a simple handler file:
- AVIF encoder runtime
- HEIC and HEIF codec runtime
- ImageMagick WebAssembly runtime
- KTX and KTX2 parsing helpers
- APNG encoding helpers

Simple formats still remain simple. Formats such as PNG, JPG, BMP, and TIFF are still introduced as normal handlers. More complex formats only pick up extra files when a codec or container runtime is actually required.

## Output model

Conversion results can resolve to:
- a single output file
- a bundled ZIP archive

The bundled-output path is used for sequence and container routes, such as frame extraction from animated image sources.

Current detection order:
1. File signature / magic bytes
2. Browser MIME type
3. Filename extension

## Package structure

- `src/registry.js`: format registry, route planning, file detection, target planning, and conversion orchestration
- `src/runtime.js`: default runtime bootstrap with bundled formats, kinds, handlers, and normalisers
- `src/archive.js`: ZIP archive builder for bundled outputs
- `src/output.js`: output normalisation for single-file and archive results
- `src/formats.js`: bundled format catalogue definitions
- `src/kinds.js`: bundled intermediate kind definitions
- `src/handlers/`: bundled explicit handlers and shared raster utilities
- `src/normalisers/`: bundled fallback source normalisers
- `src/wasm/`: shared codec loaders and advanced WebAssembly-backed helpers
- `vendor/`: vendored third-party runtime assets required by the bundled handlers
- `src/index.js`: package entrypoint

Concrete handlers are exposed through package subpath exports such as `./handlers/png` and `./handlers/heic`. The root entrypoint stays lightweight so importing it does not eagerly pull browser-only codec modules into environments that do not need them.

## Quick start

```js
import { createPreparedTransmuteRuntime } from "./src/index.js";

const runtime = await createPreparedTransmuteRuntime();
const description = await runtime.describeFile(file);

if (!description.isSupportedSource) {
  throw new Error("This file is not supported by the current runtime");
}

const targets = runtime.listTargetsForDescription(description);
if (!targets.length) {
  throw new Error("No output formats are available for this file");
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

```js
import {
  createPreparedTransmuteRuntime,
  createTransmuteRuntime,
  DEFAULT_TRANSMUTE_FORMATS,
  DEFAULT_TRANSMUTE_HANDLERS,
  DEFAULT_TRANSMUTE_KINDS,
  DEFAULT_TRANSMUTE_NORMALISERS,
} from "./src/index.js";

const runtime = createTransmuteRuntime({
  formats: DEFAULT_TRANSMUTE_FORMATS,
  kinds: DEFAULT_TRANSMUTE_KINDS,
  handlers: DEFAULT_TRANSMUTE_HANDLERS,
  normalisers: DEFAULT_TRANSMUTE_NORMALISERS,
});
```

If you want the runtime to probe browser encoder support before it builds the default handler set, use:

```js
const runtime = await createPreparedTransmuteRuntime();
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

Some bundled targets also rely on browser image encoding support or bundled codec runtimes. The default prepared runtime probes the current browser before it exposes encoder-dependent write paths such as WEBP and AVIF.
