// Photo hygiene. The browser already re-encodes photos (which drops EXIF and GPS), but the server never trusts the browser:
// every upload is identified by its bytes (not its declared type), stripped of metadata segments and rebuilt, or refused.
//
//   JPEG  keep image data, JFIF and Adobe segments; drop EXIF (GPS, device, time), XMP, IPTC, comments, thumbnails
//   PNG   keep critical chunks and colour/transparency; drop text, EXIF, time and profile chunks
//   WebP  drop the EXIF and XMP chunks and clear their flags
//
// Anything that does not parse as one of those three is rejected, so a file with a valid header and a payload
// tacked on the end never reaches storage.

export type Image = { bytes: Uint8Array; type: 'image/jpeg' | 'image/png' | 'image/webp'; ext: 'jpg' | 'png' | 'webp' };

const fail = () => new Error('bad_image');

export function sniff(b: Uint8Array): Image['type'] | null {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length > 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => b[i] === v)) return 'image/png';
  if (b.length > 12 && ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WEBP') return 'image/webp';
  return null;
}

const ascii = (b: Uint8Array, at: number, n: number) => String.fromCharCode(...b.subarray(at, at + n));

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

export function stripJpeg(b: Uint8Array): Uint8Array {
  const out: Uint8Array[] = [b.subarray(0, 2)];
  let i = 2;
  let sawScan = false;
  while (i < b.length) {
    if (b[i] !== 0xff) throw fail();
    let marker = b[i + 1];
    while (marker === 0xff) { i++; marker = b[i + 1]; } // fill bytes
    if (marker === undefined) throw fail();
    if (marker === 0xd9) { out.push(b.subarray(i, i + 2)); i += 2; break; } // EOI
    if (marker === 0xda) { out.push(b.subarray(i)); sawScan = true; i = b.length; break; } // start of scan: the rest is image data
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { out.push(b.subarray(i, i + 2)); i += 2; continue; } // no length field
    const len = ((b[i + 2] ?? 0) << 8) | (b[i + 3] ?? 0);
    if (len < 2 || i + 2 + len > b.length) throw fail();
    const metadata = (marker >= 0xe0 && marker <= 0xef) || marker === 0xfe; // APPn and COM
    const keep = !metadata || marker === 0xe0 || marker === 0xee; // JFIF, Adobe colour transform
    if (keep) out.push(b.subarray(i, i + 2 + len));
    i += 2 + len;
  }
  if (!sawScan) throw fail();
  return concat(out);
}

const PNG_KEEP = new Set(['IHDR', 'PLTE', 'IDAT', 'IEND', 'tRNS', 'gAMA', 'cHRM', 'sRGB', 'pHYs']);

export function stripPng(b: Uint8Array): Uint8Array {
  const out: Uint8Array[] = [b.subarray(0, 8)];
  let i = 8;
  let first = true;
  let ended = false;
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  while (i + 12 <= b.length) {
    const len = view.getUint32(i);
    const type = ascii(b, i + 4, 4);
    const end = i + 12 + len;
    if (end > b.length) throw fail();
    if (first && type !== 'IHDR') throw fail();
    first = false;
    if (PNG_KEEP.has(type)) out.push(b.subarray(i, end));
    i = end;
    if (type === 'IEND') { ended = true; break; }
  }
  if (!ended || i !== b.length) throw fail(); // no IEND, or bytes trailing after it
  return concat(out);
}

export function stripWebp(b: Uint8Array): Uint8Array {
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const riffEnd = 8 + view.getUint32(4, true);
  if (riffEnd > b.length || riffEnd < 12) throw fail();
  const chunks: Uint8Array[] = [];
  let i = 12;
  let sawImage = false;
  while (i + 8 <= riffEnd) {
    const tag = ascii(b, i, 4);
    const size = view.getUint32(i + 4, true);
    const end = i + 8 + size + (size % 2);
    if (end > riffEnd + 1) throw fail();
    const chunk = b.slice(i, Math.min(end, riffEnd));
    if (tag === 'VP8 ' || tag === 'VP8L') sawImage = true;
    if (tag === 'VP8X') {
      if (size < 10) throw fail();
      chunk[8] = chunk[8]! & ~0x0c; // clear the EXIF (0x08) and XMP (0x04) flags
      chunks.push(chunk);
    } else if (tag !== 'EXIF' && tag !== 'XMP ') {
      chunks.push(chunk);
    }
    i = end;
  }
  if (!sawImage && !chunks.some((c) => ascii(c, 0, 4) === 'ANMF')) throw fail();
  const body = concat(chunks);
  const head = new Uint8Array(12);
  head.set(b.subarray(0, 4), 0);
  new DataView(head.buffer).setUint32(4, 4 + body.length, true);
  head.set(b.subarray(8, 12), 8);
  return concat([head, body]);
}

/** Identify by content, strip metadata, return the clean file, or throw `bad_image`. */
export function sanitizeImage(input: Uint8Array): Image {
  const type = sniff(input);
  if (type === 'image/jpeg') return { bytes: stripJpeg(input), type, ext: 'jpg' };
  if (type === 'image/png') return { bytes: stripPng(input), type, ext: 'png' };
  if (type === 'image/webp') return { bytes: stripWebp(input), type, ext: 'webp' };
  throw fail();
}
