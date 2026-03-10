// Copyright (c) 2026 Tao
// SPDX-License-Identifier: MPL-2.0
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

function createSuffixSignature(values) {
  return Object.freeze({
    type: "suffix",
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

function createPngChunkSignature(chunkName) {
  return Object.freeze({
    type: "png-chunk",
    chunkName: String(chunkName || "").trim(),
  });
}

function createFormatDefinition({
  id,
  label,
  mimeType,
  optionOrder = 10_000,
  mimeAliases = [],
  mediaKind = "binary",
  family = "",
  extensions = [],
  signatures = [],
  browser = {},
  traits = {},
}) {
  return Object.freeze({
    id,
    label,
    mimeType,
    optionOrder: Number(optionOrder) || 10_000,
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
    traits: Object.freeze({
      supportsTransparency: Boolean(traits.supportsTransparency),
      lossy: Boolean(traits.lossy),
      vector: Boolean(traits.vector),
      animated: Boolean(traits.animated),
      multiImage: Boolean(traits.multiImage),
    }),
  });
}

export const APNG_FORMAT = createFormatDefinition({
  id: "image/apng",
  label: "APNG",
  mimeType: "image/apng",
  optionOrder: 100,
  mediaKind: "image",
  family: "animated-raster",
  extensions: [".png", ".apng"],
  signatures: [createPngChunkSignature("acTL")],
  browser: {
    decodable: true,
    previewable: true,
    renderNormalisable: true,
  },
  traits: {
    supportsTransparency: true,
    animated: true,
  },
});

export const PNG_FORMAT = createFormatDefinition({
  id: "image/png",
  label: "PNG",
  mimeType: "image/png",
  optionOrder: 10,
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
  traits: {
    supportsTransparency: true,
  },
});

export const JPG_FORMAT = createFormatDefinition({
  id: "image/jpeg",
  label: "JPG",
  mimeType: "image/jpeg",
  optionOrder: 20,
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
  traits: {
    lossy: true,
  },
});

export const WEBP_FORMAT = createFormatDefinition({
  id: "image/webp",
  label: "WEBP",
  mimeType: "image/webp",
  optionOrder: 30,
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
  traits: {
    supportsTransparency: true,
    lossy: true,
  },
});

export const SVG_FORMAT = createFormatDefinition({
  id: "image/svg+xml",
  label: "SVG",
  mimeType: "image/svg+xml",
  optionOrder: 40,
  mediaKind: "image",
  family: "vector",
  extensions: [".svg"],
  signatures: [createTextSignature(["<svg"])],
  browser: {
    decodable: true,
    previewable: true,
    renderNormalisable: true,
  },
  traits: {
    supportsTransparency: true,
    vector: true,
  },
});

export const GIF_FORMAT = createFormatDefinition({
  id: "image/gif",
  label: "GIF",
  mimeType: "image/gif",
  optionOrder: 60,
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
  traits: {
    supportsTransparency: true,
    animated: true,
  },
});

export const BMP_FORMAT = createFormatDefinition({
  id: "image/bmp",
  label: "BMP",
  mimeType: "image/bmp",
  optionOrder: 70,
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
  traits: {},
});

export const TIFF_FORMAT = createFormatDefinition({
  id: "image/tiff",
  label: "TIFF",
  mimeType: "image/tiff",
  optionOrder: 80,
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
  traits: {
    multiImage: true,
  },
});

export const TGA_FORMAT = createFormatDefinition({
  id: "image/x-tga",
  label: "TGA",
  mimeType: "image/x-tga",
  optionOrder: 85,
  mimeAliases: [
    "image/x-targa",
    "image/tga",
    "application/x-tga",
  ],
  mediaKind: "image",
  family: "raster",
  extensions: [".tga", ".icb", ".vda", ".vst"],
  signatures: [
    createSuffixSignature([
      ...asciiBytes("TRUEVISION-XFILE."),
      0x00,
    ]),
  ],
  browser: {
    decodable: false,
    previewable: false,
    renderNormalisable: false,
  },
  traits: {
    supportsTransparency: true,
  },
});

export const ICO_FORMAT = createFormatDefinition({
  id: "image/x-icon",
  label: "ICO",
  mimeType: "image/x-icon",
  optionOrder: 90,
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
  traits: {
    supportsTransparency: true,
    multiImage: true,
  },
});

export const ICNS_FORMAT = createFormatDefinition({
  id: "image/icns",
  label: "ICNS",
  mimeType: "image/icns",
  optionOrder: 95,
  mimeAliases: ["image/x-icns"],
  mediaKind: "image",
  family: "raster",
  extensions: [".icns"],
  signatures: [createPrefixSignature(asciiBytes("icns"))],
  browser: {
    decodable: false,
    previewable: false,
    renderNormalisable: false,
  },
  traits: {
    supportsTransparency: true,
    multiImage: true,
  },
});

export const AVIF_FORMAT = createFormatDefinition({
  id: "image/avif",
  label: "AVIF",
  mimeType: "image/avif",
  optionOrder: 50,
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
  traits: {
    supportsTransparency: true,
    lossy: true,
  },
});

export const HEIC_FORMAT = createFormatDefinition({
  id: "image/heic",
  label: "HEIC",
  mimeType: "image/heic",
  optionOrder: 110,
  mimeAliases: ["image/heic-sequence"],
  mediaKind: "image",
  family: "raster",
  extensions: [".heic", ".heics"],
  signatures: [
    createCompoundSignature([
      { offset: 4, bytes: asciiBytes("ftyp") },
      { offset: 8, bytes: asciiBytes("heic") },
    ]),
    createCompoundSignature([
      { offset: 4, bytes: asciiBytes("ftyp") },
      { offset: 8, bytes: asciiBytes("heix") },
    ]),
    createCompoundSignature([
      { offset: 4, bytes: asciiBytes("ftyp") },
      { offset: 8, bytes: asciiBytes("hevc") },
    ]),
    createCompoundSignature([
      { offset: 4, bytes: asciiBytes("ftyp") },
      { offset: 8, bytes: asciiBytes("hevx") },
    ]),
  ],
  browser: {
    decodable: false,
    previewable: false,
    renderNormalisable: false,
  },
  traits: {
    supportsTransparency: true,
    lossy: true,
  },
});

export const HEIF_FORMAT = createFormatDefinition({
  id: "image/heif",
  label: "HEIF",
  mimeType: "image/heif",
  optionOrder: 120,
  mimeAliases: ["image/heif-sequence"],
  mediaKind: "image",
  family: "raster",
  extensions: [".heif", ".heifs", ".hif"],
  signatures: [
    createCompoundSignature([
      { offset: 4, bytes: asciiBytes("ftyp") },
      { offset: 8, bytes: asciiBytes("mif1") },
    ]),
    createCompoundSignature([
      { offset: 4, bytes: asciiBytes("ftyp") },
      { offset: 8, bytes: asciiBytes("msf1") },
    ]),
  ],
  browser: {
    decodable: false,
    previewable: false,
    renderNormalisable: false,
  },
  traits: {
    supportsTransparency: true,
    lossy: true,
  },
});

export const JPEG_XL_FORMAT = createFormatDefinition({
  id: "image/jxl",
  label: "JPEG XL",
  mimeType: "image/jxl",
  optionOrder: 130,
  mediaKind: "image",
  family: "raster",
  extensions: [".jxl"],
  signatures: [
    createPrefixSignature([0xff, 0x0a]),
    createPrefixSignature([0x00, 0x00, 0x00, 0x0c, 0x4a, 0x58, 0x4c, 0x20, 0x0d, 0x0a, 0x87, 0x0a]),
  ],
  browser: {
    decodable: false,
    previewable: false,
    renderNormalisable: false,
  },
  traits: {
    supportsTransparency: true,
    lossy: true,
  },
});

export const JPEG_2000_FORMAT = createFormatDefinition({
  id: "image/jp2",
  label: "JPEG 2000",
  mimeType: "image/jp2",
  optionOrder: 140,
  mimeAliases: ["image/jpx", "image/jpm"],
  mediaKind: "image",
  family: "raster",
  extensions: [".jp2", ".j2k", ".jpx", ".jpm", ".mj2"],
  signatures: [
    createPrefixSignature([0xff, 0x4f, 0xff, 0x51]),
    createPrefixSignature([0x00, 0x00, 0x00, 0x0c, 0x6a, 0x50, 0x20, 0x20, 0x0d, 0x0a, 0x87, 0x0a]),
  ],
  browser: {
    decodable: false,
    previewable: false,
    renderNormalisable: false,
  },
  traits: {
    lossy: true,
  },
});

export const JPEG_XR_FORMAT = createFormatDefinition({
  id: "image/jxr",
  label: "JPEG XR",
  mimeType: "image/jxr",
  optionOrder: 145,
  mimeAliases: ["image/vnd.ms-photo", "image/x-jxr"],
  mediaKind: "image",
  family: "raster",
  extensions: [".jxr", ".wdp", ".hdp"],
  signatures: [
    createPrefixSignature([0x49, 0x49, 0xbc, 0x01]),
    createPrefixSignature([0x4d, 0x4d, 0x01, 0xbc]),
  ],
  browser: {
    decodable: false,
    previewable: false,
    renderNormalisable: false,
  },
  traits: {
    supportsTransparency: true,
    lossy: true,
  },
});

export const CUR_FORMAT = createFormatDefinition({
  id: "image/x-win-bitmap-cursor",
  label: "CUR",
  mimeType: "image/x-win-bitmap-cursor",
  optionOrder: 150,
  mediaKind: "image",
  family: "raster",
  extensions: [".cur"],
  signatures: [createPrefixSignature([0x00, 0x00, 0x02, 0x00])],
  browser: {
    decodable: false,
    previewable: false,
    renderNormalisable: false,
  },
  traits: {
    supportsTransparency: true,
    multiImage: true,
  },
});

export const BPG_FORMAT = createFormatDefinition({
  id: "image/bpg",
  label: "BPG",
  mimeType: "image/bpg",
  optionOrder: 155,
  mediaKind: "image",
  family: "raster",
  extensions: [".bpg"],
  signatures: [createPrefixSignature([0x42, 0x50, 0x47, 0xfb])],
  browser: {
    decodable: false,
    previewable: false,
    renderNormalisable: false,
  },
  traits: {
    supportsTransparency: true,
    lossy: true,
  },
});

export const QOI_FORMAT = createFormatDefinition({
  id: "image/qoi",
  label: "QOI",
  mimeType: "image/qoi",
  optionOrder: 160,
  mediaKind: "image",
  family: "raster",
  extensions: [".qoi"],
  signatures: [createPrefixSignature(asciiBytes("qoif"))],
  browser: {
    decodable: false,
    previewable: false,
    renderNormalisable: false,
  },
  traits: {
    supportsTransparency: true,
  },
});

export const DDS_FORMAT = createFormatDefinition({
  id: "image/vnd-ms.dds",
  label: "DDS",
  mimeType: "image/vnd-ms.dds",
  optionOrder: 180,
  mediaKind: "image",
  family: "raster",
  extensions: [".dds"],
  signatures: [createPrefixSignature(asciiBytes("DDS "))],
  browser: {
    decodable: false,
    previewable: false,
    renderNormalisable: false,
  },
  traits: {},
});

export const EXR_FORMAT = createFormatDefinition({
  id: "image/x-exr",
  label: "OpenEXR",
  mimeType: "image/x-exr",
  optionOrder: 190,
  mediaKind: "image",
  family: "raster",
  extensions: [".exr"],
  signatures: [createPrefixSignature([0x76, 0x2f, 0x31, 0x01])],
  browser: {
    decodable: false,
    previewable: false,
    renderNormalisable: false,
  },
  traits: {
    supportsTransparency: true,
  },
});

export const HDR_FORMAT = createFormatDefinition({
  id: "image/vnd.radiance",
  label: "Radiance HDR",
  mimeType: "image/vnd.radiance",
  optionOrder: 200,
  mimeAliases: ["image/x-hdr"],
  mediaKind: "image",
  family: "raster",
  extensions: [".hdr", ".rgbe"],
  signatures: [createTextSignature(["#?radiance", "#?rgbe"])],
  browser: {
    decodable: false,
    previewable: false,
    renderNormalisable: false,
  },
  traits: {},
});

export const PSD_FORMAT = createFormatDefinition({
  id: "image/vnd.adobe.photoshop",
  label: "PSD",
  mimeType: "image/vnd.adobe.photoshop",
  optionOrder: 170,
  mediaKind: "image",
  family: "raster",
  extensions: [".psd", ".psb"],
  signatures: [createPrefixSignature(asciiBytes("8BPS"))],
  browser: {
    decodable: false,
    previewable: false,
    renderNormalisable: false,
  },
  traits: {
    supportsTransparency: true,
    multiImage: true,
  },
});

export const KTX_FORMAT = createFormatDefinition({
  id: "image/ktx",
  label: "KTX",
  mimeType: "image/ktx",
  optionOrder: 210,
  mediaKind: "image",
  family: "raster",
  extensions: [".ktx"],
  signatures: [
    createPrefixSignature([0xab, 0x4b, 0x54, 0x58, 0x20, 0x31, 0x31, 0xbb, 0x0d, 0x0a, 0x1a, 0x0a]),
  ],
  browser: {
    decodable: false,
    previewable: false,
    renderNormalisable: false,
  },
  traits: {},
});

export const KTX2_FORMAT = createFormatDefinition({
  id: "image/ktx2",
  label: "KTX2",
  mimeType: "image/ktx2",
  optionOrder: 220,
  mediaKind: "image",
  family: "raster",
  extensions: [".ktx2"],
  signatures: [
    createPrefixSignature([0xab, 0x4b, 0x54, 0x58, 0x20, 0x32, 0x30, 0xbb, 0x0d, 0x0a, 0x1a, 0x0a]),
  ],
  browser: {
    decodable: false,
    previewable: false,
    renderNormalisable: false,
  },
  traits: {},
});

export const PBM_FORMAT = createFormatDefinition({
  id: "image/x-portable-bitmap",
  label: "PBM",
  mimeType: "image/x-portable-bitmap",
  optionOrder: 230,
  mediaKind: "image",
  family: "raster",
  extensions: [".pbm"],
  signatures: [
    createPrefixSignature(asciiBytes("P1")),
    createPrefixSignature(asciiBytes("P4")),
  ],
  browser: {
    decodable: false,
    previewable: false,
    renderNormalisable: false,
  },
  traits: {},
});

export const PGM_FORMAT = createFormatDefinition({
  id: "image/x-portable-graymap",
  label: "PGM",
  mimeType: "image/x-portable-graymap",
  optionOrder: 240,
  mediaKind: "image",
  family: "raster",
  extensions: [".pgm"],
  signatures: [
    createPrefixSignature(asciiBytes("P2")),
    createPrefixSignature(asciiBytes("P5")),
  ],
  browser: {
    decodable: false,
    previewable: false,
    renderNormalisable: false,
  },
  traits: {},
});

export const PPM_FORMAT = createFormatDefinition({
  id: "image/x-portable-pixmap",
  label: "PPM",
  mimeType: "image/x-portable-pixmap",
  optionOrder: 250,
  mediaKind: "image",
  family: "raster",
  extensions: [".ppm"],
  signatures: [
    createPrefixSignature(asciiBytes("P3")),
    createPrefixSignature(asciiBytes("P6")),
  ],
  browser: {
    decodable: false,
    previewable: false,
    renderNormalisable: false,
  },
  traits: {},
});

export const PAM_FORMAT = createFormatDefinition({
  id: "image/x-portable-arbitrarymap",
  label: "PAM",
  mimeType: "image/x-portable-arbitrarymap",
  optionOrder: 260,
  mediaKind: "image",
  family: "raster",
  extensions: [".pam"],
  signatures: [createPrefixSignature(asciiBytes("P7"))],
  browser: {
    decodable: false,
    previewable: false,
    renderNormalisable: false,
  },
  traits: {
    supportsTransparency: true,
  },
});

export const MNG_FORMAT = createFormatDefinition({
  id: "image/x-mng",
  label: "MNG",
  mimeType: "image/x-mng",
  optionOrder: 270,
  mediaKind: "image",
  family: "animated-raster",
  extensions: [".mng"],
  signatures: [
    createPrefixSignature([0x8a, 0x4d, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  ],
  browser: {
    decodable: false,
    previewable: false,
    renderNormalisable: false,
  },
  traits: {
    supportsTransparency: true,
    animated: true,
  },
});

export const TRANSMUTE_IMAGE_FORMATS = Object.freeze([
  APNG_FORMAT,
  PNG_FORMAT,
  JPG_FORMAT,
  WEBP_FORMAT,
  SVG_FORMAT,
  GIF_FORMAT,
  BMP_FORMAT,
  TIFF_FORMAT,
  TGA_FORMAT,
  ICO_FORMAT,
  ICNS_FORMAT,
  AVIF_FORMAT,
  HEIC_FORMAT,
  HEIF_FORMAT,
  JPEG_XL_FORMAT,
  JPEG_2000_FORMAT,
  JPEG_XR_FORMAT,
  CUR_FORMAT,
  BPG_FORMAT,
  QOI_FORMAT,
  DDS_FORMAT,
  EXR_FORMAT,
  HDR_FORMAT,
  PSD_FORMAT,
  KTX_FORMAT,
  KTX2_FORMAT,
  PBM_FORMAT,
  PGM_FORMAT,
  PPM_FORMAT,
  PAM_FORMAT,
  MNG_FORMAT,
]);

export const TRANSMUTE_FORMATS = TRANSMUTE_IMAGE_FORMATS;
