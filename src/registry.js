function normalizeExtension(value = "") {
  const trimmed = String(value).trim().toLowerCase();
  if (!trimmed) return "";
  return trimmed.startsWith(".") ? trimmed : `.${trimmed}`;
}

function extractExtension(fileName = "") {
  const match = String(fileName).trim().toLowerCase().match(/(\.[^.]+)$/);
  return match ? match[1] : "";
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
  const normalizedExtension = normalizeExtension(extension);
  const baseName = String(inputName || "converted")
    .trim()
    .replace(/(\.[^.]+)?$/, "");
  return `${baseName || "converted"}${normalizedExtension}`;
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
  if (left.steps !== right.steps) {
    return left.steps - right.steps;
  }
  if (left.priority !== right.priority) {
    return right.priority - left.priority;
  }
  return left.label.localeCompare(right.label);
}

const FILE_SIGNATURE_PREVIEW_BYTES = 12;

function matchesSignature(bytes, signature) {
  if (!bytes?.length || !signature?.length || bytes.length < signature.length) {
    return false;
  }

  return signature.every((value, index) => bytes[index] === value);
}

function formatHexPreview(bytes, fileSize = 0) {
  if (!bytes?.length) {
    return "Unavailable";
  }

  const preview = [...bytes].map((value) => value.toString(16).padStart(2, "0").toUpperCase());
  if (fileSize > bytes.length) {
    preview.push("...");
  }
  return preview.join(" ");
}

async function readSignatureBytes(file, byteCount = FILE_SIGNATURE_PREVIEW_BYTES) {
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

export class TransmuteRegistry {
  constructor() {
    this.formats = new Map();
    this.kinds = new Map();
    this.mimeToFormatId = new Map();
    this.extensionToFormatId = new Map();
    this.handlers = new Map();
    this.handlersByFormatId = new Map();
  }

  registerFormat(format) {
    if (!format?.id || !format?.label) {
      throw new Error("Each format requires an id and label.");
    }

    const normalizedFormat = Object.freeze({
      id: format.id,
      label: format.label,
      mimeType: format.mimeType || "",
      mediaKind: format.mediaKind || "binary",
      priority: Number.isFinite(format.priority) ? format.priority : 0,
      extensions: Object.freeze(
        (format.extensions || []).map((extension) => normalizeExtension(extension)),
      ),
      signatures: Object.freeze(
        (format.signatures || []).map((signature) => Object.freeze([...signature])),
      ),
    });

    this.formats.set(normalizedFormat.id, normalizedFormat);

    if (normalizedFormat.mimeType) {
      this.mimeToFormatId.set(
        normalizedFormat.mimeType.toLowerCase(),
        normalizedFormat.id,
      );
    }

    normalizedFormat.extensions.forEach((extension) => {
      this.extensionToFormatId.set(extension, normalizedFormat.id);
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

    const normalizedHandler = Object.freeze({
      id: handler.id,
      label: handler.label || handler.id,
      formatId: handler.formatId,
      priority: Number.isFinite(handler.priority) ? handler.priority : 0,
      produces: Object.freeze([...(handler.produces || [])]),
      consumes: Object.freeze([...(handler.consumes || [])]),
      read: typeof handler.read === "function" ? handler.read : null,
      write: typeof handler.write === "function" ? handler.write : null,
    });

    normalizedHandler.produces.forEach((kindId) => {
      if (!this.kinds.has(kindId)) {
        throw new Error(`Unknown produced kind: ${kindId}`);
      }
    });
    normalizedHandler.consumes.forEach((kindId) => {
      if (!this.kinds.has(kindId)) {
        throw new Error(`Unknown consumed kind: ${kindId}`);
      }
    });

    if (normalizedHandler.produces.length && !normalizedHandler.read) {
      throw new Error(`Handler ${normalizedHandler.id} must implement read().`);
    }
    if (normalizedHandler.consumes.length && !normalizedHandler.write) {
      throw new Error(`Handler ${normalizedHandler.id} must implement write().`);
    }

    this.handlers.set(normalizedHandler.id, normalizedHandler);
    this.handlersByFormatId.set(normalizedHandler.formatId, normalizedHandler);
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
          if (left.priority !== right.priority) {
            return right.priority - left.priority;
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

  getFormatIdFromSignature(signatureBytes) {
    if (!signatureBytes?.length) {
      return null;
    }

    for (const format of this.formats.values()) {
      if (format.signatures.some((signature) => matchesSignature(signatureBytes, signature))) {
        return format.id;
      }
    }

    return null;
  }

  async describeFile(file) {
    const extension = extractExtension(file?.name);
    const signatureBytes = await readSignatureBytes(file);
    const formatIdFromSignature = this.getFormatIdFromSignature(signatureBytes);
    const formatIdFromMime = file?.type
      ? this.mimeToFormatId.get(file.type.toLowerCase())
      : null;
    const formatIdFromExtension = extension
      ? this.extensionToFormatId.get(extension)
      : null;
    const formatId =
      formatIdFromSignature || formatIdFromMime || formatIdFromExtension || null;
    const format = formatId ? this.getFormat(formatId) : null;
    const handler = format ? this.getHandlerByFormatId(format.id) : null;
    const hasRoute = Boolean(
      format &&
        handler &&
        this.listTargets(format.id).length,
    );

    return {
      file,
      fileName: file?.name || "",
      fileSize: Number(file?.size) || 0,
      extension,
      mimeType: file?.type || format?.mimeType || "",
      fileHex: formatHexPreview(signatureBytes, Number(file?.size) || 0),
      formatId: format?.id || null,
      formatLabel: format?.label || guessFallbackLabel(file, extension),
      mediaKind: format?.mediaKind || "binary",
      isKnownFormat: Boolean(format),
      isSupportedSource: hasRoute,
      detectedBy: formatIdFromSignature
        ? "signature"
        : formatIdFromMime
          ? "mime"
          : formatIdFromExtension
            ? "extension"
            : "",
    };
  }

  listTargets(sourceFormatId) {
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
          priority: format.priority,
          route,
          steps: route.length,
        };
      })
      .filter(Boolean)
      .sort(compareTargetPlans);
  }

  async convert(file, targetFormatId, options = {}) {
    const source = await this.describeFile(file);
    if (!source.formatId || !source.isSupportedSource) {
      throw new Error("No registered handler can read this file yet.");
    }

    const route = this.findRoute(source.formatId, targetFormatId);
    if (!route?.length) {
      throw new Error("No conversion route is registered for that target format.");
    }

    let asset = {
      blob: file,
      fileName: source.fileName,
      fileSize: source.fileSize,
      mimeType: source.mimeType || this.getFormat(source.formatId)?.mimeType || "",
      formatId: source.formatId,
    };

    for (const step of route) {
      if (step.operation === "read") {
        asset = await step.handler.read(asset, {
          sourceFormat: this.getFormat(step.fromNode.id),
          intermediateKind: this.getKind(step.toNode.id),
          options,
          route,
          buildOutputFileName,
        });
        continue;
      }

      asset = await step.handler.write(asset, {
        sourceKind: this.getKind(step.fromNode.id),
        targetFormat: this.getFormat(step.toNode.id),
        options,
        route,
        buildOutputFileName,
      });
    }

    return { asset, route };
  }
}
