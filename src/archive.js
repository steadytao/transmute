// Copyright (c) 2026 Tao
// SPDX-License-Identifier: MPL-2.0
/* ZIP archive builder for bundled conversion outputs. */

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
    }
    table[index] = value >>> 0;
  }
  return table;
})();

function encodeUtf8(value) {
  return new TextEncoder().encode(String(value));
}

function sanitiseArchivePath(fileName, fallback = "file") {
  const cleaned = String(fileName || fallback)
    .replace(/\\/g, "/")
    .replace(/^\.+/, "")
    .replace(/\/{2,}/g, "/")
    .split("/")
    .filter(Boolean)
    .join("/");

  return cleaned || fallback;
}

function createDosDateParts(dateValue = new Date()) {
  const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
  const year = Math.max(1980, date.getFullYear());
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = Math.floor(date.getSeconds() / 2);

  return {
    time:
      ((hours & 0x1f) << 11) |
      ((minutes & 0x3f) << 5) |
      (seconds & 0x1f),
    date:
      (((year - 1980) & 0x7f) << 9) |
      ((month & 0x0f) << 5) |
      (day & 0x1f),
  };
}

function computeCrc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeUint16(view, offset, value) {
  view.setUint16(offset, value & 0xffff, true);
}

function writeUint32(view, offset, value) {
  view.setUint32(offset, value >>> 0, true);
}

function createLocalHeader(file, nameBytes, crc32, fileOffset) {
  const header = new Uint8Array(30 + nameBytes.length);
  const view = new DataView(header.buffer);
  const { time, date } = createDosDateParts(file.modifiedAt);

  writeUint32(view, 0, 0x04034b50);
  writeUint16(view, 4, 20);
  writeUint16(view, 6, 0x0800);
  writeUint16(view, 8, 0);
  writeUint16(view, 10, time);
  writeUint16(view, 12, date);
  writeUint32(view, 14, crc32);
  writeUint32(view, 18, file.bytes.length);
  writeUint32(view, 22, file.bytes.length);
  writeUint16(view, 26, nameBytes.length);
  writeUint16(view, 28, 0);
  header.set(nameBytes, 30);

  return {
    header,
    fileOffset,
    time,
    date,
  };
}

function createCentralHeader(file, nameBytes, crc32, localHeaderInfo) {
  const header = new Uint8Array(46 + nameBytes.length);
  const view = new DataView(header.buffer);

  writeUint32(view, 0, 0x02014b50);
  writeUint16(view, 4, 20);
  writeUint16(view, 6, 20);
  writeUint16(view, 8, 0x0800);
  writeUint16(view, 10, 0);
  writeUint16(view, 12, localHeaderInfo.time);
  writeUint16(view, 14, localHeaderInfo.date);
  writeUint32(view, 16, crc32);
  writeUint32(view, 20, file.bytes.length);
  writeUint32(view, 24, file.bytes.length);
  writeUint16(view, 28, nameBytes.length);
  writeUint16(view, 30, 0);
  writeUint16(view, 32, 0);
  writeUint16(view, 34, 0);
  writeUint16(view, 36, 0);
  writeUint32(view, 38, 0);
  writeUint32(view, 42, localHeaderInfo.fileOffset);
  header.set(nameBytes, 46);

  return header;
}

export async function createZipArchive(files, archiveName = "bundle.zip") {
  const preparedFiles = await Promise.all(
    (files || []).map(async (file, index) => {
      const blob = file?.blob;
      if (!(blob instanceof Blob)) {
        throw new Error("Archive items must provide a Blob");
      }

      const bytes = new Uint8Array(await blob.arrayBuffer());
      return {
        fileName: sanitiseArchivePath(file.fileName, `file-${index + 1}`),
        mimeType: file.mimeType || "",
        modifiedAt: file.modifiedAt || new Date(),
        bytes,
      };
    }),
  );

  const parts = [];
  const centralHeaders = [];
  let offset = 0;

  preparedFiles.forEach((file) => {
    const nameBytes = encodeUtf8(file.fileName);
    const crc32 = computeCrc32(file.bytes);
    const localHeaderInfo = createLocalHeader(file, nameBytes, crc32, offset);
    const centralHeader = createCentralHeader(
      file,
      nameBytes,
      crc32,
      localHeaderInfo,
    );

    parts.push(localHeaderInfo.header, file.bytes);
    centralHeaders.push(centralHeader);
    offset += localHeaderInfo.header.length + file.bytes.length;
  });

  const centralDirectoryOffset = offset;
  centralHeaders.forEach((header) => {
    parts.push(header);
    offset += header.length;
  });

  const centralDirectorySize = offset - centralDirectoryOffset;
  const endRecord = new Uint8Array(22);
  const endView = new DataView(endRecord.buffer);
  writeUint32(endView, 0, 0x06054b50);
  writeUint16(endView, 4, 0);
  writeUint16(endView, 6, 0);
  writeUint16(endView, 8, preparedFiles.length);
  writeUint16(endView, 10, preparedFiles.length);
  writeUint32(endView, 12, centralDirectorySize);
  writeUint32(endView, 16, centralDirectoryOffset);
  writeUint16(endView, 20, 0);
  parts.push(endRecord);

  return {
    blob: new Blob(parts, { type: "application/zip" }),
    fileName: sanitiseArchivePath(archiveName, "bundle.zip"),
    itemCount: preparedFiles.length,
  };
}
