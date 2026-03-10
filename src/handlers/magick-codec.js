// Copyright (c) 2026 Tao
// SPDX-License-Identifier: MPL-2.0
/* Shared Magick-read, custom-write handler factory. */

import {
  renderRasterFrameToCanvas,
  renderRasterToCanvas,
} from "./raster.js";
import { readMagickBlob } from "../wasm/magick.js";

function buildFrameFileName(sourceFileName, extension, frameIndex, frameCount) {
  const baseName = String(sourceFileName || "converted")
    .trim()
    .replace(/(\.[^.]+)?$/, "");
  const padWidth = Math.max(1, String(frameCount || 0).length);
  const paddedIndex = String(frameIndex + 1).padStart(padWidth, "0");
  return `${baseName || "converted"}-${paddedIndex}${extension}`;
}

function wrapRasterAsSequence(rasterAsset) {
  const frame = {
    kind: "raster-frame",
    width: rasterAsset.width,
    height: rasterAsset.height,
    drawToContext(drawingContext) {
      rasterAsset.drawToContext(drawingContext);
    },
    release() {},
  };

  return {
    kind: "raster-frame-sequence",
    width: rasterAsset.width,
    height: rasterAsset.height,
    frameCount: 1,
    frames: Object.freeze([frame]),
    release() {
      rasterAsset.release?.();
    },
    drawFrameToContext(frameIndex, drawingContext) {
      if (frameIndex !== 0) {
        throw new Error("Frame index is out of range");
      }
      rasterAsset.drawToContext(drawingContext);
    },
  };
}

function buildFileAsset(blob, sourceFileName, targetFormat, buildOutputFileName) {
  return {
    kind: "file",
    blob,
    fileName: buildOutputFileName(
      sourceFileName || "converted",
      targetFormat.extensions[0],
    ),
    fileSize: blob.size,
    mimeType: targetFormat.mimeType,
    formatId: targetFormat.id,
  };
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

export function createMagickCodecHandler({
  id,
  label,
  formatId,
  readError,
  writeError = "",
  readMode = "raster",
  sequenceWriteMode = "archive",
  encodeCanvas,
  encodeSequence,
}) {
  if (typeof encodeCanvas !== "function") {
    throw new Error(`Handler ${id} requires an encodeCanvas function`);
  }

  const produces =
    readMode === "sequence" ? ["raster-frame-sequence"] : ["raster-image"];

  return Object.freeze({
    id,
    label,
    formatId,
    produces: Object.freeze(produces),
    consumes: Object.freeze(["raster-image", "raster-frame-sequence"]),
    async read(asset) {
      const decodedAsset = await readMagickBlob(asset.blob, {
        readMode,
        errorMessage: readError,
      });

      const finalAsset =
        readMode === "sequence" && decodedAsset.kind !== "raster-frame-sequence"
          ? wrapRasterAsSequence(decodedAsset)
          : decodedAsset;

      return {
        ...finalAsset,
        sourceFileName: asset.fileName,
      };
    },
    async write(intermediateAsset, context) {
      const targetFormat = context.targetFormat;

      try {
        if (intermediateAsset.kind === "raster-frame-sequence") {
          const canvases = intermediateAsset.frames.map((frame) =>
            renderRasterFrameToCanvas(frame, {
              alpha: true,
              clearCanvas: true,
            }),
          );

          if (sequenceWriteMode === "container") {
            if (typeof encodeSequence !== "function") {
              throw new Error(writeError);
            }

            const outputBlob = await encodeSequence(canvases, {
              ...context,
              writeError,
            });
            return buildFileAsset(
              outputBlob,
              intermediateAsset.sourceFileName,
              targetFormat,
              context.buildOutputFileName,
            );
          }

          const items = [];
          for (let frameIndex = 0; frameIndex < canvases.length; frameIndex += 1) {
            const outputBlob = await encodeCanvas(canvases[frameIndex], {
              ...context,
              writeError,
            });
            items.push({
              blob: outputBlob,
              fileName: buildFrameFileName(
                intermediateAsset.sourceFileName || "converted",
                targetFormat.extensions[0],
                frameIndex,
                canvases.length,
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
        const outputBlob = await encodeCanvas(canvas, {
          ...context,
          writeError,
        });

        return buildFileAsset(
          outputBlob,
          intermediateAsset.sourceFileName,
          targetFormat,
          context.buildOutputFileName,
        );
      } finally {
        intermediateAsset.release?.();
      }
    },
  });
}
