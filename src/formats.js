/* Transmute format catalogue definitions. */

function freezeBytes(values) {
  return Object.freeze([...values]);
}

function asciiBytes(value) {
  return freezeBytes(
    [...String(value)].map((character) => character.charCodeAt(0)),
  );
}

function createPrefixSignature(values) {
  return Object.freeze({
    type: "prefix",
    bytes: freezeBytes(values),
  });
}

function createMarkerSignature(offset, values) {
  return Object.freeze({
    type: "marker",
    offset: Math.max(0, Number(offset) || 0),
    bytes: freezeBytes(values),
  });
}

function createCompoundSignature(markers) {
  return Object.freeze({
    type: "compound",
    markers: Object.freeze(
      (markers || []).map((marker) =>
        createMarkerSignature(marker.offset, marker.bytes),
      ),
    ),
  });
}

function createTextSignature(snippets) {
  return Object.freeze({
    type: "text",
    snippets: Object.freeze(
      (snippets || []).map((snippet) => String(snippet).trim().toLowerCase()),
    ),
  });
}

function createFormatDefinition({
  id,
  label,
  mimeType,
  mimeAliases = [],
  mediaKind = "binary",
  family = "",
  extensions = [],
  signatures = [],
  browser = {},
}) {
  return Object.freeze({
    id,
    label,
    mimeType,
    mimeAliases: Object.freeze(
      mimeAliases.map((alias) => String(alias).trim().toLowerCase()).filter(Boolean),
    ),
    mediaKind,
    family,
    extensions: Object.freeze([...extensions]),
    signatures: Object.freeze([...signatures]),
    browser: Object.freeze({
      decodable: Boolean(browser.decodable),
      previewable: Boolean(browser.previewable),
      renderNormalisable: Boolean(browser.renderNormalisable),
    }),
  });
}

export const PNG_FORMAT = createFormatDefinition({
  id: "image/png",
  label: "PNG",
  mimeType: "image/png",
  mediaKind: "image",
  family: "raster",
  extensions: [".png"],
  signatures: [
    createPrefixSignature([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  ],
  browser: {
    decodable: true,
    previewable: true,
    renderNormalisable: true,
  },
});

export const JPG_FORMAT = createFormatDefinition({
  id: "image/jpeg",
  label: "JPG",
  mimeType: "image/jpeg",
  mimeAliases: ["image/jpg", "image/pjpeg"],
  mediaKind: "image",
  family: "raster",
  extensions: [".jpg", ".jpeg"],
  signatures: [createPrefixSignature([0xff, 0xd8, 0xff])],
  browser: {
    decodable: true,
    previewable: true,
    renderNormalisable: true,
  },
});

export const WEBP_FORMAT = createFormatDefinition({
  id: "image/webp",
  label: "WEBP",
  mimeType: "image/webp",
  mediaKind: "image",
  family: "raster",
  extensions: [".webp"],
  signatures: [
    createCompoundSignature([
      { offset: 0, bytes: asciiBytes("RIFF") },
      { offset: 8, bytes: asciiBytes("WEBP") },
    ]),
  ],
  browser: {
    decodable: true,
    previewable: true,
    renderNormalisable: true,
  },
});

export const SVG_FORMAT = createFormatDefinition({
  id: "image/svg+xml",
  label: "SVG",
  mimeType: "image/svg+xml",
  mediaKind: "image",
  family: "vector",
  extensions: [".svg"],
  signatures: [createTextSignature(["<svg"])],
  browser: {
    decodable: true,
    previewable: true,
    renderNormalisable: true,
  },
});

export const GIF_FORMAT = createFormatDefinition({
  id: "image/gif",
  label: "GIF",
  mimeType: "image/gif",
  mediaKind: "image",
  family: "animated-raster",
  extensions: [".gif"],
  signatures: [
    createPrefixSignature(asciiBytes("GIF87a")),
    createPrefixSignature(asciiBytes("GIF89a")),
  ],
  browser: {
    decodable: true,
    previewable: true,
    renderNormalisable: true,
  },
});

export const BMP_FORMAT = createFormatDefinition({
  id: "image/bmp",
  label: "BMP",
  mimeType: "image/bmp",
  mimeAliases: ["image/x-ms-bmp"],
  mediaKind: "image",
  family: "raster",
  extensions: [".bmp", ".dib"],
  signatures: [createPrefixSignature(asciiBytes("BM"))],
  browser: {
    decodable: true,
    previewable: true,
    renderNormalisable: true,
  },
});

export const TIFF_FORMAT = createFormatDefinition({
  id: "image/tiff",
  label: "TIFF",
  mimeType: "image/tiff",
  mediaKind: "image",
  family: "raster",
  extensions: [".tif", ".tiff"],
  signatures: [
    createPrefixSignature([0x49, 0x49, 0x2a, 0x00]),
    createPrefixSignature([0x4d, 0x4d, 0x00, 0x2a]),
  ],
  browser: {
    decodable: false,
    previewable: false,
    renderNormalisable: false,
  },
});

export const ICO_FORMAT = createFormatDefinition({
  id: "image/x-icon",
  label: "ICO",
  mimeType: "image/x-icon",
  mimeAliases: ["image/vnd.microsoft.icon"],
  mediaKind: "image",
  family: "raster",
  extensions: [".ico"],
  signatures: [createPrefixSignature([0x00, 0x00, 0x01, 0x00])],
  browser: {
    decodable: true,
    previewable: true,
    renderNormalisable: true,
  },
});

export const AVIF_FORMAT = createFormatDefinition({
  id: "image/avif",
  label: "AVIF",
  mimeType: "image/avif",
  mediaKind: "image",
  family: "raster",
  extensions: [".avif"],
  signatures: [
    createCompoundSignature([
      { offset: 4, bytes: asciiBytes("ftyp") },
      { offset: 8, bytes: asciiBytes("avif") },
    ]),
    createCompoundSignature([
      { offset: 4, bytes: asciiBytes("ftyp") },
      { offset: 8, bytes: asciiBytes("avis") },
    ]),
  ],
  browser: {
    decodable: true,
    previewable: true,
    renderNormalisable: true,
  },
});

export const TRANSMUTE_IMAGE_FORMATS = Object.freeze([
  PNG_FORMAT,
  JPG_FORMAT,
  WEBP_FORMAT,
  SVG_FORMAT,
  GIF_FORMAT,
  BMP_FORMAT,
  TIFF_FORMAT,
  ICO_FORMAT,
  AVIF_FORMAT,
]);

export const TRANSMUTE_FORMATS = TRANSMUTE_IMAGE_FORMATS;
