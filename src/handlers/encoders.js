// Copyright (c) 2026 Tao
// SPDX-License-Identifier: MPL-2.0
/* Raster image output encoders. */

import { canvasToBlob } from "./raster.js";

const BMP_FILE_HEADER_SIZE = 14;
const BMP_DIB_HEADER_SIZE = 124;
const BMP_PIXEL_OFFSET = BMP_FILE_HEADER_SIZE + BMP_DIB_HEADER_SIZE;
const GIF_MAX_CODE_SIZE = 12;

function clampByte(value) {
  return Math.max(0, Math.min(255, Number(value) || 0));
}

function getCanvasImageData(canvas) {
  const context = canvas.getContext("2d", {
    alpha: true,
    willReadFrequently: true,
  });
  if (!context) {
    throw new Error("Canvas 2D is unavailable in this browser");
  }

  return context.getImageData(0, 0, canvas.width, canvas.height);
}

function getBaseName(sourceFileName) {
  return String(sourceFileName || "converted")
    .trim()
    .replace(/(\.[^.]+)?$/, "") || "converted";
}

function createBmpHeader(width, height, pixelDataSize) {
  const buffer = new ArrayBuffer(BMP_PIXEL_OFFSET);
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);

  bytes[0] = 0x42;
  bytes[1] = 0x4d;
  view.setUint32(2, BMP_PIXEL_OFFSET + pixelDataSize, true);
  view.setUint32(10, BMP_PIXEL_OFFSET, true);
  view.setUint32(14, BMP_DIB_HEADER_SIZE, true);
  view.setInt32(18, width, true);
  view.setInt32(22, -height, true);
  view.setUint16(26, 1, true);
  view.setUint16(28, 32, true);
  view.setUint32(30, 3, true);
  view.setUint32(34, pixelDataSize, true);
  view.setInt32(38, 2835, true);
  view.setInt32(42, 2835, true);
  view.setUint32(54, 0x00ff0000, true);
  view.setUint32(58, 0x0000ff00, true);
  view.setUint32(62, 0x000000ff, true);
  view.setUint32(66, 0xff000000, true);
  view.setUint32(70, 0x73524742, true);

  return bytes;
}

function buildBmpBytes(imageData) {
  const { width, height, data } = imageData;
  const pixelDataSize = width * height * 4;
  const header = createBmpHeader(width, height, pixelDataSize);
  const output = new Uint8Array(BMP_PIXEL_OFFSET + pixelDataSize);

  output.set(header, 0);

  let targetOffset = BMP_PIXEL_OFFSET;
  for (let sourceOffset = 0; sourceOffset < data.length; sourceOffset += 4) {
    output[targetOffset] = data[sourceOffset + 2];
    output[targetOffset + 1] = data[sourceOffset + 1];
    output[targetOffset + 2] = data[sourceOffset];
    output[targetOffset + 3] = data[sourceOffset + 3];
    targetOffset += 4;
  }

  return output;
}

function collectExactGifPalette(imageData) {
  const palette = [];
  const paletteIndexByColour = new Map();
  const indices = new Uint8Array(imageData.data.length / 4);
  let pixelIndex = 0;

  for (let offset = 0; offset < imageData.data.length; offset += 4) {
    const red = imageData.data[offset];
    const green = imageData.data[offset + 1];
    const blue = imageData.data[offset + 2];
    const key = (red << 16) | (green << 8) | blue;
    let paletteIndex = paletteIndexByColour.get(key);

    if (paletteIndex === undefined) {
      if (palette.length >= 256) {
        return null;
      }
      paletteIndex = palette.length;
      paletteIndexByColour.set(key, paletteIndex);
      palette.push([red, green, blue]);
    }

    indices[pixelIndex] = paletteIndex;
    pixelIndex += 1;
  }

  return { palette, indices };
}

function createUniformGifPalette() {
  const palette = [];
  for (let redBucket = 0; redBucket < 8; redBucket += 1) {
    for (let greenBucket = 0; greenBucket < 8; greenBucket += 1) {
      for (let blueBucket = 0; blueBucket < 4; blueBucket += 1) {
        palette.push([
          Math.round((redBucket * 255) / 7),
          Math.round((greenBucket * 255) / 7),
          Math.round((blueBucket * 255) / 3),
        ]);
      }
    }
  }
  return palette;
}

function quantiseGifPalette(imageData) {
  const exact = collectExactGifPalette(imageData);
  if (exact) {
    return exact;
  }

  const palette = createUniformGifPalette();
  const indices = new Uint8Array(imageData.data.length / 4);
  let pixelIndex = 0;

  for (let offset = 0; offset < imageData.data.length; offset += 4) {
    const red = imageData.data[offset] >> 5;
    const green = imageData.data[offset + 1] >> 5;
    const blue = imageData.data[offset + 2] >> 6;
    indices[pixelIndex] = (red << 5) | (green << 2) | blue;
    pixelIndex += 1;
  }

  return { palette, indices };
}

function padGifPalette(palette) {
  const size = Math.max(2, 2 ** Math.ceil(Math.log2(Math.max(2, palette.length))));
  const bytes = new Uint8Array(size * 3);

  palette.forEach(([red, green, blue], index) => {
    const offset = index * 3;
    bytes[offset] = clampByte(red);
    bytes[offset + 1] = clampByte(green);
    bytes[offset + 2] = clampByte(blue);
  });

  return {
    size,
    bytes,
  };
}

function lzwCompressGif(indices, minimumCodeSize) {
  const clearCode = 1 << minimumCodeSize;
  const endCode = clearCode + 1;
  const bytes = [];
  let dictionary = new Map();
  let nextCode = endCode + 1;
  let codeSize = minimumCodeSize + 1;
  let maxCode = (1 << codeSize) - 1;
  let bitBuffer = 0;
  let bitCount = 0;

  const flushCode = (code) => {
    bitBuffer |= code << bitCount;
    bitCount += codeSize;

    while (bitCount >= 8) {
      bytes.push(bitBuffer & 0xff);
      bitBuffer >>= 8;
      bitCount -= 8;
    }
  };

  const resetDictionary = () => {
    dictionary = new Map();
    nextCode = endCode + 1;
    codeSize = minimumCodeSize + 1;
    maxCode = (1 << codeSize) - 1;
  };

  flushCode(clearCode);
  resetDictionary();

  let prefixCode = indices[0];
  for (let index = 1; index < indices.length; index += 1) {
    const nextValue = indices[index];
    const key = `${prefixCode},${nextValue}`;

    if (dictionary.has(key)) {
      prefixCode = dictionary.get(key);
      continue;
    }

    flushCode(prefixCode);

    if (nextCode < 1 << GIF_MAX_CODE_SIZE) {
      dictionary.set(key, nextCode);
      nextCode += 1;
      if (nextCode > maxCode && codeSize < GIF_MAX_CODE_SIZE) {
        codeSize += 1;
        maxCode = (1 << codeSize) - 1;
      } else if (nextCode >= 1 << GIF_MAX_CODE_SIZE) {
        flushCode(clearCode);
        resetDictionary();
      }
    }

    prefixCode = nextValue;
  }

  flushCode(prefixCode);
  flushCode(endCode);

  if (bitCount > 0) {
    bytes.push(bitBuffer & 0xff);
  }

  return new Uint8Array(bytes);
}

function splitGifBlocks(bytes) {
  const blocks = [];
  for (let offset = 0; offset < bytes.length; offset += 255) {
    blocks.push(bytes.slice(offset, offset + 255));
  }
  return blocks;
}

function encodeGifBytes(imageData) {
  const { width, height } = imageData;
  const { palette, indices } = quantiseGifPalette(imageData);
  const { size: colourTableSize, bytes: colourTableBytes } = padGifPalette(palette);
  const minimumCodeSize = Math.max(2, Math.ceil(Math.log2(colourTableSize)));
  const compressed = lzwCompressGif(indices, minimumCodeSize);
  const imageBlocks = splitGifBlocks(compressed);
  const colourTableSizeField = Math.log2(colourTableSize) - 1;
  const output = [];

  const pushUint16 = (value) => {
    output.push(value & 0xff, (value >> 8) & 0xff);
  };

  output.push(
    0x47, 0x49, 0x46, 0x38, 0x39, 0x61,
  );
  pushUint16(width);
  pushUint16(height);
  output.push(0x80 | 0x70 | colourTableSizeField);
  output.push(0x00, 0x00);
  output.push(...colourTableBytes);
  output.push(0x2c);
  pushUint16(0);
  pushUint16(0);
  pushUint16(width);
  pushUint16(height);
  output.push(0x00);
  output.push(minimumCodeSize);
  imageBlocks.forEach((block) => {
    output.push(block.length);
    output.push(...block);
  });
  output.push(0x00, 0x3b);

  return new Uint8Array(output);
}

async function readBlobDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      resolve(String(reader.result || ""));
    }, { once: true });
    reader.addEventListener("error", () => {
      reject(new Error("Failed to read the encoded image data"));
    }, { once: true });
    reader.readAsDataURL(blob);
  });
}

export async function encodeBmpCanvas(canvas) {
  const imageData = getCanvasImageData(canvas);
  const bytes = buildBmpBytes(imageData);
  return new Blob([bytes], { type: "image/bmp" });
}

export async function encodeIcoCanvas(canvas, context = {}) {
  return encodeEmbeddedCursorCanvas(canvas, {
    writeError:
      context.writeError ||
      "The browser failed to encode the PNG image for ICO output",
    directoryType: 1,
    mimeType: "image/x-icon",
  });
}

function clampCursorHotspot(value) {
  return Math.max(0, Math.min(65535, Math.round(Number(value) || 0)));
}

async function encodeEmbeddedCursorCanvas(canvas, {
  writeError = "",
  directoryType = 1,
  mimeType = "",
  hotspotX = 0,
  hotspotY = 0,
} = {}) {
  const pngBlob = await canvasToBlob(
    canvas,
    "image/png",
    undefined,
    writeError,
  );
  const pngBytes = new Uint8Array(await pngBlob.arrayBuffer());
  const width = canvas.width >= 256 ? 0 : canvas.width;
  const height = canvas.height >= 256 ? 0 : canvas.height;
  const header = new Uint8Array(22);
  const view = new DataView(header.buffer);

  view.setUint16(0, 0, true);
  view.setUint16(2, directoryType, true);
  view.setUint16(4, 1, true);
  header[6] = width;
  header[7] = height;
  header[8] = 0;
  header[9] = 0;
  if (directoryType === 1) {
    view.setUint16(10, 1, true);
    view.setUint16(12, 32, true);
  } else {
    view.setUint16(10, clampCursorHotspot(hotspotX), true);
    view.setUint16(12, clampCursorHotspot(hotspotY), true);
  }
  view.setUint32(14, pngBytes.byteLength, true);
  view.setUint32(18, 22, true);

  return new Blob([header, pngBytes], { type: mimeType });
}

export async function encodeCurCanvas(canvas, context = {}) {
  return encodeEmbeddedCursorCanvas(canvas, {
    writeError:
      context.writeError ||
      "The browser failed to encode the PNG image for CUR output",
    directoryType: 2,
    mimeType: "image/x-win-bitmap-cursor",
    hotspotX: context.hotspotX,
    hotspotY: context.hotspotY,
  });
}

export async function encodeGifCanvas(canvas) {
  const imageData = getCanvasImageData(canvas);
  const bytes = encodeGifBytes(imageData);
  return new Blob([bytes], { type: "image/gif" });
}

export async function encodeSvgCanvas(canvas, context = {}) {
  const pngBlob = await canvasToBlob(
    canvas,
    "image/png",
    undefined,
    context.writeError || "The browser failed to encode the embedded PNG image for SVG output",
  );
  const dataUrl = await readBlobDataUrl(pngBlob);
  const width = Math.max(1, canvas.width);
  const height = Math.max(1, canvas.height);
  const svgMarkup = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<image width="${width}" height="${height}" href="${dataUrl}"/>`,
    `</svg>`,
  ].join("");

  return new Blob([svgMarkup], { type: "image/svg+xml" });
}
