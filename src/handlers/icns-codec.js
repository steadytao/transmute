// Copyright (c) 2026 Tao
// SPDX-License-Identifier: MPL-2.0
/* Apple ICNS container helpers. */

import { canvasToBlob, readRasterAsset } from "./raster.js";
import { readMagickBlob } from "../wasm/magick.js";

const PNG_SIGNATURE = Object.freeze([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);
const JPEG_2000_BOX_SIGNATURE = Object.freeze([
  0x00, 0x00, 0x00, 0x0c, 0x6a, 0x50, 0x20, 0x20, 0x0d, 0x0a, 0x87, 0x0a,
]);
const JPEG_2000_CODESTREAM_SIGNATURE = Object.freeze([
  0xff, 0x4f, 0xff, 0x51,
]);
const ICNS_PREFERRED_READ_TYPES = Object.freeze([
  "ic10",
  "ic14",
  "ic09",
  "ic13",
  "ic08",
  "ic07",
  "ic12",
  "icp6",
  "ic11",
  "icp5",
  "icp4",
]);
const ICNS_WRITE_TYPES = Object.freeze([
  { size: 64, type: "ic12" },
  { size: 128, type: "ic07" },
  { size: 256, type: "ic13" },
  { size: 256, type: "ic08" },
  { size: 512, type: "ic14" },
  { size: 512, type: "ic09" },
  { size: 1024, type: "ic10" },
  { size: 32, type: "ic11" },
  { size: 64, type: "icp6" },
  { size: 32, type: "icp5" },
  { size: 16, type: "icp4" },
]);

function matchesPrefix(bytes, signature) {
  if (!bytes?.length || signature.length > bytes.length) {
    return false;
  }

  return signature.every((value, index) => bytes[index] === value);
}

function readUint32BigEndian(bytes, offset) {
  return (
    ((bytes[offset] << 24) >>> 0) |
    (bytes[offset + 1] << 16) |
    (bytes[offset + 2] << 8) |
    bytes[offset + 3]
  ) >>> 0;
}

function writeUint32BigEndian(bytes, offset, value) {
  bytes[offset] = (value >>> 24) & 0xff;
  bytes[offset + 1] = (value >>> 16) & 0xff;
  bytes[offset + 2] = (value >>> 8) & 0xff;
  bytes[offset + 3] = value & 0xff;
}

function encodeAscii(value) {
  return new Uint8Array(
    [...String(value)].map((character) => character.charCodeAt(0)),
  );
}

function parseIcnsChunks(bytes) {
  if (bytes.length < 16 || !matchesPrefix(bytes, encodeAscii("icns"))) {
    return [];
  }

  const containerLength = readUint32BigEndian(bytes, 4);
  const safeLength = Math.min(bytes.length, containerLength || bytes.length);
  const chunks = [];
  let offset = 8;

  while (offset + 8 <= safeLength) {
    const type = String.fromCharCode(
      bytes[offset],
      bytes[offset + 1],
      bytes[offset + 2],
      bytes[offset + 3],
    );
    const length = readUint32BigEndian(bytes, offset + 4);
    if (length < 8 || offset + length > safeLength) {
      break;
    }

    chunks.push({
      type,
      data: bytes.slice(offset + 8, offset + length),
    });
    offset += length;
  }

  return chunks;
}

function identifyChunkMimeType(chunkBytes) {
  if (matchesPrefix(chunkBytes, PNG_SIGNATURE)) {
    return "image/png";
  }
  if (
    matchesPrefix(chunkBytes, JPEG_2000_BOX_SIGNATURE) ||
    matchesPrefix(chunkBytes, JPEG_2000_CODESTREAM_SIGNATURE)
  ) {
    return "image/jp2";
  }
  return "";
}

function selectPreferredIcnsChunk(chunks) {
  const rankedChunks = chunks
    .map((chunk) => ({
      ...chunk,
      mimeType: identifyChunkMimeType(chunk.data),
      rank: ICNS_PREFERRED_READ_TYPES.indexOf(chunk.type),
    }))
    .filter((chunk) => chunk.mimeType && chunk.rank !== -1)
    .sort((left, right) => left.rank - right.rank);

  return rankedChunks[0] || null;
}

function fitCanvasToSquare(canvas, size) {
  const fittedCanvas = document.createElement("canvas");
  fittedCanvas.width = size;
  fittedCanvas.height = size;

  const drawingContext = fittedCanvas.getContext("2d", { alpha: true });
  if (!drawingContext) {
    throw new Error("Canvas 2D is unavailable in this browser");
  }

  const scale = Math.min(size / canvas.width, size / canvas.height);
  const drawWidth = Math.max(1, Math.round(canvas.width * scale));
  const drawHeight = Math.max(1, Math.round(canvas.height * scale));
  const offsetX = Math.floor((size - drawWidth) / 2);
  const offsetY = Math.floor((size - drawHeight) / 2);

  drawingContext.clearRect(0, 0, size, size);
  drawingContext.drawImage(canvas, offsetX, offsetY, drawWidth, drawHeight);
  return fittedCanvas;
}

function buildIcnsChunk(type, payload) {
  const chunkBytes = new Uint8Array(8 + payload.length);
  chunkBytes.set(encodeAscii(type), 0);
  writeUint32BigEndian(chunkBytes, 4, chunkBytes.length);
  chunkBytes.set(payload, 8);
  return chunkBytes;
}

function buildIcnsHeader(totalLength) {
  const header = new Uint8Array(8);
  header.set(encodeAscii("icns"), 0);
  writeUint32BigEndian(header, 4, totalLength);
  return header;
}

function resolveWritableIcnsEntries(canvas) {
  const maxDimension = Math.max(canvas.width, canvas.height);
  const maxSize = Math.min(1024, Math.max(16, maxDimension));
  const entries = ICNS_WRITE_TYPES.filter((entry) => entry.size <= maxSize);
  return entries.length ? entries : [{ size: 16, type: "icp4" }];
}

export async function decodeIcnsBlob(blob, errorMessage = "") {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const selectedChunk = selectPreferredIcnsChunk(parseIcnsChunks(bytes));

  if (!selectedChunk) {
    throw new Error(errorMessage || "The uploaded ICNS image could not be decoded");
  }

  const chunkBlob = new Blob([selectedChunk.data], {
    type: selectedChunk.mimeType,
  });

  if (selectedChunk.mimeType === "image/png") {
    return readRasterAsset(chunkBlob, errorMessage);
  }

  return readMagickBlob(chunkBlob, { errorMessage });
}

export async function encodeIcnsCanvas(canvas, context = {}) {
  const chunkBytes = [];
  const pngCache = new Map();

  for (const entry of resolveWritableIcnsEntries(canvas)) {
    let pngBytes = pngCache.get(entry.size);

    if (!pngBytes) {
      const sizedCanvas = fitCanvasToSquare(canvas, entry.size);
      const pngBlob = await canvasToBlob(
        sizedCanvas,
        "image/png",
        undefined,
        context.writeError || "The browser failed to encode the PNG image for ICNS output",
      );
      pngBytes = new Uint8Array(await pngBlob.arrayBuffer());
      pngCache.set(entry.size, pngBytes);
    }

    chunkBytes.push(buildIcnsChunk(entry.type, pngBytes));
  }

  const totalLength = 8 + chunkBytes.reduce((sum, chunk) => sum + chunk.length, 0);
  return new Blob([buildIcnsHeader(totalLength), ...chunkBytes], {
    type: "image/icns",
  });
}
