// Date helpers. All dates are local-time "YYYY-MM-DD" strings.

const pad = (n: number) => String(n).padStart(2, '0');

export function ymd(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function hm(d: Date = new Date()): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function stamp(d: Date = new Date()): string {
  return `${ymd(d)}T${hm(d)}`;
}

export function today(): string {
  return ymd();
}

export function parseYmd(s: string): Date {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function addDays(s: string, n: number): string {
  const d = parseYmd(s);
  d.setDate(d.getDate() + n);
  return ymd(d);
}

export function addMonths(s: string, n: number): string {
  const d = parseYmd(s);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return ymd(d);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((parseYmd(b).getTime() - parseYmd(a).getTime()) / 864e5);
}

const WD = ['日', '一', '二', '三', '四', '五', '六'];

export function weekday(s: string): string {
  return WD[parseYmd(s).getDay()];
}

export function dateLabel(s: string = today()): string {
  const d = parseYmd(s);
  return `${d.getMonth() + 1}月${d.getDate()}日 星期${WD[d.getDay()]}`;
}

export function shortDate(s: string): string {
  const d = parseYmd(s);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/** "今天 08:02" / "昨天" / "10/18" for a timestamp. */
export function relTime(at: string): string {
  const d = at.slice(0, 10);
  const t = at.slice(11, 16);
  const td = today();
  if (d === td) return t || '今天';
  if (d === addDays(td, -1)) return '昨天' + (t ? ' ' + t : '');
  const y = d.slice(0, 4) === td.slice(0, 4);
  return (y ? shortDate(d) : d.replace(/-/g, '/')) + (t ? ' ' + t : '');
}

/** Time-of-day greeting. In Taiwan 晚安 means "good night", so it is kept for late evening. */
export function greeting(h = new Date().getHours()): string {
  if (h < 5) return '夜深了';
  if (h < 11) return '早安';
  if (h < 14) return '午安';
  if (h < 18) return '下午好';
  if (h < 22) return '晚上好';
  return '晚安';
}

/** Age text from a birthday, e.g. "2 歲 3 個月" or "8 個月". */
export function ageText(birthday: string): string {
  if (!birthday) return '';
  const b = parseYmd(birthday);
  const n = new Date();
  let months = (n.getFullYear() - b.getFullYear()) * 12 + (n.getMonth() - b.getMonth());
  if (n.getDate() < b.getDate()) months -= 1;
  if (months < 0) return '';
  if (months < 1) return `${Math.max(0, daysBetween(birthday, today()))} 天`;
  if (months < 12) return `${months} 個月`;
  const y = Math.floor(months / 12);
  const m = months % 12;
  return m ? `${y} 歲 ${m} 個月` : `${y} 歲`;
}

export function monthKey(s: string): string {
  return s.slice(0, 7);
}

export function addMonthKey(key: string, n: number): string {
  return addMonths(key + '-01', n).slice(0, 7);
}

export function monthLabel(key: string): string {
  const [y, m] = key.split('-');
  return `${y} 年 ${Number(m)} 月`;
}

export function isValidYmd(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return ymd(parseYmd(s)) === s;
}
