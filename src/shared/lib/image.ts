// Client-side photo preparation. Runs on the resident's phone BEFORE anything is uploaded:
//  * resized to at most 1600px on the long side (about 350 KB as WebP instead of 3-5 MB),
//  * re-encoded through a canvas, which drops EXIF/GPS/device metadata entirely,
//  * orientation is applied first so photos are not sideways.
// The server strips metadata again; this makes the upload small and private by construction.

export const MAX_SIDE = 1600;
export const MAX_PHOTOS = 3;

export function fitWithin(width: number, height: number, max = MAX_SIDE) {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale), scale };
}

export async function preparePhoto(file: File, max = MAX_SIDE): Promise<{ blob: Blob; width: number; height: number }> {
  if (!file.type.startsWith('image/')) throw new Error('not-an-image');
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const { width, height } = fitWithin(bitmap.width, bitmap.height, max);
  const canvas: OffscreenCanvas | HTMLCanvasElement = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(width, height) : Object.assign(document.createElement('canvas'), { width, height });
  const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null;
  if (!ctx) throw new Error('no-canvas');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  const toBlob = (type: string, quality: number): Promise<Blob | null> =>
    'convertToBlob' in canvas ? canvas.convertToBlob({ type, quality }).catch(() => null) : new Promise((r) => (canvas as HTMLCanvasElement).toBlob(r, type, quality));

  let blob = await toBlob('image/webp', 0.78);
  if (!blob || blob.type !== 'image/webp') blob = await toBlob('image/jpeg', 0.8); // older Safari has no WebP encoder
  if (!blob) throw new Error('encode-failed');
  return { blob, width, height };
}
