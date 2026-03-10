// Copyright (c) 2026 Tao
// SPDX-License-Identifier: MPL-2.0
/* Transmute source normaliser manifests. */

function createLazyNormaliserManifest({
  id,
  label,
  mediaKinds,
  mimePrefixes,
  formatIds,
  extensions,
  requiresBrowserRenderable,
  whenUnknownOnly,
  outputs,
  load,
}) {
  return Object.freeze({
    id,
    label,
    mediaKinds: Object.freeze([...(mediaKinds || [])]),
    mimePrefixes: Object.freeze([...(mimePrefixes || [])]),
    formatIds: Object.freeze([...(formatIds || [])]),
    extensions: Object.freeze([...(extensions || [])]),
    requiresBrowserRenderable: Boolean(requiresBrowserRenderable),
    whenUnknownOnly: Boolean(whenUnknownOnly),
    outputs: Object.freeze(
      (outputs || []).map((output) =>
        Object.freeze({
          formatId: output.formatId,
          mode: output.mode || "",
          lossProfile: output.lossProfile || "",
          explanation: output.explanation || "",
        }),
      ),
    ),
    load,
  });
}

export const BROWSER_IMAGE_RASTER_NORMALISER = createLazyNormaliserManifest({
  id: "browser-image-raster",
  label: "Browser image raster normaliser",
  mediaKinds: ["image"],
  mimePrefixes: ["image/"],
  requiresBrowserRenderable: true,
  outputs: [
    {
      formatId: "image/png",
      mode: "render-raster",
      lossProfile: "visually-lossless-raster",
      explanation:
        "Preferred browser normalisation target for images without a dedicated handler",
    },
    {
      formatId: "image/jpeg",
      mode: "render-raster",
      lossProfile: "lossy-raster",
      explanation:
        "Fallback raster normalisation target when JPG is the most direct output route",
    },
  ],
  load: async () =>
    (await import("./normalisers/browser-image-raster.js"))
      .browserImageRasterNormaliser,
});

export const TRANSMUTE_NORMALISERS = Object.freeze([
  BROWSER_IMAGE_RASTER_NORMALISER,
]);
