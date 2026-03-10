// Copyright (c) 2026 Tao
// SPDX-License-Identifier: MPL-2.0
/* ICNS format handler. */

import { encodeIcnsCanvas, decodeIcnsBlob } from "./icns-codec.js";
import {
  renderRasterFrameToCanvas,
  renderRasterToCanvas,
} from "./raster.js";

function buildFrameFileName(sourceFileName, extension, frameIndex, frameCount) {
  const baseName = String(sourceFileName || "converted")
    .trim()
    .replace(/(\.[^.]+)?$/, "");
  const padWidth = Math.max(1, String(frameCount || 0).length);
  const paddedIndex = String(frameIndex + 1).padStart(padWidth, "0");
  return `${baseName || "converted"}-${paddedIndex}${extension}`;
}

function buildArchiveAsset(items, sourceFileName, targetFormat) {
  const baseName = String(sourceFileName || "converted")
    .trim()
    .replace(/(\.[^.]+)?$/, "");

  return {
    kind: "archive",
    fileName: `${baseName || "converted"}-${targetFormat.label.toLowerCase()}-frames.zip`,
    formatId: targetFormat.id,
    label: `${targetFormat.label} frame set`,
    items,
  };
}

export const icnsHandler = Object.freeze({
  id: "icns",
  label: "ICNS handler",
  formatId: "image/icns",
  produces: Object.freeze(["raster-image"]),
  consumes: Object.freeze(["raster-image", "raster-frame-sequence"]),
  async read(asset) {
    const decodedAsset = await decodeIcnsBlob(
      asset.blob,
      "The uploaded ICNS image could not be decoded",
    );

    return {
      ...decodedAsset,
      sourceFileName: asset.fileName,
    };
  },
  async write(intermediateAsset, context) {
    const targetFormat = context.targetFormat;

    try {
      if (intermediateAsset.kind === "raster-frame-sequence") {
        const items = [];
        const frameCount = intermediateAsset.frames.length;

        for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
          const canvas = renderRasterFrameToCanvas(
            intermediateAsset.frames[frameIndex],
            {
              alpha: true,
              clearCanvas: true,
            },
          );
          const outputBlob = await encodeIcnsCanvas(canvas, {
            ...context,
            writeError: "Transmute failed to encode the ICNS output",
          });

          items.push({
            blob: outputBlob,
            fileName: buildFrameFileName(
              intermediateAsset.sourceFileName || "converted",
              targetFormat.extensions[0],
              frameIndex,
              frameCount,
            ),
            fileSize: outputBlob.size,
            mimeType: targetFormat.mimeType,
            formatId: targetFormat.id,
          });
        }

        return buildArchiveAsset(
          items,
          intermediateAsset.sourceFileName,
          targetFormat,
        );
      }

      const canvas = renderRasterToCanvas(intermediateAsset, {
        alpha: true,
        clearCanvas: true,
      });
      const outputBlob = await encodeIcnsCanvas(canvas, {
        ...context,
        writeError: "Transmute failed to encode the ICNS output",
      });

      return {
        kind: "file",
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
