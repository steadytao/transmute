// Copyright (c) 2026 Tao
// SPDX-License-Identifier: MPL-2.0
/* Local APNG encoder helpers. */

import UPNG from "../../vendor/upng/index.js";

const PNG_SIGNATURE = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);
const SINGLE_FRAME_DELAY_MS = 100;

function getImageDataBuffer(canvas, width, height) {
  const drawingContext = canvas.getContext("2d", {
    alpha: true,
    willReadFrequently: true,
  });
  if (!drawingContext) {
    throw new Error("Canvas 2D is unavailable in this browser");
  }

  const imageData = drawingContext.getImageData(0, 0, width, height);
  return imageData.data.slice().buffer;
}

function createSizedCanvas(canvas, width, height) {
  if (canvas.width === width && canvas.height === height) {
    return canvas;
  }

  const normalisedCanvas = document.createElement("canvas");
  normalisedCanvas.width = width;
  normalisedCanvas.height = height;

  const drawingContext = normalisedCanvas.getContext("2d", { alpha: true });
  if (!drawingContext) {
    throw new Error("Canvas 2D is unavailable in this browser");
  }

  drawingContext.clearRect(0, 0, width, height);
  drawingContext.drawImage(canvas, 0, 0);
  return normalisedCanvas;
}

function clampDelay(value) {
  return Math.max(1, Math.round(Number(value) || SINGLE_FRAME_DELAY_MS));
}

function readUint32(bytes, offset) {
  return (
    ((bytes[offset] << 24) >>> 0) |
    (bytes[offset + 1] << 16) |
    (bytes[offset + 2] << 8) |
    bytes[offset + 3]
  ) >>> 0;
}

function writeUint32(bytes, offset, value) {
  bytes[offset] = (value >>> 24) & 0xff;
  bytes[offset + 1] = (value >>> 16) & 0xff;
  bytes[offset + 2] = (value >>> 8) & 0xff;
  bytes[offset + 3] = value & 0xff;
}

function writeUint16(bytes, offset, value) {
  bytes[offset] = (value >>> 8) & 0xff;
  bytes[offset + 1] = value & 0xff;
}

function createChunk(type, data) {
  const typeBytes = new Uint8Array([
    type.charCodeAt(0),
    type.charCodeAt(1),
    type.charCodeAt(2),
    type.charCodeAt(3),
  ]);
  const chunk = new Uint8Array(12 + data.length);

  writeUint32(chunk, 0, data.length);
  chunk.set(typeBytes, 4);
  chunk.set(data, 8);
  writeUint32(
    chunk,
    8 + data.length,
    UPNG.crc.crc(chunk, 4, data.length + 4) >>> 0,
  );

  return chunk;
}

function createAcTlChunk(frameCount) {
  const data = new Uint8Array(8);
  writeUint32(data, 0, frameCount);
  writeUint32(data, 4, 0);
  return createChunk("acTL", data);
}

function createFcTlChunk(width, height, delayMs) {
  const data = new Uint8Array(26);
  writeUint32(data, 0, 0);
  writeUint32(data, 4, width);
  writeUint32(data, 8, height);
  writeUint32(data, 12, 0);
  writeUint32(data, 16, 0);
  writeUint16(data, 20, clampDelay(delayMs));
  writeUint16(data, 22, 1000);
  data[24] = 0;
  data[25] = 0;
  return createChunk("fcTL", data);
}

function forceSingleFrameApng(pngBytes, width, height, delayMs) {
  if (!pngBytes?.length || pngBytes.length < PNG_SIGNATURE.length) {
    return pngBytes;
  }

  for (let index = 0; index < PNG_SIGNATURE.length; index += 1) {
    if (pngBytes[index] !== PNG_SIGNATURE[index]) {
      return pngBytes;
    }
  }

  const chunks = [PNG_SIGNATURE];
  const acTlChunk = createAcTlChunk(1);
  const fcTlChunk = createFcTlChunk(width, height, delayMs);
  let offset = PNG_SIGNATURE.length;
  let insertedAnimationHeader = false;
  let insertedFrameHeader = false;

  while (offset + 12 <= pngBytes.length) {
    const chunkLength = readUint32(pngBytes, offset);
    const chunkEnd = offset + 12 + chunkLength;
    const chunkType = String.fromCharCode(
      pngBytes[offset + 4],
      pngBytes[offset + 5],
      pngBytes[offset + 6],
      pngBytes[offset + 7],
    );
    const chunk = pngBytes.slice(offset, chunkEnd);

    chunks.push(chunk);
    if (chunkType === "IHDR" && !insertedAnimationHeader) {
      chunks.push(acTlChunk);
      insertedAnimationHeader = true;
    } else if (chunkType === "IDAT" && !insertedFrameHeader) {
      chunks.splice(chunks.length - 1, 0, fcTlChunk);
      insertedFrameHeader = true;
    }

    offset = chunkEnd;
    if (chunkType === "IEND") {
      break;
    }
  }

  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const output = new Uint8Array(totalLength);
  let outputOffset = 0;

  chunks.forEach((chunk) => {
    output.set(chunk, outputOffset);
    outputOffset += chunk.length;
  });

  return output;
}

export async function encodeApngCanvases(canvases, context = {}) {
  const sourceCanvases = Array.isArray(canvases) ? canvases.filter(Boolean) : [];
  if (!sourceCanvases.length) {
    throw new Error(context.writeError || "Transmute failed to encode the APNG output");
  }

  const width = Math.max(1, sourceCanvases[0].width || 1);
  const height = Math.max(1, sourceCanvases[0].height || 1);
  const rgbaFrames = sourceCanvases.map((canvas) =>
    getImageDataBuffer(createSizedCanvas(canvas, width, height), width, height),
  );
  const delays = rgbaFrames.length > 1
    ? rgbaFrames.map(() => clampDelay(context.options?.frameDelayMs))
    : undefined;

  try {
    const encodedBytes = new Uint8Array(
      UPNG.encode(rgbaFrames, width, height, 0, delays),
    );
    const outputBytes = rgbaFrames.length === 1
      ? forceSingleFrameApng(
          encodedBytes,
          width,
          height,
          context.options?.frameDelayMs,
        )
      : encodedBytes;

    return new Blob([outputBytes], { type: "image/apng" });
  } catch {
    throw new Error(context.writeError || "Transmute failed to encode the APNG output");
  }
}
