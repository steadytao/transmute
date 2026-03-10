// Copyright (c) 2026 Tao
// SPDX-License-Identifier: MPL-2.0
/* Output normalisation for file and archive conversion results. */

import { createZipArchive } from "./archive.js";

function createFileOutput(asset) {
  return Object.freeze({
    kind: "file",
    blob: asset.blob,
    fileName: asset.fileName,
    fileSize: Number(asset.fileSize) || asset.blob?.size || 0,
    mimeType: asset.mimeType || asset.blob?.type || "",
    formatId: asset.formatId || "",
    label: asset.label || "",
    previewable: String(asset.mimeType || asset.blob?.type || "").startsWith("image/"),
    itemCount: 1,
  });
}

async function createArchiveOutput(asset, fallbackLabel = "Bundle") {
  const items = (asset.items || []).map((item, index) => ({
    blob: item.blob,
    fileName: item.fileName || `item-${index + 1}`,
    fileSize: Number(item.fileSize) || item.blob?.size || 0,
    mimeType: item.mimeType || item.blob?.type || "",
    formatId: item.formatId || "",
    modifiedAt: item.modifiedAt || new Date(),
  }));

  const archive = await createZipArchive(
    items,
    asset.fileName || "converted-output.zip",
  );

  return Object.freeze({
    kind: "archive",
    blob: archive.blob,
    fileName: archive.fileName,
    fileSize: archive.blob.size,
    mimeType: "application/zip",
    formatId: asset.formatId || "",
    label: asset.label || fallbackLabel,
    previewable: false,
    itemCount: archive.itemCount,
    items: Object.freeze(items),
  });
}

export async function normaliseOutputAsset(asset, fallbackLabel = "File") {
  if (!asset) {
    throw new Error("The conversion returned no output asset");
  }

  if (asset.kind === "file" && asset.blob instanceof Blob) {
    return createFileOutput(asset);
  }

  if (asset.kind === "archive" && asset.blob instanceof Blob) {
    return Object.freeze({
      ...asset,
      previewable: false,
      itemCount: Number(asset.itemCount) || asset.items?.length || 0,
    });
  }

  if (Array.isArray(asset.items) && asset.items.length) {
    return createArchiveOutput(asset, fallbackLabel);
  }

  if (asset.blob instanceof Blob) {
    return createFileOutput(asset);
  }

  throw new Error("The conversion returned an unsupported output asset");
}
