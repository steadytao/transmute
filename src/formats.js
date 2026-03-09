export const PNG_FORMAT = Object.freeze({
  id: "image/png",
  label: "PNG",
  mimeType: "image/png",
  mediaKind: "image",
  priority: 100,
  extensions: Object.freeze([".png"]),
  signatures: Object.freeze([
    Object.freeze([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  ]),
});

export const JPG_FORMAT = Object.freeze({
  id: "image/jpeg",
  label: "JPG",
  mimeType: "image/jpeg",
  mediaKind: "image",
  priority: 95,
  extensions: Object.freeze([".jpg", ".jpeg"]),
  signatures: Object.freeze([
    Object.freeze([0xff, 0xd8, 0xff]),
  ]),
});

export const TRANSMUTE_FORMATS = Object.freeze([PNG_FORMAT, JPG_FORMAT]);
