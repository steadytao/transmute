// Copyright (c) 2026 Tao
// SPDX-License-Identifier: MPL-2.0
/* Generic browser-decoded image handler factory. */

import {
  canvasToBlob,
  readRasterAsset,
  readRasterFrameSequence,
  renderRasterFrameToCanvas,
  renderRasterToCanvas,
} from "./raster.js";

function clampQuality(value, fallback = 0.92) {
  return Math.max(0.1, Math.min(1, Number(value) || fallback));
}

function buildRenderOptions(output, options) {
  return output.flattenAlpha
    ? {
        alpha: false,
        backgroundColour: options?.backgroundColour || "#ffffff",
      }
    : {
        alpha: output.alpha !== false,
        clearCanvas: true,
      };
}

function buildQuality(output, options) {
  return output.quality === "lossy"
    ? clampQuality(options?.quality, output.defaultQuality || 0.92)
    : undefined;
}

async function encodeOutputCanvas(
  canvas,
  output,
  targetFormat,
  quality,
  context,
  writeError,
) {
  if (typeof output.encodeCanvas === "function") {
    return output.encodeCanvas(canvas, {
      ...context,
      targetFormat,
      quality,
      writeError,
    });
  }

  return canvasToBlob(
    canvas,
    targetFormat.mimeType,
    quality,
    writeError,
  );
}

function buildFrameFileName(sourceFileName, extension, frameIndex, frameCount) {
  const baseName = String(sourceFileName || "converted")
    .trim()
    .replace(/(\.[^.]+)?$/, "");
  const padWidth = Math.max(1, String(frameCount || 0).length);
  const paddedIndex = String(frameIndex + 1).padStart(padWidth, "0");
  return `${baseName || "converted"}-${paddedIndex}${extension}`;
}

export function createBrowserImageHandler({
  id,
  label,
  formatId,
  readError,
  writeError = "",
  output = null,
  readMode = "raster",
}) {
  const canWrite = Boolean(output);
  const produces =
    readMode === "sequence" ? ["raster-frame-sequence"] : ["raster-image"];
  const consumes = canWrite
    ? ["raster-image", "raster-frame-sequence"]
    : [];

  const handler = {
    id,
    label,
    formatId,
    produces: Object.freeze(produces),
    consumes: Object.freeze(consumes),
    async read(asset) {
      const decodedAsset =
        readMode === "sequence"
          ? await readRasterFrameSequence(
              asset.blob,
              asset.mimeType || formatId,
              readError,
            )
          : await readRasterAsset(asset.blob, readError);
      return {
        ...decodedAsset,
        sourceFileName: asset.fileName,
      };
    },
  };

  if (canWrite) {
    handler.write = async (intermediateAsset, context) => {
      const targetFormat = context.targetFormat;
      const renderOptions = buildRenderOptions(output, context.options);
      const quality = buildQuality(output, context.options);

      try {
        if (intermediateAsset.kind === "raster-frame-sequence") {
          const items = [];
          const frameCount = intermediateAsset.frames.length;
          for (let frameIndex = 0; frameIndex < intermediateAsset.frames.length; frameIndex += 1) {
            const frame = intermediateAsset.frames[frameIndex];
            const canvas = renderRasterFrameToCanvas(frame, renderOptions);
            const outputBlob = await encodeOutputCanvas(
              canvas,
              output,
              targetFormat,
              quality,
              context,
              writeError,
            );

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

        const canvas = renderRasterToCanvas(intermediateAsset, renderOptions);
        const outputBlob = await encodeOutputCanvas(
          canvas,
          output,
          targetFormat,
          quality,
          context,
          writeError,
        );

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
