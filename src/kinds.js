// Copyright (c) 2026 Tao
// SPDX-License-Identifier: MPL-2.0
/* Transmute intermediate kind definitions. */

export const RASTER_IMAGE_KIND = Object.freeze({
  id: "raster-image",
  label: "Raster image",
});

export const RASTER_FRAME_SEQUENCE_KIND = Object.freeze({
  id: "raster-frame-sequence",
  label: "Raster frame sequence",
});

export const TRANSMUTE_KINDS = Object.freeze([
  RASTER_IMAGE_KIND,
  RASTER_FRAME_SEQUENCE_KIND,
]);
