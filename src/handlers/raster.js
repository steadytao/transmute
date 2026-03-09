function loadImageElement(blob, errorMessage) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(blob);
    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      resolve({
        source: image,
        width: image.naturalWidth,
        height: image.naturalHeight,
        release() {
          URL.revokeObjectURL(objectUrl);
        },
      });
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(errorMessage));
    };
    image.src = objectUrl;
  });
}

async function loadImageSource(blob, errorMessage) {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(blob);
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        release() {
          bitmap.close();
        },
      };
    } catch {
      return loadImageElement(blob, errorMessage);
    }
  }

  return loadImageElement(blob, errorMessage);
}

export async function readRasterAsset(blob, errorMessage) {
  const imageSource = await loadImageSource(blob, errorMessage);

  return {
    kind: "raster-image",
    width: imageSource.width,
    height: imageSource.height,
    drawToContext(drawingContext) {
      drawingContext.drawImage(imageSource.source, 0, 0);
    },
    release() {
      imageSource.release();
    },
  };
}

export function renderRasterToCanvas(rasterAsset, options = {}) {
  if (!rasterAsset || rasterAsset.kind !== "raster-image") {
    throw new Error("This handler expected a raster-image intermediate.");
  }

  const canvas = document.createElement("canvas");
  canvas.width = rasterAsset.width;
  canvas.height = rasterAsset.height;

  const drawingContext = canvas.getContext("2d", {
    alpha: options.alpha !== false,
  });
  if (!drawingContext) {
    throw new Error("Canvas 2D is unavailable in this browser.");
  }

  if (options.backgroundColor) {
    drawingContext.fillStyle = options.backgroundColor;
    drawingContext.fillRect(0, 0, canvas.width, canvas.height);
  } else if (options.clearCanvas !== false) {
    drawingContext.clearRect(0, 0, canvas.width, canvas.height);
  }

  rasterAsset.drawToContext(drawingContext);
  return canvas;
}

export function canvasToBlob(canvas, mimeType, quality, errorMessage) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error(errorMessage));
        return;
      }
      resolve(blob);
    }, mimeType, quality);
  });
}
