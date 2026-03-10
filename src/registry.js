/* Transmute routing, catalogue, and normalisation registry. */

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
      ".png",
      ".jpg",
      ".jpeg",
      ".webp",
      ".svg",
      ".gif",
      ".bmp",
      ".tif",
      ".tiff",
      ".ico",
      ".avif",
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
    case "compound":
      return (signature.markers || []).every((marker) =>
        matchesBytesAtOffset(bytes, marker.bytes, marker.offset || 0),
      );
    case "text":
      return (signature.snippets || []).some((snippet) =>
        textPreview.includes(snippet),
      );
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
      throw new Error("Each format requires an id and label.");
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
      catalogueIndex: this.formatOrder,
      extensions: Object.freeze(
        (format.extensions || []).map((extension) => normaliseExtension(extension)),
      ),
      signatures: Object.freeze([...(format.signatures || [])]),
      browser: freezeBrowserHints(format.browser),
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
      throw new Error("Each intermediate kind requires an id and label.");
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
      throw new Error("Each handler requires an id and formatId.");
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
      throw new Error(`Handler ${normalisedHandler.id} must implement read() or load().`);
    }
    if (
      normalisedHandler.consumes.length &&
      !normalisedHandler.write &&
      !normalisedHandler.load
    ) {
      throw new Error(`Handler ${normalisedHandler.id} must implement write() or load().`);
    }

    this.handlers.set(normalisedHandler.id, normalisedHandler);
    this.handlersByFormatId.set(normalisedHandler.formatId, normalisedHandler);
    return this;
  }

  registerNormaliser(normaliser) {
    if (!normaliser?.id || !normaliser?.outputs?.length) {
      throw new Error("Each normaliser requires an id and at least one output.");
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
      throw new Error(`Normaliser ${normalisedNormaliser.id} must implement normalise() or load().`);
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
      throw new Error(`Handler ${handler.id} has no implementation loader.`);
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
      throw new Error(`Normaliser ${normaliser.id} has no implementation loader.`);
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
    return this.buildDirectTargetPlans(sourceFormatId);
  }

  listTargetsForDescription(description) {
    if (!description) {
      return [];
    }

    const directTargetPlans = description.formatId
      ? this.buildDirectTargetPlans(description.formatId)
      : [];

    if (directTargetPlans.length) {
      return directTargetPlans;
    }

    return this.listNormalisedTargets(description);
  }

  findTargetPlan(description, targetFormatId) {
    if (!targetFormatId) {
      return null;
    }

    if (description?.formatId) {
      const directTargetPlan = this.buildDirectTargetPlans(description.formatId).find(
        (plan) => plan.formatId === targetFormatId,
      );
      if (directTargetPlan) {
        return directTargetPlan;
      }
    }

    return (
      this.listNormalisedTargets(description, targetFormatId).find(
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
      throw new Error("No conversion route is registered for that target format.");
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
      route: targetPlan.route,
      normalisation: targetPlan.normalisation,
      targetPlan,
    };
  }
}
