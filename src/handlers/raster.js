// Copyright (c) 2026 Tao
// SPDX-License-Identifier: MPL-2.0
/* Shared raster image handler utilities. */

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

async function loadImageSource(blob, errorMessage) {
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

function blobMatchesMimeType(blob, mimeType) {
  return Boolean(blob && blob.type === mimeType);
}

async function encodeCanvasWithImageEncoder(canvas, mimeType, quality, errorMessage) {
  if (typeof ImageEncoder !== "function") {
    throw new Error(errorMessage);
  }

  const drawingContext = canvas.getContext("2d", {
    alpha: true,
    willReadFrequently: true,
  });
  if (!drawingContext) {
    throw new Error(errorMessage);
  }

  const imageData = drawingContext.getImageData(0, 0, canvas.width, canvas.height);
  const chunks = [];
  let encoderError = null;
  const encoder = new ImageEncoder({
    type: mimeType,
    width: canvas.width,
    height: canvas.height,
    quality,
    output(chunk) {
      const bytes = new Uint8Array(chunk.byteLength);
      chunk.copyTo(bytes);
      chunks.push(bytes);
    },
    error(error) {
      encoderError = error;
    },
  });

  try {
    await encoder.encode(imageData);
    await encoder.flush();
    if (encoderError || !chunks.length) {
      throw encoderError || new Error(errorMessage);
    }
    return new Blob(chunks, { type: mimeType });
  } catch {
    throw new Error(errorMessage);
  } finally {
    encoder.close?.();
  }
}

function createRasterFrame(source, width, height, release = () => {}) {
  return {
    kind: "raster-frame",
    width,
    height,
    drawToContext(drawingContext) {
      drawingContext.drawImage(source, 0, 0);
    },
    release,
  };
}

async function decodeAnimatedFrames(blob, mimeType, errorMessage) {
  if (typeof ImageDecoder !== "function") {
    return null;
  }

  try {
    const data = await blob.arrayBuffer();
    const decoder = new ImageDecoder({ data, type: mimeType });
    await decoder.tracks.ready;
    const selectedTrack = decoder.tracks.selectedTrack;
    const frameCount = Number(selectedTrack?.frameCount) || 1;
    if (frameCount <= 1) {
      decoder.close();
      return null;
    }

    const frames = [];
    for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
      const { image } = await decoder.decode({ frameIndex });
      const bitmap = await createImageBitmap(image);
      image.close();
      frames.push(
        createRasterFrame(bitmap, bitmap.width, bitmap.height, () => {
          bitmap.close();
        }),
      );
    }
    decoder.close();
    return frames;
  } catch {
    return null;
  }
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

export async function readRasterAsset(blob, errorMessage) {
  const imageSource = await loadImageSource(blob, errorMessage);

  return {
    kind: "raster-image",
    width: imageSource.width,
    height: imageSource.height,
    drawToContext(drawingContext) {
      drawingContext.drawImage(imageSource.source, 0, 0);
    },
    release() {
      imageSource.release();
    },
  };
}

export async function readRasterFrameSequence(blob, mimeType, errorMessage) {
  const animatedFrames = await decodeAnimatedFrames(blob, mimeType, errorMessage);
  if (animatedFrames?.length) {
    const firstFrame = animatedFrames[0];
    return {
      kind: "raster-frame-sequence",
      width: firstFrame.width,
      height: firstFrame.height,
      frameCount: animatedFrames.length,
      frames: Object.freeze(animatedFrames),
      release() {
        animatedFrames.forEach((frame) => frame.release?.());
      },
      drawFrameToContext(frameIndex, drawingContext) {
        const frame = animatedFrames[frameIndex];
        if (!frame) {
          throw new Error("Frame index is out of range");
        }
        frame.drawToContext(drawingContext);
      },
    };
  }

  const rasterAsset = await readRasterAsset(blob, errorMessage);
  return wrapRasterAsSequence(rasterAsset);
}

export function renderRasterToCanvas(rasterAsset, options = {}) {
  if (!rasterAsset || rasterAsset.kind !== "raster-image") {
    throw new Error("This handler expected a raster-image intermediate");
  }

  const canvas = document.createElement("canvas");
  canvas.width = rasterAsset.width;
  canvas.height = rasterAsset.height;

  const drawingContext = canvas.getContext("2d", {
    alpha: options.alpha !== false,
  });
  if (!drawingContext) {
    throw new Error("Canvas 2D is unavailable in this browser");
  }

  if (options.backgroundColour) {
    drawingContext.fillStyle = options.backgroundColour;
    drawingContext.fillRect(0, 0, canvas.width, canvas.height);
  } else if (options.clearCanvas !== false) {
    drawingContext.clearRect(0, 0, canvas.width, canvas.height);
  }

  rasterAsset.drawToContext(drawingContext);
  return canvas;
}

export function renderRasterFrameToCanvas(rasterFrame, options = {}) {
  if (!rasterFrame || rasterFrame.kind !== "raster-frame") {
    throw new Error("This handler expected a raster-frame asset");
  }

  const canvas = document.createElement("canvas");
  canvas.width = rasterFrame.width;
  canvas.height = rasterFrame.height;

  const drawingContext = canvas.getContext("2d", {
    alpha: options.alpha !== false,
  });
  if (!drawingContext) {
    throw new Error("Canvas 2D is unavailable in this browser");
  }

  if (options.backgroundColour) {
    drawingContext.fillStyle = options.backgroundColour;
    drawingContext.fillRect(0, 0, canvas.width, canvas.height);
  } else if (options.clearCanvas !== false) {
    drawingContext.clearRect(0, 0, canvas.width, canvas.height);
  }

  rasterFrame.drawToContext(drawingContext);
  return canvas;
}

export async function canvasToBlob(canvas, mimeType, quality, errorMessage) {
  if (
    typeof OffscreenCanvas === "function" &&
    typeof OffscreenCanvas.prototype.convertToBlob === "function"
  ) {
    try {
      const offscreen = new OffscreenCanvas(canvas.width, canvas.height);
      const context = offscreen.getContext("2d", { alpha: true });
      context?.drawImage(canvas, 0, 0);
      const blob = await offscreen.convertToBlob({
        type: mimeType,
        quality,
      });
      if (blobMatchesMimeType(blob, mimeType)) {
        return blob;
      }
    } catch {
      // Fall through to HTMLCanvasElement.toBlob.
    }
  }

  if (
    (mimeType === "image/webp" || mimeType === "image/avif") &&
    typeof ImageEncoder === "function"
  ) {
    try {
      return await encodeCanvasWithImageEncoder(
        canvas,
        mimeType,
        quality,
        errorMessage,
      );
    } catch {
      // Fall through to HTMLCanvasElement.toBlob.
    }
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blobMatchesMimeType(blob, mimeType)) {
        reject(new Error(errorMessage));
        return;
      }
      resolve(blob);
    }, mimeType, quality);
  });
}
