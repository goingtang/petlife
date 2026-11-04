// Small pure helpers for the life tools (expenses, supplies, places, care sheet). Unit-tested in __tests__/life.test.ts.

/** The month before a 'YYYY-MM' key. */
export function prevMonthKey(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}

/**
 * `lastPosted` for a new recurring expense created on `today` that posts on `day` of each month.
 * If this month's day has not come yet, return last month so this month posts automatically;
 * otherwise this month is treated as done (the screen offers to add it by hand).
 */
export function initialLastPosted(today: string, day: number): string {
  const month = today.slice(0, 7);
  const dom = Number(today.slice(8, 10));
  return dom < day ? prevMonthKey(month) : month;
}

/** Whether a recurring expense created today should offer "本月也記一筆" (its day already passed this month). */
export function recurringMissedThisMonth(today: string, day: number): boolean {
  return Number(today.slice(8, 10)) >= day;
}

const FOOD_WORDS = ['乾糧', '飼料', '罐', '主食', '牧草', '零食', '肉泥', '凍乾', '鮮食', '餅乾', '糧'];

/** Expense category for restocking a supply, based on its name. */
export function restockCategory(name: string): '食物' | '用品' {
  return FOOD_WORDS.some((w) => name.includes(w)) ? '食物' : '用品';
}

/** "每天約 NT$12" / "每天不到 NT$1" / null when it can't be computed. */
export function costPerDayText(price: number | undefined, pack: number, use: number): string | null {
  if (!price || !(pack > 0) || !(use > 0)) return null;
  const perDay = (price / pack) * use;
  if (perDay < 1) return '每天不到 NT$1';
  return `每天約 NT$${Math.round(perDay).toLocaleString('en-US')}`;
}

/** Straight-line distance in metres. */
export function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = (x: number) => (x * Math.PI) / 180;
  const dLat = r(lat2 - lat1);
  const dLon = r(lon2 - lon1);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/** Name used to compare places: no spaces, brackets or branch suffixes, lower-case. */
export function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[（(].*?[)）]/g, '')
    .replace(/[\s·・\-_.,，。]/g, '')
    .replace(/(分院|分店|門市|店)$/u, '');
}

/** Same place: same normalized name within 150 m. */
export function samePlace(a: { name: string; lat: number; lon: number }, b: { name: string; lat: number; lon: number }): boolean {
  return normalizeName(a.name) === normalizeName(b.name) && haversine(a.lat, a.lon, b.lat, b.lon) <= 150;
}

/** Valid coordinates (Nominatim can return strings that parse to NaN). */
export function validCoord(lat: unknown, lon: unknown): boolean {
  const a = Number(lat);
  const b = Number(lon);
  return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a) <= 90 && Math.abs(b) <= 180 && !(a === 0 && b === 0);
}

/** Split a list into chunks of `n` (care-sheet checklist: one table per week). */
export function chunk<T>(xs: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n));
  return out;
}

/** Normalized phone digits for duplicate checks. */
export function phoneDigits(s: string): string {
  return s.replace(/[^0-9]/g, '').replace(/^886/, '0');
}

/**
 * Grape/raisin hit in an ingredient list, ignoring 葡萄糖 (glucose), 葡萄柚 (grapefruit, incl. seed extract)
 * and English grapefruit / grape seed extract.
 */
export function mentionsGrape(text: string): boolean {
  const t = text.toLowerCase().replace(/葡萄糖|葡萄柚[^、,，;；\n]*|grapefruit[^,;\n]*|grape ?seed[^,;\n]*/g, '');
  return /葡萄|raisin|\bgrapes?\b/.test(t);
}

/**
 * Round a coordinate to 3 decimals (about 100 m) before it leaves the phone, so map services
 * see the neighbourhood, not the user's exact home.
 */
export function roundCoord(x: number): number {
  return Math.round(x * 1000) / 1000;
}

/**
 * Rewrite every file reference in the data (pet photos, diary photos, health attachments, documents,
 * milestones, lost-pet poster, receipts). Mutates `s` — call inside an immer producer or on a copy.
 * Used to move references after the app folder changed and when restoring a backup with photos.
 */
export function mapFileUris(s: any, fn: (u: string) => string): void {
  const m = (u: any) => (typeof u === 'string' && u ? fn(u) : u);
  for (const p of s.pets || []) p.photo = m(p.photo);
  for (const j of s.journal || []) j.photos = (j.photos || []).map(m);
  for (const e of s.entries || []) if (e.v && Array.isArray(e.v.docs)) e.v.docs = e.v.docs.map(m);
  for (const d of s.docs || []) {
    d.fileUri = m(d.fileUri);
    d.pages = (d.pages || []).map(m);
  }
  for (const x of s.milestones || []) x.photo = m(x.photo);
  for (const k of Object.keys(s.lost || {})) if (s.lost[k]) s.lost[k].photo = m(s.lost[k].photo);
  for (const x of s.expenses || []) x.receipt = m(x.receipt);
}

/**
 * A file the app saved lives at `<documents>/petpal/<name>`. On iOS the documents path can change after
 * an update or an iCloud restore; point old absolute paths at the current folder (same file name).
 * Anything that isn't one of our files (web blob URLs, content:// picks) is left alone.
 */
export function rebaseUri(uri: string, docRoot: string): string {
  const root = docRoot.endsWith('/') ? docRoot : docRoot + '/';
  const i = uri.lastIndexOf('/petpal/');
  if (!uri.startsWith('file:') || i < 0 || uri.startsWith(root + 'petpal/')) return uri;
  return root + 'petpal/' + uri.slice(i + '/petpal/'.length);
}
