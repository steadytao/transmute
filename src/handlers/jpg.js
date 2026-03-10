/* JPG format handler. */

import { canvasToBlob, readRasterAsset, renderRasterToCanvas } from "./raster.js";

export const jpgHandler = Object.freeze({
  id: "jpg",
  label: "JPG handler",
  formatId: "image/jpeg",
  produces: Object.freeze(["raster-image"]),
  consumes: Object.freeze(["raster-image"]),
  async read(asset) {
    const rasterAsset = await readRasterAsset(
      asset.blob,
      "The uploaded JPG could not be decoded.",
    );
    return {
      ...rasterAsset,
      sourceFileName: asset.fileName,
    };
  },
  async write(intermediateAsset, context) {
    const targetFormat = context.targetFormat;
    const quality = Math.max(
      0.1,
      Math.min(1, Number(context.options?.quality) || 0.92),
    );
    try {
      const canvas = renderRasterToCanvas(intermediateAsset, {
        alpha: false,
        backgroundColour: context.options?.backgroundColour || "#ffffff",
      });

      const outputBlob = await canvasToBlob(
        canvas,
        targetFormat.mimeType,
        quality,
        "The browser failed to encode the JPG output.",
      );

      return {
        blob: outputBlob,
        fileName: context.buildOutputFileName(
          intermediateAsset.sourceFileName || "converted",
          targetFormat.extensions[0],
        ),
        fileSize: outputBlob.size,
        mimeType: targetFormat.mimeType,
        formatId: targetFormat.id,
      };
    } finally {
      intermediateAsset.release?.();
    }
  },
});
