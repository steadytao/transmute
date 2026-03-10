// Copyright (c) 2026 Tao
// SPDX-License-Identifier: MPL-2.0
/* Shared ImageMagick-backed image handler factory. */

import {
  renderRasterFrameToCanvas,
  renderRasterToCanvas,
} from "./raster.js";
import {
  readMagickBlob,
  writeMagickCanvas,
  writeMagickSequence,
} from "../wasm/magick.js";

function clampQuality(value, fallback = 0.92) {
  return Math.max(0.1, Math.min(1, Number(value) || fallback));
}

function buildFrameFileName(sourceFileName, extension, frameIndex, frameCount) {
  const baseName = String(sourceFileName || "converted")
    .trim()
    .replace(/(\.[^.]+)?$/, "");
  const padWidth = Math.max(1, String(frameCount || 0).length);
  const paddedIndex = String(frameIndex + 1).padStart(padWidth, "0");
  return `${baseName || "converted"}-${paddedIndex}${extension}`;
}

export function createMagickImageHandler({
  id,
  label,
  formatId,
  readError,
  writeError = "",
  readMode = "raster",
  canWrite = true,
  sequenceWriteMode = "archive",
  defaultQuality = 0.92,
}) {
  const produces =
    readMode === "sequence" ? ["raster-frame-sequence"] : ["raster-image"];
  const consumes = canWrite ? ["raster-image", "raster-frame-sequence"] : [];

  const handler = {
    id,
    label,
    formatId,
    produces: Object.freeze(produces),
    consumes: Object.freeze(consumes),
    async read(asset) {
      const decodedAsset = await readMagickBlob(asset.blob, {
        readMode,
        errorMessage: readError,
      });
      return {
        ...decodedAsset,
        sourceFileName: asset.fileName,
      };
    },
  };

  if (canWrite) {
    handler.write = async (intermediateAsset, context) => {
      const targetFormat = context.targetFormat;
      const quality = clampQuality(context.options?.quality, defaultQuality);

      try {
        if (intermediateAsset.kind === "raster-frame-sequence") {
          const frameCount = intermediateAsset.frames.length;
          const canvases = intermediateAsset.frames.map((frame) =>
            renderRasterFrameToCanvas(frame, {
              alpha: true,
              clearCanvas: true,
            }),
          );

          if (sequenceWriteMode === "container") {
            const outputBlob = await writeMagickSequence(canvases, {
              formatId: targetFormat.id,
              mimeType: targetFormat.mimeType,
              quality,
              errorMessage: writeError,
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
          }

          const items = [];
          for (let frameIndex = 0; frameIndex < canvases.length; frameIndex += 1) {
            const outputBlob = await writeMagickCanvas(canvases[frameIndex], {
              formatId: targetFormat.id,
              mimeType: targetFormat.mimeType,
              quality,
              errorMessage: writeError,
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

          const baseName = String(intermediateAsset.sourceFileName || "converted")
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

        const canvas = renderRasterToCanvas(intermediateAsset, {
          alpha: true,
          clearCanvas: true,
        });
        const outputBlob = await writeMagickCanvas(canvas, {
          formatId: targetFormat.id,
          mimeType: targetFormat.mimeType,
          quality,
          errorMessage: writeError,
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
    };
  }

  return Object.freeze(handler);
}
