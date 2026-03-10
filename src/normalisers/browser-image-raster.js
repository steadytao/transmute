/* Browser image raster fallback normaliser. */

import { canvasToBlob } from "../handlers/raster.js";

function loadImageElement(blob, errorMessage) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(blob);
    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      resolve({
        source: image,
        width: image.naturalWidth,
        height: image.naturalHeight,
        release() {
          URL.revokeObjectURL(objectUrl);
        },
      });
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(errorMessage));
    };
    image.src = objectUrl;
  });
}

async function loadRenderableImage(blob, errorMessage) {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(blob);
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        release() {
          bitmap.close();
        },
      };
    } catch {
      return loadImageElement(blob, errorMessage);
    }
  }

  return loadImageElement(blob, errorMessage);
}

export const browserImageRasterNormaliser = Object.freeze({
  id: "browser-image-raster",
  label: "Browser image raster normaliser",
  async normalise(file, context) {
    const outputFormat = context.outputFormat;
    if (!outputFormat) {
      throw new Error("The browser image normaliser did not receive an output format.");
    }

    const renderable = await loadRenderableImage(
      file,
      "This browser could not decode the uploaded image for normalisation.",
    );

    try {
      const canvas = document.createElement("canvas");
      canvas.width = renderable.width;
      canvas.height = renderable.height;

      const isJpgOutput = outputFormat.id === "image/jpeg";
      const drawingContext = canvas.getContext("2d", {
        alpha: !isJpgOutput,
      });

      if (!drawingContext) {
        throw new Error("Canvas 2D is unavailable in this browser.");
      }

      if (isJpgOutput) {
        drawingContext.fillStyle = context.options?.backgroundColour || "#ffffff";
        drawingContext.fillRect(0, 0, canvas.width, canvas.height);
      } else {
        drawingContext.clearRect(0, 0, canvas.width, canvas.height);
      }

      drawingContext.drawImage(renderable.source, 0, 0);

      const outputBlob = await canvasToBlob(
        canvas,
        outputFormat.mimeType,
        isJpgOutput
          ? Math.max(0.1, Math.min(1, Number(context.options?.quality) || 0.92))
          : undefined,
        "The browser failed to encode the normalised output.",
      );

      return {
        blob: outputBlob,
        fileName: context.buildOutputFileName(
          context.source.fileName || "converted",
          outputFormat.extensions[0],
        ),
        fileSize: outputBlob.size,
        mimeType: outputFormat.mimeType,
        formatId: outputFormat.id,
      };
    } finally {
      renderable.release();
    }
  },
});
