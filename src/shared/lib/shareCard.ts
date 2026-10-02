// Share cards: a square image drawn in the browser (no server, no cost) so a fixed pothole, a ward's rank or a
// promise's status can travel on WhatsApp as a picture. Never put a reporter's details or free text from a report here.

export type CardTone = 'good' | 'bad' | 'warn' | 'brand' | 'info';
export type CardSpec = {
  kicker: string;          // small line at the top, e.g. "KILELESHWA WARD"
  title: string;           // the headline
  stat?: string;           // big number or short word, e.g. "3 days"
  statLabel?: string;      // under the big number
  lines?: string[];        // up to three supporting lines
  tone?: CardTone;
  footer: string;          // e.g. "county-yangu.example/case/NAI-R..."
  brand: string;           // e.g. "County Yangu · Nairobi"
  images?: (HTMLImageElement | null)[]; // optional before and after
};

const TONES: Record<CardTone, string> = { good: '#1f8a5b', bad: '#c0392b', warn: '#c7811c', brand: '#f2a20c', info: '#2f6db5' };

function wrap(ctx: CanvasRenderingContext2D, text: string, max: number): string[] {
  const words = text.split(/\s+/);
  const out: string[] = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width > max && line) { out.push(line); line = w; } else line = next;
  }
  if (line) out.push(line);
  return out;
}

/** Load an image for drawing; resolves to null if it cannot be drawn (for example a cross-origin image without CORS). */
export function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Draw the card and return it as a PNG blob. 1080 by 1080, the size WhatsApp and Instagram show best. */
export async function drawCard(spec: CardSpec): Promise<Blob> {
  const S = 1080;
  const c = document.createElement('canvas');
  c.width = S; c.height = S;
  const ctx = c.getContext('2d')!;
  const accent = TONES[spec.tone ?? 'brand'];
  ctx.fillStyle = '#f6f1e8'; ctx.fillRect(0, 0, S, S);
  ctx.fillStyle = accent; ctx.fillRect(0, 0, S, 18);
  const pad = 80;
  let y = 130;
  ctx.fillStyle = '#5c5a55'; ctx.font = '700 34px system-ui, sans-serif';
  ctx.fillText(spec.kicker.toUpperCase(), pad, y);
  y += 30;
  ctx.fillStyle = '#141b2d'; ctx.font = '800 72px system-ui, sans-serif';
  for (const l of wrap(ctx, spec.title, S - pad * 2).slice(0, 3)) { y += 84; ctx.fillText(l, pad, y); }

  const imgs = (spec.images ?? []).filter((i): i is HTMLImageElement => Boolean(i));
  if (imgs.length) {
    y += 40;
    const gap = 24, w = (S - pad * 2 - gap * (imgs.length - 1)) / imgs.length, h = 300;
    imgs.forEach((img, i) => {
      const x = pad + i * (w + gap);
      const r = Math.max(w / img.width, h / img.height);
      ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, w, h, 28); ctx.clip();
      ctx.drawImage(img, x + (w - img.width * r) / 2, y + (h - img.height * r) / 2, img.width * r, img.height * r);
      ctx.restore();
      ctx.fillStyle = 'rgba(20,27,45,.8)'; ctx.beginPath(); ctx.roundRect(x + 18, y + 18, 150, 50, 25); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = '700 28px system-ui, sans-serif'; ctx.fillText(i === 0 && imgs.length > 1 ? 'BEFORE' : 'AFTER', x + 38, y + 53);
    });
    y += h;
  }
  if (spec.stat) {
    y += imgs.length ? 110 : 190;
    ctx.fillStyle = accent; ctx.font = '900 150px system-ui, sans-serif';
    ctx.fillText(spec.stat, pad - 6, y);
    if (spec.statLabel) { ctx.fillStyle = '#3c3a36'; ctx.font = '600 38px system-ui, sans-serif'; y += 60; ctx.fillText(spec.statLabel, pad, y); }
  }
  ctx.fillStyle = '#3c3a36'; ctx.font = '500 36px system-ui, sans-serif';
  for (const line of (spec.lines ?? []).slice(0, 3)) { for (const l of wrap(ctx, line, S - pad * 2).slice(0, 2)) { y += 52; if (y < S - 170) ctx.fillText(l, pad, y); } }

  ctx.fillStyle = '#141b2d'; ctx.fillRect(0, S - 130, S, 130);
  ctx.fillStyle = '#f2a20c'; ctx.font = '800 38px system-ui, sans-serif'; ctx.fillText(spec.brand, pad, S - 72);
  ctx.fillStyle = '#d9d4cb'; ctx.font = '500 26px system-ui, sans-serif'; ctx.fillText(spec.footer.slice(0, 70), pad, S - 34);
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('canvas'))), 'image/png'));
}

/**
 * Share the card: the phone's share sheet with the image when it can (WhatsApp shows it as a picture), otherwise
 * download the image and open WhatsApp with the text and link.
 */
export async function shareCard(spec: CardSpec, text: string, url: string): Promise<'shared' | 'downloaded'> {
  const blob = await drawCard(spec);
  const file = new File([blob], 'county-yangu.png', { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try { await nav.share({ files: [file], text: `${text} ${url}` }); return 'shared'; } catch { /* cancelled: fall through to download */ }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'county-yangu.png';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`, '_blank', 'noopener');
  return 'downloaded';
}
