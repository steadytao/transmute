// Copyright (c) 2026 Tao
// SPDX-License-Identifier: MPL-2.0
/* Shared KTX and KTX2 texture-container handler utilities. */

import {
  renderRasterFrameToCanvas,
  renderRasterToCanvas,
} from "./raster.js";

const KTX_IDENTIFIER = Object.freeze([
  0xab,
  0x4b,
  0x54,
  0x58,
  0x20,
  0x31,
  0x31,
  0xbb,
  0x0d,
  0x0a,
  0x1a,
  0x0a,
]);
const KTX_HEADER_BYTES = 64;
const KTX_ENDIANNESS = 0x04030201;
const GL_UNSIGNED_BYTE = 0x1401;
const GL_RGB = 0x1907;
const GL_RGBA = 0x1908;
const GL_BGRA = 0x80e1;
const GL_RGBA8 = 0x8058;

let ktx2ModulePromise = null;

function copyBytes(view) {
  return new Uint8Array(view.buffer.slice(
    view.byteOffset,
    view.byteOffset + view.byteLength,
  ));
}

function createCanvas(width, height) {
  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }

  if (typeof OffscreenCanvas === "function") {
    return new OffscreenCanvas(width, height);
  }

  throw new Error("Canvas 2D is unavailable in this browser");
}

function createRasterAssetFromRgbaBytes(rgbaBytes, width, height) {
  const canvas = createCanvas(width, height);
  const context = canvas.getContext("2d", {
    alpha: true,
    willReadFrequently: true,
  });
  if (!context) {
    throw new Error("Canvas 2D is unavailable in this browser");
  }

  const pixels = new Uint8ClampedArray(copyBytes(rgbaBytes).buffer);
  context.putImageData(new ImageData(pixels, width, height), 0, 0);

  return {
    kind: "raster-image",
    width,
    height,
    drawToContext(drawingContext) {
      drawingContext.drawImage(canvas, 0, 0);
    },
    release() {},
  };
}

function rgbToRgba(rgbBytes) {
  const pixelCount = Math.floor(rgbBytes.length / 3);
  const rgbaBytes = new Uint8Array(pixelCount * 4);

  for (let sourceOffset = 0, targetOffset = 0; sourceOffset < rgbBytes.length; sourceOffset += 3) {
    rgbaBytes[targetOffset] = rgbBytes[sourceOffset];
    rgbaBytes[targetOffset + 1] = rgbBytes[sourceOffset + 1];
    rgbaBytes[targetOffset + 2] = rgbBytes[sourceOffset + 2];
    rgbaBytes[targetOffset + 3] = 0xff;
    targetOffset += 4;
  }

  return rgbaBytes;
}

function bgraToRgba(bgraBytes) {
  const rgbaBytes = new Uint8Array(bgraBytes.length);

  for (let offset = 0; offset < bgraBytes.length; offset += 4) {
    rgbaBytes[offset] = bgraBytes[offset + 2];
    rgbaBytes[offset + 1] = bgraBytes[offset + 1];
    rgbaBytes[offset + 2] = bgraBytes[offset];
    rgbaBytes[offset + 3] = bgraBytes[offset + 3];
  }

  return rgbaBytes;
}

function normaliseKtxPixelBytes(pixelBytes, width, height, format, type, errorMessage) {
  const pixelCount = width * height;

  if (type !== GL_UNSIGNED_BYTE) {
    throw new Error(errorMessage);
  }

  if (format === GL_RGBA && pixelBytes.byteLength === pixelCount * 4) {
    return copyBytes(pixelBytes);
  }

  if (format === GL_BGRA && pixelBytes.byteLength === pixelCount * 4) {
    return bgraToRgba(pixelBytes);
  }

  if (format === GL_RGB && pixelBytes.byteLength === pixelCount * 3) {
    return rgbToRgba(pixelBytes);
  }

  throw new Error(errorMessage);
}

function renderTextureSource(intermediateAsset) {
  if (intermediateAsset.kind === "raster-frame-sequence") {
    const firstFrame = intermediateAsset.frames?.[0];
    if (!firstFrame) {
      throw new Error("The conversion source contains no frames");
    }

    return renderRasterFrameToCanvas(firstFrame, {
      alpha: true,
      clearCanvas: true,
    });
  }

  if (intermediateAsset.kind === "raster-image") {
    return renderRasterToCanvas(intermediateAsset, {
      alpha: true,
      clearCanvas: true,
    });
  }

  throw new Error("This handler expected a raster image intermediate");
}

function getCanvasImageBytes(canvas) {
  const context = canvas.getContext("2d", {
    alpha: true,
    willReadFrequently: true,
  });
  if (!context) {
    throw new Error("Canvas 2D is unavailable in this browser");
  }

  return context.getImageData(0, 0, canvas.width, canvas.height);
}

function buildKtxBytes(imageData) {
  const header = new ArrayBuffer(KTX_HEADER_BYTES);
  const headerBytes = new Uint8Array(header);
  headerBytes.set(KTX_IDENTIFIER, 0);

  const view = new DataView(header);
  view.setUint32(12, KTX_ENDIANNESS, true);
  view.setUint32(16, GL_UNSIGNED_BYTE, true);
  view.setUint32(20, 1, true);
  view.setUint32(24, GL_RGBA, true);
  view.setUint32(28, GL_RGBA8, true);
  view.setUint32(32, GL_RGBA, true);
  view.setUint32(36, imageData.width, true);
  view.setUint32(40, imageData.height, true);
  view.setUint32(44, 0, true);
  view.setUint32(48, 0, true);
  view.setUint32(52, 1, true);
  view.setUint32(56, 1, true);
  view.setUint32(60, 0, true);

  const imageSizeBuffer = new ArrayBuffer(4);
  new DataView(imageSizeBuffer).setUint32(0, imageData.data.byteLength, true);

  return new Blob(
    [header, imageSizeBuffer, copyBytes(imageData.data)],
    { type: "image/ktx" },
  );
}

async function loadKtx2Module() {
  if (!ktx2ModulePromise) {
    ktx2ModulePromise = import("../../vendor/ktx-parse/index.js");
  }

  return ktx2ModulePromise;
}

function buildKtx2Container(module, imageData) {
  const container = module.createDefaultContainer();
  const dfd = container.dataFormatDescriptor[0];

  container.vkFormat = module.VK_FORMAT_R8G8B8A8_UNORM;
  container.typeSize = 1;
  container.pixelWidth = imageData.width;
  container.pixelHeight = imageData.height;
  container.pixelDepth = 0;
  container.layerCount = 0;
  container.faceCount = 1;
  container.levelCount = 1;
  container.supercompressionScheme = module.KHR_SUPERCOMPRESSION_NONE;
  container.levels = [
    {
      levelData: copyBytes(imageData.data),
      uncompressedByteLength: imageData.data.byteLength,
    },
  ];

  dfd.colorModel = module.KHR_DF_MODEL_RGBSDA;
  dfd.transferFunction = module.KHR_DF_TRANSFER_SRGB;
  dfd.flags = module.KHR_DF_FLAG_ALPHA_STRAIGHT;
  dfd.texelBlockDimension = [0, 0, 0, 0];
  dfd.bytesPlane = [4, 0, 0, 0, 0, 0, 0, 0];
  dfd.samples = [
    {
      bitOffset: 0,
      bitLength: 7,
      channelType: module.KHR_DF_CHANNEL_RGBSDA_RED,
      samplePosition: [0, 0, 0, 0],
      sampleLower: 0,
      sampleUpper: 255,
    },
    {
      bitOffset: 8,
      bitLength: 7,
      channelType: module.KHR_DF_CHANNEL_RGBSDA_GREEN,
      samplePosition: [0, 0, 0, 0],
      sampleLower: 0,
      sampleUpper: 255,
    },
    {
      bitOffset: 16,
      bitLength: 7,
      channelType: module.KHR_DF_CHANNEL_RGBSDA_BLUE,
      samplePosition: [0, 0, 0, 0],
      sampleLower: 0,
      sampleUpper: 255,
    },
    {
      bitOffset: 24,
      bitLength: 7,
      channelType: module.KHR_DF_CHANNEL_RGBSDA_ALPHA,
      samplePosition: [0, 0, 0, 0],
      sampleLower: 0,
      sampleUpper: 255,
    },
  ];

  return container;
}

async function buildKtx2Bytes(imageData) {
  const module = await loadKtx2Module();
  const container = buildKtx2Container(module, imageData);
  return new Blob([module.write(container)], { type: "image/ktx2" });
}

async function decodeKtxBlob(blob, errorMessage) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (bytes.byteLength < KTX_HEADER_BYTES) {
    throw new Error(errorMessage);
  }

  for (let index = 0; index < KTX_IDENTIFIER.length; index += 1) {
    if (bytes[index] !== KTX_IDENTIFIER[index]) {
      throw new Error(errorMessage);
    }
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const littleEndian = view.getUint32(12, true) === KTX_ENDIANNESS;
  if (!littleEndian && view.getUint32(12, false) !== KTX_ENDIANNESS) {
    throw new Error(errorMessage);
  }
  const glType = view.getUint32(16, littleEndian);
  const glFormat = view.getUint32(24, littleEndian);
  const pixelWidth = view.getUint32(36, littleEndian);
  const pixelHeight = view.getUint32(40, littleEndian);
  const pixelDepth = view.getUint32(44, littleEndian);
  const arrayElementCount = view.getUint32(48, littleEndian);
  const faceCount = view.getUint32(52, littleEndian);
  const bytesOfKeyValueData = view.getUint32(60, littleEndian);

  if (
    !pixelWidth ||
    !pixelHeight ||
    pixelDepth > 0 ||
    arrayElementCount > 0 ||
    faceCount !== 1
  ) {
    throw new Error(errorMessage);
  }

  const imageSizeOffset = KTX_HEADER_BYTES + bytesOfKeyValueData;
  if (imageSizeOffset + 4 > bytes.byteLength) {
    throw new Error(errorMessage);
  }

  const imageSize = view.getUint32(imageSizeOffset, littleEndian);
  const imageDataOffset = imageSizeOffset + 4;
  if (imageDataOffset + imageSize > bytes.byteLength) {
    throw new Error(errorMessage);
  }

  const pixelBytes = bytes.subarray(imageDataOffset, imageDataOffset + imageSize);
  const rgbaBytes = normaliseKtxPixelBytes(
    pixelBytes,
    pixelWidth,
    pixelHeight,
    glFormat,
    glType,
    errorMessage,
  );

  return createRasterAssetFromRgbaBytes(rgbaBytes, pixelWidth, pixelHeight);
}

function normaliseKtx2PixelBytes(module, container, errorMessage) {
  const level = container.levels?.[0];
  if (!level?.levelData?.byteLength || !container.pixelWidth || !container.pixelHeight) {
    throw new Error(errorMessage);
  }

  const pixelCount = container.pixelWidth * container.pixelHeight;
  const format = container.vkFormat;

  if (
    format === module.VK_FORMAT_R8G8B8A8_UNORM ||
    format === module.VK_FORMAT_R8G8B8A8_SRGB
  ) {
    if (level.levelData.byteLength !== pixelCount * 4) {
      throw new Error(errorMessage);
    }
    return copyBytes(level.levelData);
  }

  if (
    format === module.VK_FORMAT_B8G8R8A8_UNORM ||
    format === module.VK_FORMAT_B8G8R8A8_SRGB
  ) {
    if (level.levelData.byteLength !== pixelCount * 4) {
      throw new Error(errorMessage);
    }
    return bgraToRgba(level.levelData);
  }

  if (
    format === module.VK_FORMAT_R8G8B8_UNORM ||
    format === module.VK_FORMAT_R8G8B8_SRGB
  ) {
    if (level.levelData.byteLength !== pixelCount * 3) {
      throw new Error(errorMessage);
    }
    return rgbToRgba(level.levelData);
  }

  if (
    format === module.VK_FORMAT_B8G8R8_UNORM ||
    format === module.VK_FORMAT_B8G8R8_SRGB
  ) {
    if (level.levelData.byteLength !== pixelCount * 3) {
      throw new Error(errorMessage);
    }

    const rgbaBytes = new Uint8Array(pixelCount * 4);
    for (let sourceOffset = 0, targetOffset = 0; sourceOffset < level.levelData.length; sourceOffset += 3) {
      rgbaBytes[targetOffset] = level.levelData[sourceOffset + 2];
      rgbaBytes[targetOffset + 1] = level.levelData[sourceOffset + 1];
      rgbaBytes[targetOffset + 2] = level.levelData[sourceOffset];
      rgbaBytes[targetOffset + 3] = 0xff;
      targetOffset += 4;
    }
    return rgbaBytes;
  }

  throw new Error(errorMessage);
}

async function decodeKtx2Blob(blob, errorMessage) {
  const module = await loadKtx2Module();
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const container = module.read(bytes);

  if (
    container.pixelDepth > 0 ||
    container.layerCount > 0 ||
    container.faceCount !== 1 ||
    container.supercompressionScheme !== module.KHR_SUPERCOMPRESSION_NONE
  ) {
    throw new Error(errorMessage);
  }

  const rgbaBytes = normaliseKtx2PixelBytes(module, container, errorMessage);
  return createRasterAssetFromRgbaBytes(
    rgbaBytes,
    container.pixelWidth,
    container.pixelHeight,
  );
}

export function createTextureContainerHandler({
  id,
  label,
  formatId,
  variant,
  readError,
  writeError,
}) {
  const mimeType = variant === "ktx2" ? "image/ktx2" : "image/ktx";

  return Object.freeze({
    id,
    label,
    formatId,
    produces: Object.freeze(["raster-image"]),
    consumes: Object.freeze(["raster-image", "raster-frame-sequence"]),
    async read(asset) {
      try {
        const decodedAsset = variant === "ktx2"
          ? await decodeKtx2Blob(asset.blob, readError)
          : await decodeKtxBlob(asset.blob, readError);

        return {
          ...decodedAsset,
          sourceFileName: asset.fileName,
        };
      } catch {
        throw new Error(readError);
      }
    },
    async write(intermediateAsset, context) {
      try {
        const canvas = renderTextureSource(intermediateAsset);
        const imageData = getCanvasImageBytes(canvas);
        const outputBlob = variant === "ktx2"
          ? await buildKtx2Bytes(imageData)
          : buildKtxBytes(imageData);

        return {
          kind: "file",
          blob: outputBlob,
          fileName: context.buildOutputFileName(
            intermediateAsset.sourceFileName || "converted",
            context.targetFormat.extensions[0],
          ),
          fileSize: outputBlob.size,
          mimeType,
          formatId: context.targetFormat.id,
        };
      } catch {
        throw new Error(writeError);
      } finally {
        intermediateAsset.release?.();
      }
    },
  });
}
