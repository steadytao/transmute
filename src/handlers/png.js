/* PNG format handler. */

import { canvasToBlob, readRasterAsset, renderRasterToCanvas } from "./raster.js";

export const pngHandler = Object.freeze({
  id: "png",
  label: "PNG handler",
  formatId: "image/png",
  produces: Object.freeze(["raster-image"]),
  consumes: Object.freeze(["raster-image"]),
  async read(asset) {
    const rasterAsset = await readRasterAsset(
      asset.blob,
      "The uploaded PNG could not be decoded.",
    );
    return {
      ...rasterAsset,
      sourceFileName: asset.fileName,
    };
  },
  async write(intermediateAsset, context) {
    const targetFormat = context.targetFormat;
    try {
      const canvas = renderRasterToCanvas(intermediateAsset, {
        alpha: true,
        clearCanvas: true,
      });

      const outputBlob = await canvasToBlob(
        canvas,
        targetFormat.mimeType,
        undefined,
        "The browser failed to encode the PNG output.",
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
