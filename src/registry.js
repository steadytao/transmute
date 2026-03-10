// Copyright (c) 2026 Tao
// SPDX-License-Identifier: MPL-2.0
/* Transmute routing, catalogue, and normalisation registry. */

import { normaliseOutputAsset } from "./output.js";

function normaliseExtension(value = "") {
  const trimmed = String(value).trim().toLowerCase();
  if (!trimmed) return "";
  return trimmed.startsWith(".") ? trimmed : `.${trimmed}`;
}

function extractExtension(fileName = "") {
  const match = String(fileName).trim().toLowerCase().match(/(\.[^.]+)$/);
  return match ? match[1] : "";
}

function normaliseMimeType(value = "") {
  return String(value).trim().toLowerCase();
}

function guessMediaKind(mimeType = "", extension = "") {
  const normalisedMimeType = normaliseMimeType(mimeType);
  const normalisedExtension = normaliseExtension(extension);

  if (normalisedMimeType.startsWith("image/")) return "image";
  if (normalisedMimeType.startsWith("audio/")) return "audio";
  if (normalisedMimeType.startsWith("video/")) return "video";
  if (
    normalisedMimeType.startsWith("text/") ||
    normalisedMimeType.includes("xml") ||
    normalisedMimeType.includes("json")
  ) {
    return "text";
  }

  if (
    [
      ".apng",
      ".png",
      ".jpg",
      ".jpeg",
      ".webp",
      ".svg",
      ".gif",
      ".bmp",
      ".tif",
      ".tiff",
      ".tga",
      ".icb",
      ".vda",
      ".vst",
      ".ico",
      ".icns",
      ".avif",
      ".heic",
      ".heics",
      ".heif",
      ".heifs",
      ".hif",
      ".jxl",
      ".jp2",
      ".j2k",
      ".jpx",
      ".jpm",
      ".mj2",
      ".jxr",
      ".wdp",
      ".hdp",
      ".cur",
      ".bpg",
      ".qoi",
      ".dds",
      ".exr",
      ".hdr",
      ".rgbe",
      ".psd",
      ".psb",
      ".ktx",
      ".ktx2",
      ".pbm",
      ".pgm",
      ".ppm",
      ".pam",
      ".mng",
    ].includes(normalisedExtension)
  ) {
    return "image";
  }

  return "binary";
}

function guessFallbackLabel(file, extension) {
  if (file.type) {
    const subtype = file.type.split("/")[1] || file.type;
    return subtype.replace(/^x-/, "").replace(/[.+-]+/g, " ").toUpperCase();
  }
  if (extension) {
    return extension.slice(1).toUpperCase();
  }
  return "Unknown";
}

function buildOutputFileName(inputName, extension) {
  const normalisedExtension = normaliseExtension(extension);
  const baseName = String(inputName || "converted")
    .trim()
    .replace(/(\.[^.]+)?$/, "");
  return `${baseName || "converted"}${normalisedExtension}`;
}

function createNodeKey(nodeType, nodeId) {
  return `${nodeType}:${nodeId}`;
}

function parseNodeKey(nodeKey) {
  const splitAt = nodeKey.indexOf(":");
  return {
    type: nodeKey.slice(0, splitAt),
    id: nodeKey.slice(splitAt + 1),
  };
}

function compareTargetPlans(left, right) {
  if (left.totalSteps !== right.totalSteps) {
    return left.totalSteps - right.totalSteps;
  }
  if (Boolean(left.normalisation) !== Boolean(right.normalisation)) {
    return left.normalisation ? 1 : -1;
  }
  if ((left.optionOrder || 10_000) !== (right.optionOrder || 10_000)) {
    return (left.optionOrder || 10_000) - (right.optionOrder || 10_000);
  }
  if (left.catalogueIndex !== right.catalogueIndex) {
    return left.catalogueIndex - right.catalogueIndex;
  }
  return left.label.localeCompare(right.label);
}

const FILE_DETECTION_PREVIEW_BYTES = 1024;
const FILE_HEX_PREVIEW_BYTES = 12;

function matchesBytesAtOffset(bytes, signatureBytes, offset = 0) {
  if (
    !bytes?.length ||
    !signatureBytes?.length ||
    offset + signatureBytes.length > bytes.length
  ) {
    return false;
  }

  return signatureBytes.every(
    (value, index) => bytes[offset + index] === value,
  );
}

function matchesBytesAtSuffix(bytes, signatureBytes) {
  if (!bytes?.length || !signatureBytes?.length || signatureBytes.length > bytes.length) {
    return false;
  }

  return matchesBytesAtOffset(
    bytes,
    signatureBytes,
    bytes.length - signatureBytes.length,
  );
}

function findPngChunk(bytes, chunkName = "") {
  if (!bytes?.length || bytes.length < 16) {
    return false;
  }

  const normalisedChunkName = String(chunkName).trim();
  if (!normalisedChunkName || normalisedChunkName.length !== 4) {
    return false;
  }

  const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (!matchesBytesAtOffset(bytes, pngSignature, 0)) {
    return false;
  }

  let offset = 8;
  while (offset + 8 <= bytes.length) {
    const chunkLength =
      ((bytes[offset] << 24) >>> 0) |
      (bytes[offset + 1] << 16) |
      (bytes[offset + 2] << 8) |
      bytes[offset + 3];
    const chunkType = String.fromCharCode(
      bytes[offset + 4],
      bytes[offset + 5],
      bytes[offset + 6],
      bytes[offset + 7],
    );
    if (chunkType === normalisedChunkName) {
      return true;
    }
    offset += 12 + chunkLength;
    if (chunkType === "IEND") {
      return false;
    }
  }

  return false;
}

function normaliseTextPreview(value = "") {
  return String(value).replace(/^\ufeff/, "").trimStart().toLowerCase();
}

function matchesSignature(bytes, signature, textPreview = "") {
  if (!signature) {
    return false;
  }

  if (Array.isArray(signature)) {
    return matchesBytesAtOffset(bytes, signature, 0);
  }

  switch (signature.type) {
    case "prefix":
      return matchesBytesAtOffset(bytes, signature.bytes, 0);
    case "marker":
      return matchesBytesAtOffset(bytes, signature.bytes, signature.offset || 0);
    case "suffix":
      return matchesBytesAtSuffix(bytes, signature.bytes);
    case "compound":
      return (signature.markers || []).every((marker) =>
        matchesBytesAtOffset(bytes, marker.bytes, marker.offset || 0),
      );
    case "text":
      return (signature.snippets || []).some((snippet) =>
        textPreview.includes(snippet),
      );
    case "png-chunk":
      return findPngChunk(bytes, signature.chunkName);
    default:
      return false;
  }
}

function formatHexPreview(bytes, fileSize = 0) {
  if (!bytes?.length) {
    return "Unavailable";
  }

  const preview = [...bytes.slice(0, FILE_HEX_PREVIEW_BYTES)].map((value) =>
    value.toString(16).padStart(2, "0").toUpperCase(),
  );
  if (fileSize > bytes.length) {
    preview.push("...");
  }
  return preview.join(" ");
}

async function readSignatureBytes(file, byteCount = FILE_DETECTION_PREVIEW_BYTES) {
  if (!file || typeof file.slice !== "function") {
    return new Uint8Array();
  }

  try {
    const buffer = await file.slice(0, byteCount).arrayBuffer();
    return new Uint8Array(buffer);
  } catch {
    return new Uint8Array();
  }
}

function decodeTextPreview(signatureBytes) {
  if (!signatureBytes?.length) {
    return "";
  }

  try {
    return normaliseTextPreview(new TextDecoder("utf-8").decode(signatureBytes));
  } catch {
    return "";
  }
}

function freezeBrowserHints(browser = {}) {
  return Object.freeze({
    decodable: Boolean(browser.decodable),
    previewable: Boolean(browser.previewable),
    renderNormalisable: Boolean(browser.renderNormalisable),
  });
}

function freezeTraits(traits = {}) {
  return Object.freeze({
    supportsTransparency: Boolean(traits.supportsTransparency),
    lossy: Boolean(traits.lossy),
    vector: Boolean(traits.vector),
    animated: Boolean(traits.animated),
    multiImage: Boolean(traits.multiImage),
  });
}

function dedupeAdvisories(values) {
  return [...new Set(values.filter(Boolean))];
}

export class TransmuteRegistry {
  constructor() {
    this.formats = new Map();
    this.kinds = new Map();
    this.mimeToFormatId = new Map();
    this.extensionToFormatId = new Map();
    this.handlers = new Map();
    this.handlersByFormatId = new Map();
    this.loadedHandlers = new Map();
    this.normalisers = new Map();
    this.loadedNormalisers = new Map();
    this.formatOrder = 0;
    this.handlerOrder = 0;
    this.normaliserOrder = 0;
  }

  registerFormat(format) {
    if (!format?.id || !format?.label) {
      throw new Error("Each format requires an id and label");
    }

    const normalisedMimeType = normaliseMimeType(format.mimeType);
    const normalisedFormat = Object.freeze({
      id: format.id,
      label: format.label,
      mimeType: normalisedMimeType,
      mimeAliases: Object.freeze(
        (format.mimeAliases || [])
          .map((alias) => normaliseMimeType(alias))
          .filter(Boolean),
      ),
      mediaKind:
        format.mediaKind || guessMediaKind(normalisedMimeType, format.extensions?.[0]),
      family: format.family || "",
      optionOrder: Number(format.optionOrder) || 10_000,
      catalogueIndex: this.formatOrder,
      extensions: Object.freeze(
        (format.extensions || []).map((extension) => normaliseExtension(extension)),
      ),
      signatures: Object.freeze([...(format.signatures || [])]),
      browser: freezeBrowserHints(format.browser),
      traits: freezeTraits(format.traits),
    });

    this.formatOrder += 1;
    this.formats.set(normalisedFormat.id, normalisedFormat);

    [normalisedFormat.mimeType, ...normalisedFormat.mimeAliases]
      .filter(Boolean)
      .forEach((mimeType) => {
        this.mimeToFormatId.set(mimeType, normalisedFormat.id);
      });

    normalisedFormat.extensions.forEach((extension) => {
      this.extensionToFormatId.set(extension, normalisedFormat.id);
    });

    return this;
  }

  registerKind(kind) {
    if (!kind?.id || !kind?.label) {
      throw new Error("Each intermediate kind requires an id and label");
    }

    this.kinds.set(
      kind.id,
      Object.freeze({
        id: kind.id,
        label: kind.label,
      }),
    );

    return this;
  }

  registerHandler(handler) {
    if (!handler?.id || !handler?.formatId) {
      throw new Error("Each handler requires an id and formatId");
    }
    if (!this.formats.has(handler.formatId)) {
      throw new Error(`Unknown handler format: ${handler.formatId}`);
    }

    const normalisedHandler = Object.freeze({
      id: handler.id,
      label: handler.label || handler.id,
      formatId: handler.formatId,
      handlerIndex: this.handlerOrder,
      produces: Object.freeze([...(handler.produces || [])]),
      consumes: Object.freeze([...(handler.consumes || [])]),
      sequenceWriteMode: handler.sequenceWriteMode || "",
      read: typeof handler.read === "function" ? handler.read : null,
      write: typeof handler.write === "function" ? handler.write : null,
      load: typeof handler.load === "function" ? handler.load : null,
    });

    this.handlerOrder += 1;

    normalisedHandler.produces.forEach((kindId) => {
      if (!this.kinds.has(kindId)) {
        throw new Error(`Unknown produced kind: ${kindId}`);
      }
    });
    normalisedHandler.consumes.forEach((kindId) => {
      if (!this.kinds.has(kindId)) {
        throw new Error(`Unknown consumed kind: ${kindId}`);
      }
    });

    if (
      normalisedHandler.produces.length &&
      !normalisedHandler.read &&
      !normalisedHandler.load
    ) {
      throw new Error(`Handler ${normalisedHandler.id} must implement read() or load()`);
    }
    if (
      normalisedHandler.consumes.length &&
      !normalisedHandler.write &&
      !normalisedHandler.load
    ) {
      throw new Error(`Handler ${normalisedHandler.id} must implement write() or load()`);
    }

    this.handlers.set(normalisedHandler.id, normalisedHandler);
    this.handlersByFormatId.set(normalisedHandler.formatId, normalisedHandler);
    return this;
  }

  registerNormaliser(normaliser) {
    if (!normaliser?.id || !normaliser?.outputs?.length) {
      throw new Error("Each normaliser requires an id and at least one output");
    }

    const outputs = Object.freeze(
      normaliser.outputs.map((output) => {
        if (!output?.formatId || !this.formats.has(output.formatId)) {
          throw new Error(`Unknown normaliser output format: ${output?.formatId || "missing"}`);
        }

        return Object.freeze({
          formatId: output.formatId,
          label: output.label || this.getFormat(output.formatId)?.label || output.formatId,
          mode: output.mode || normaliser.mode || "",
          lossProfile: output.lossProfile || normaliser.lossProfile || "",
          explanation: output.explanation || normaliser.explanation || "",
        });
      }),
    );

    const normalisedNormaliser = Object.freeze({
      id: normaliser.id,
      label: normaliser.label || normaliser.id,
      normaliserIndex: this.normaliserOrder,
      mediaKinds: Object.freeze([...(normaliser.mediaKinds || [])]),
      formatIds: Object.freeze([...(normaliser.formatIds || [])]),
      mimePrefixes: Object.freeze(
        (normaliser.mimePrefixes || []).map((prefix) =>
          normaliseMimeType(prefix),
        ),
      ),
      extensions: Object.freeze(
        (normaliser.extensions || []).map((extension) =>
          normaliseExtension(extension),
        ),
      ),
      requiresBrowserRenderable: Boolean(normaliser.requiresBrowserRenderable),
      whenUnknownOnly: Boolean(normaliser.whenUnknownOnly),
      outputs,
      normalise:
        typeof normaliser.normalise === "function" ? normaliser.normalise : null,
      load: typeof normaliser.load === "function" ? normaliser.load : null,
    });

    this.normaliserOrder += 1;

    if (!normalisedNormaliser.normalise && !normalisedNormaliser.load) {
      throw new Error(`Normaliser ${normalisedNormaliser.id} must implement normalise() or load()`);
    }

    this.normalisers.set(normalisedNormaliser.id, normalisedNormaliser);
    return this;
  }

  getFormat(formatId) {
    return this.formats.get(formatId) || null;
  }

  getKind(kindId) {
    return this.kinds.get(kindId) || null;
  }

  getHandlerByFormatId(formatId) {
    return this.handlersByFormatId.get(formatId) || null;
  }

  async resolveHandler(handler) {
    if (!handler) {
      return null;
    }

    if (handler.read || handler.write) {
      return handler;
    }

    if (!handler.load) {
      throw new Error(`Handler ${handler.id} has no implementation loader`);
    }

    if (this.loadedHandlers.has(handler.id)) {
      return this.loadedHandlers.get(handler.id);
    }

    const loadedHandler = await handler.load();
    if (!loadedHandler?.id || loadedHandler.id !== handler.id) {
      throw new Error(`Handler loader mismatch for ${handler.id}.`);
    }

    const resolvedHandler = Object.freeze({
      ...handler,
      ...loadedHandler,
      produces: Object.freeze([...(loadedHandler.produces || handler.produces || [])]),
      consumes: Object.freeze([...(loadedHandler.consumes || handler.consumes || [])]),
      sequenceWriteMode:
        loadedHandler.sequenceWriteMode || handler.sequenceWriteMode || "",
      read: typeof loadedHandler.read === "function" ? loadedHandler.read : null,
      write: typeof loadedHandler.write === "function" ? loadedHandler.write : null,
      load: handler.load,
    });

    this.loadedHandlers.set(handler.id, resolvedHandler);
    return resolvedHandler;
  }

  async resolveNormaliser(normaliser) {
    if (!normaliser) {
      return null;
    }

    if (normaliser.normalise) {
      return normaliser;
    }

    if (!normaliser.load) {
      throw new Error(`Normaliser ${normaliser.id} has no implementation loader`);
    }

    if (this.loadedNormalisers.has(normaliser.id)) {
      return this.loadedNormalisers.get(normaliser.id);
    }

    const loadedNormaliser = await normaliser.load();
    if (!loadedNormaliser?.id || loadedNormaliser.id !== normaliser.id) {
      throw new Error(`Normaliser loader mismatch for ${normaliser.id}.`);
    }

    const resolvedNormaliser = Object.freeze({
      ...normaliser,
      ...loadedNormaliser,
      outputs: normaliser.outputs,
      normalise:
        typeof loadedNormaliser.normalise === "function"
          ? loadedNormaliser.normalise
          : normaliser.normalise,
      load: normaliser.load,
    });

    this.loadedNormalisers.set(normaliser.id, resolvedNormaliser);
    return resolvedNormaliser;
  }

  getNodeLabel(node) {
    if (!node) return "";
    if (node.type === "format") {
      return this.getFormat(node.id)?.label || node.id;
    }
    if (node.type === "kind") {
      return this.getKind(node.id)?.label || node.id;
    }
    return node.id;
  }

  getOutgoingSteps(nodeKey) {
    const node = parseNodeKey(nodeKey);

    if (node.type === "format") {
      const handler = this.getHandlerByFormatId(node.id);
      if (!handler) {
        return [];
      }

      return handler.produces.map((kindId) => ({
        operation: "read",
        handler,
        fromNode: { type: "format", id: handler.formatId },
        toNode: { type: "kind", id: kindId },
      }));
    }

    if (node.type === "kind") {
      return [...this.handlers.values()]
        .filter((handler) => handler.consumes.includes(node.id))
        .sort((left, right) => {
          if (left.handlerIndex !== right.handlerIndex) {
            return left.handlerIndex - right.handlerIndex;
          }
          return left.label.localeCompare(right.label);
        })
        .map((handler) => ({
          operation: "write",
          handler,
          fromNode: { type: "kind", id: node.id },
          toNode: { type: "format", id: handler.formatId },
        }));
    }

    return [];
  }

  findRoute(sourceFormatId, targetFormatId) {
    if (!sourceFormatId || !targetFormatId) {
      return null;
    }
    if (sourceFormatId === targetFormatId) {
      return [];
    }

    const sourceKey = createNodeKey("format", sourceFormatId);
    const targetKey = createNodeKey("format", targetFormatId);
    const queue = [{ nodeKey: sourceKey, route: [] }];
    const visited = new Set([sourceKey]);

    while (queue.length) {
      const current = queue.shift();
      const outgoingSteps = this.getOutgoingSteps(current.nodeKey);

      for (const step of outgoingSteps) {
        const nextNodeKey = createNodeKey(step.toNode.type, step.toNode.id);
        const nextRoute = current.route.concat(step);
        if (nextNodeKey === targetKey) {
          return nextRoute;
        }
        if (!visited.has(nextNodeKey)) {
          visited.add(nextNodeKey);
          queue.push({ nodeKey: nextNodeKey, route: nextRoute });
        }
      }
    }

    return null;
  }

  getFormatIdFromSignature(signatureBytes, textPreview = "") {
    if (!signatureBytes?.length) {
      return null;
    }

    for (const format of this.formats.values()) {
      if (
        format.signatures.some((signature) =>
          matchesSignature(signatureBytes, signature, textPreview),
        )
      ) {
        return format.id;
      }
    }

    return null;
  }

  getFormatIdFromMime(mimeType = "") {
    const normalisedMimeType = normaliseMimeType(mimeType);
    if (!normalisedMimeType) {
      return null;
    }
    return this.mimeToFormatId.get(normalisedMimeType) || null;
  }

  buildDirectTargetPlans(sourceFormatId) {
    if (!sourceFormatId || !this.formats.has(sourceFormatId)) {
      return [];
    }

    return [...this.formats.values()]
      .filter((format) => format.id !== sourceFormatId)
      .map((format) => {
        const route = this.findRoute(sourceFormatId, format.id);
        if (!route?.length) {
          return null;
        }

        return {
          formatId: format.id,
          label: format.label,
          mimeType: format.mimeType,
          extension: format.extensions?.[0] || "",
          mediaKind: format.mediaKind,
          family: format.family,
          optionOrder: format.optionOrder,
          catalogueIndex: format.catalogueIndex,
          route,
          steps: route.length,
          totalSteps: route.length,
          sourceFormatId,
          normalisation: null,
        };
      })
      .filter(Boolean)
      .sort(compareTargetPlans);
  }

  sourceCanBeTransparent(sourceFormat) {
    if (!sourceFormat) {
      return false;
    }

    return Boolean(
      sourceFormat.traits?.supportsTransparency || sourceFormat.traits?.vector,
    );
  }

  planExportsFrameArchive(targetPlan) {
    const finalStep = targetPlan?.route?.[targetPlan.route.length - 1] || null;
    return Boolean(
      finalStep?.operation === "write" &&
      finalStep?.fromNode?.type === "kind" &&
      finalStep?.fromNode?.id === "raster-frame-sequence" &&
      finalStep?.handler?.sequenceWriteMode !== "container",
    );
  }

  planWritesSequenceContainer(targetPlan) {
    const finalStep = targetPlan?.route?.[targetPlan.route.length - 1] || null;
    return Boolean(
      finalStep?.operation === "write" &&
      finalStep?.fromNode?.type === "kind" &&
      finalStep?.fromNode?.id === "raster-frame-sequence" &&
      finalStep?.handler?.sequenceWriteMode === "container",
    );
  }

  buildPlanAdvisories(sourceDescription, targetPlan) {
    if (!targetPlan) {
      return [];
    }

    const sourceFormat = sourceDescription?.formatId
      ? this.getFormat(sourceDescription.formatId)
      : null;
    const targetFormat = this.getFormat(targetPlan.formatId);
    const sourceLabel =
      sourceFormat?.label || sourceDescription?.formatLabel || "Source";
    const exportsFrameArchive = this.planExportsFrameArchive(targetPlan);
    const writesSequenceContainer = this.planWritesSequenceContainer(targetPlan);
    const advisories = [];

    if (targetPlan.normalisation?.explanation) {
      advisories.push(targetPlan.normalisation.explanation);
    }

    if (sourceFormat?.traits?.vector) {
      advisories.push(`${sourceLabel} sources are rasterised before conversion`);
    }

    if (sourceFormat?.traits?.animated) {
      if (exportsFrameArchive) {
        advisories.push(
          `Animated ${sourceLabel} files are extracted and packaged as individual ${targetFormat.label} frames in a ZIP archive`,
        );
      } else if (!writesSequenceContainer) {
        advisories.push(`Animated ${sourceLabel} files are reduced to a single frame for ${targetFormat.label} output`);
      }
    }

    if (sourceFormat?.traits?.multiImage) {
      advisories.push(`${sourceLabel} sources are decoded from a single embedded image during conversion`);
    }

    if (
      targetFormat?.id === "image/jpeg" &&
      this.sourceCanBeTransparent(sourceFormat)
    ) {
      advisories.push(
        "Transparency is flattened onto a white background for JPG output",
      );
    }

    if (
      targetFormat?.id === "image/gif" &&
      this.sourceCanBeTransparent(sourceFormat)
    ) {
      advisories.push(
        "Transparency is flattened onto a white background for GIF output",
      );
    }

    if (
      targetFormat?.id === "image/jpeg" &&
      sourceFormat?.id !== "image/jpeg"
    ) {
      advisories.push("JPG output is browser-encoded and lossy");
    }

    if (
      targetFormat?.id === "image/gif" &&
      sourceFormat?.id !== "image/gif"
    ) {
      advisories.push("GIF output is limited to a 256-colour indexed palette and may be lossy");
    }

    if (
      targetFormat?.id === "image/svg+xml" &&
      sourceFormat?.id !== "image/svg+xml"
    ) {
      advisories.push("SVG output wraps the raster image in an SVG container to preserve visual fidelity");
    }

    if (
      targetFormat?.id === "image/bmp" &&
      sourceFormat?.id !== "image/bmp"
    ) {
      advisories.push("BMP output is written as an uncompressed 32-bit bitmap");
    }

    if (
      targetFormat?.id === "image/icns" &&
      sourceFormat?.id !== "image/icns"
    ) {
      advisories.push("ICNS output packages PNG icon sizes in an Apple icon container");
    }

    if (
      targetFormat?.id === "image/x-icon" &&
      sourceFormat?.id !== "image/x-icon"
    ) {
      advisories.push("ICO output stores a single embedded PNG image");
    }

    if (
      targetFormat?.id === "image/webp" &&
      sourceFormat?.id !== "image/webp"
    ) {
      advisories.push("WEBP output is browser-encoded and may be lossy");
    }

    if (
      targetFormat?.id === "image/avif" &&
      sourceFormat?.id !== "image/avif"
    ) {
      advisories.push("AVIF output is encoded locally and may be lossy");
    }

    if (
      targetFormat?.id === "image/heic" &&
      sourceFormat?.id !== "image/heic"
    ) {
      advisories.push("HEIC output is encoded locally and may be lossy");
    }

    if (
      targetFormat?.id === "image/heif" &&
      sourceFormat?.id !== "image/heif"
    ) {
      advisories.push("HEIF output is encoded locally and may be lossy");
    }

    if (
      targetFormat?.id === "image/x-win-bitmap-cursor" &&
      sourceFormat?.id !== "image/x-win-bitmap-cursor"
    ) {
      advisories.push("CUR output stores a single embedded PNG cursor with a 0,0 hotspot");
    }

    if (
      targetFormat?.id === "image/ktx" &&
      sourceFormat?.id !== "image/ktx"
    ) {
      advisories.push("KTX output is written as an uncompressed RGBA texture container");
    }

    if (
      targetFormat?.id === "image/ktx2" &&
      sourceFormat?.id !== "image/ktx2"
    ) {
      advisories.push("KTX2 output is written as an uncompressed RGBA texture container");
    }

    return dedupeAdvisories(advisories);
  }

  attachPlanAdvisories(sourceDescription, targetPlans) {
    return targetPlans.map((targetPlan) => {
      const advisories = this.buildPlanAdvisories(sourceDescription, targetPlan);
      const exportsFrameArchive = this.planExportsFrameArchive(targetPlan);
      return Object.freeze({
        ...targetPlan,
        exportsFrameArchive,
        actionLabel: exportsFrameArchive ? "Frames (ZIP)" : targetPlan.label,
        advisories: Object.freeze(advisories),
        primaryAdvisory: advisories[0] || "",
        advisoryText: advisories.join(" • "),
      });
    });
  }

  matchesNormaliser(normaliser, description) {
    if (!normaliser || !description) {
      return false;
    }
    if (normaliser.whenUnknownOnly && description.isKnownFormat) {
      return false;
    }
    if (
      normaliser.mediaKinds.length &&
      !normaliser.mediaKinds.includes(description.mediaKind)
    ) {
      return false;
    }
    if (normaliser.formatIds.length) {
      if (!description.formatId || !normaliser.formatIds.includes(description.formatId)) {
        return false;
      }
    }
    if (normaliser.mimePrefixes.length) {
      const mimeType = normaliseMimeType(description.mimeType);
      if (
        !mimeType ||
        !normaliser.mimePrefixes.some((prefix) => mimeType.startsWith(prefix))
      ) {
        return false;
      }
    }
    if (normaliser.extensions.length) {
      if (!description.extension || !normaliser.extensions.includes(description.extension)) {
        return false;
      }
    }
    if (
      normaliser.requiresBrowserRenderable &&
      !description.browserRenderable
    ) {
      return false;
    }
    return true;
  }

  createNormalisedTargetPlan(normaliser, output, targetFormat, route) {
    return {
      formatId: targetFormat.id,
      label: targetFormat.label,
      mimeType: targetFormat.mimeType,
      extension: targetFormat.extensions?.[0] || "",
      mediaKind: targetFormat.mediaKind,
      family: targetFormat.family,
      optionOrder: targetFormat.optionOrder,
      catalogueIndex: targetFormat.catalogueIndex,
      route,
      steps: route.length,
      totalSteps: route.length + 1,
      sourceFormatId: output.formatId,
      normalisation: {
        normaliserId: normaliser.id,
        normaliserLabel: normaliser.label,
        outputFormatId: output.formatId,
        outputFormatLabel: this.getFormat(output.formatId)?.label || output.formatId,
        mode: output.mode,
        lossProfile: output.lossProfile,
        explanation: output.explanation,
        normaliserIndex: normaliser.normaliserIndex,
        outputIndex: normaliser.outputs.indexOf(output),
      },
    };
  }

  listNormalisedTargets(description, targetFormatId = "") {
    const targetPlansByFormatId = new Map();

    for (const normaliser of this.normalisers.values()) {
      if (!this.matchesNormaliser(normaliser, description)) {
        continue;
      }

      normaliser.outputs.forEach((output) => {
        const sourceFormat = this.getFormat(output.formatId);
        if (!sourceFormat) {
          return;
        }

        if (targetFormatId) {
          const targetFormat = this.getFormat(targetFormatId);
          if (!targetFormat) {
            return;
          }

          const route =
            output.formatId === targetFormatId
              ? []
              : this.findRoute(output.formatId, targetFormatId);

          if (!route && output.formatId !== targetFormatId) {
            return;
          }

          const targetPlan = this.createNormalisedTargetPlan(
            normaliser,
            output,
            targetFormat,
            route || [],
          );
          const existingPlan = targetPlansByFormatId.get(targetFormat.id);
          if (!existingPlan || compareTargetPlans(targetPlan, existingPlan) < 0) {
            targetPlansByFormatId.set(targetFormat.id, targetPlan);
          }
          return;
        }

        const directOutputPlan = this.createNormalisedTargetPlan(
          normaliser,
          output,
          sourceFormat,
          [],
        );
        const existingOutputPlan = targetPlansByFormatId.get(sourceFormat.id);
        if (
          !existingOutputPlan ||
          compareTargetPlans(directOutputPlan, existingOutputPlan) < 0
        ) {
          targetPlansByFormatId.set(sourceFormat.id, directOutputPlan);
        }

        this.buildDirectTargetPlans(output.formatId).forEach((directTargetPlan) => {
          const targetPlan = this.createNormalisedTargetPlan(
            normaliser,
            output,
            this.getFormat(directTargetPlan.formatId),
            directTargetPlan.route,
          );
          const existingPlan = targetPlansByFormatId.get(targetPlan.formatId);
          if (!existingPlan || compareTargetPlans(targetPlan, existingPlan) < 0) {
            targetPlansByFormatId.set(targetPlan.formatId, targetPlan);
          }
        });
      });
    }

    return [...targetPlansByFormatId.values()].sort(compareTargetPlans);
  }

  listTargets(sourceFormatId) {
    const sourceFormat = this.getFormat(sourceFormatId);
    return this.attachPlanAdvisories(
      {
        formatId: sourceFormat?.id || "",
        formatLabel: sourceFormat?.label || "",
        mediaKind: sourceFormat?.mediaKind || "",
        isKnownFormat: Boolean(sourceFormat),
      },
      this.buildDirectTargetPlans(sourceFormatId),
    );
  }

  listTargetsForDescription(description) {
    if (!description) {
      return [];
    }

    const directTargetPlans = description.formatId
      ? this.buildDirectTargetPlans(description.formatId)
      : [];

    if (directTargetPlans.length) {
      return this.attachPlanAdvisories(description, directTargetPlans);
    }

    return this.attachPlanAdvisories(
      description,
      this.listNormalisedTargets(description),
    );
  }

  findTargetPlan(description, targetFormatId) {
    if (!targetFormatId) {
      return null;
    }

    return (
      this.listTargetsForDescription(description).find(
        (plan) => plan.formatId === targetFormatId,
      ) || null
    );
  }

  async describeFile(file) {
    const extension = extractExtension(file?.name);
    const signatureBytes = await readSignatureBytes(file);
    const textPreview = decodeTextPreview(signatureBytes);
    const formatIdFromSignature = this.getFormatIdFromSignature(
      signatureBytes,
      textPreview,
    );
    const formatIdFromMime = this.getFormatIdFromMime(file?.type);
    const formatIdFromExtension = extension
      ? this.extensionToFormatId.get(extension)
      : null;
    const formatId =
      formatIdFromSignature || formatIdFromMime || formatIdFromExtension || null;
    const format = formatId ? this.getFormat(formatId) : null;
    const mimeType = file?.type || format?.mimeType || "";
    const mediaKind = format?.mediaKind || guessMediaKind(mimeType, extension);

    const description = {
      file,
      fileName: file?.name || "",
      fileSize: Number(file?.size) || 0,
      extension,
      mimeType,
      fileHex: formatHexPreview(signatureBytes, Number(file?.size) || 0),
      formatId: format?.id || null,
      formatLabel: format?.label || guessFallbackLabel(file, extension),
      mediaKind,
      family: format?.family || "",
      isKnownFormat: Boolean(format),
      browserRenderable: Boolean(
        format?.browser?.renderNormalisable ||
          normaliseMimeType(mimeType).startsWith("image/"),
      ),
      detectedBy: formatIdFromSignature
        ? "signature"
        : formatIdFromMime
          ? "mime"
          : formatIdFromExtension
            ? "extension"
            : "",
    };

    const directTargetPlans = description.formatId
      ? this.buildDirectTargetPlans(description.formatId)
      : [];
    const normalisedTargetPlans = directTargetPlans.length
      ? []
      : this.listNormalisedTargets(description);

    return {
      ...description,
      hasDirectRoute: directTargetPlans.length > 0,
      hasNormalisationRoute: normalisedTargetPlans.length > 0,
      isSupportedSource:
        directTargetPlans.length > 0 || normalisedTargetPlans.length > 0,
    };
  }

  async convert(file, targetFormatId, options = {}) {
    const source = await this.describeFile(file);
    const targetPlan = this.findTargetPlan(source, targetFormatId);
    if (!targetPlan) {
      throw new Error("No conversion route is registered for that target format");
    }

    let asset = {
      blob: file,
      fileName: source.fileName,
      fileSize: source.fileSize,
      mimeType: source.mimeType || this.getFormat(source.formatId)?.mimeType || "",
      formatId: source.formatId,
    };

    if (targetPlan.normalisation) {
      const normaliser = await this.resolveNormaliser(
        this.normalisers.get(targetPlan.normalisation.normaliserId),
      );
      asset = await normaliser.normalise(file, {
        source,
        outputFormat: this.getFormat(targetPlan.normalisation.outputFormatId),
        targetFormat: this.getFormat(targetPlan.formatId),
        options,
        buildOutputFileName,
      });
    }

    for (const step of targetPlan.route) {
      const handler = await this.resolveHandler(step.handler);
      if (step.operation === "read") {
        asset = await handler.read(asset, {
          sourceFormat: this.getFormat(step.fromNode.id),
          intermediateKind: this.getKind(step.toNode.id),
          options,
          route: targetPlan.route,
          buildOutputFileName,
        });
        continue;
      }

      asset = await handler.write(asset, {
        sourceKind: this.getKind(step.fromNode.id),
        targetFormat: this.getFormat(step.toNode.id),
        options,
        route: targetPlan.route,
        buildOutputFileName,
      });
    }

    return {
      asset,
      output: await normaliseOutputAsset(
        asset,
        this.getFormat(targetPlan.formatId)?.label || "File",
      ),
      route: targetPlan.route,
      normalisation: targetPlan.normalisation,
      targetPlan,
    };
  }
}
