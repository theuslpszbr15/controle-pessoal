const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const brlShort = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 });

export const money = (v) => brl.format(Number(v) || 0);
export const moneyShort = (v) => (Math.abs(v) >= 10000 ? brlShort.format(v) : money(v));

// Aceita "1.234,56", "1234.56", "R$ 12,5"
export function parseMoney(text) {
  let s = String(text ?? '').replace(/[R$\s]/g, '');
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
}

export const moneyInput = (v) => (v || v === 0 ? Number(v).toFixed(2).replace('.', ',') : '');

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
export const safeColor = (c, fallback = '#9a9a9a') => (/^#[0-9a-f]{6}$/i.test(String(c)) ? c : fallback);

export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`);

export const pad = (n) => String(n).padStart(2, '0');
export const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayISO = () => toISO(new Date());
export const parseISO = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d || 1);
};
export const monthKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
export const addDays = (d, n) => {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
};
export const addMonths = (key, n) => {
  const d = parseISO(`${key}-01`);
  d.setMonth(d.getMonth() + n);
  return monthKey(d);
};
export const daysBetween = (a, b) => Math.round((parseISO(b) - parseISO(a)) / 86400000);
export const daysInMonth = (key) => {
  const d = parseISO(`${key}-01`);
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
};

const fmtMonth = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' });
const fmtMonthShort = new Intl.DateTimeFormat('pt-BR', { month: 'short' });
const fmtDay = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short' });
const fmtLong = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
const fmtWeekday = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' });

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
export const monthLabel = (key) => cap(fmtMonth.format(parseISO(`${key}-01`)));
export const monthShort = (key) => fmtMonthShort.format(parseISO(`${key}-01`)).replace('.', '');
export const dayLabel = (iso) => fmtDay.format(parseISO(iso)).replace('.', '');
export const longDate = (d = new Date()) => cap(fmtLong.format(d));
export const weekdayShort = (d) => fmtWeekday.format(d).replace('.', '').slice(0, 3);

export function relativeDay(iso) {
  const diff = daysBetween(todayISO(), iso);
  if (diff === 0) return 'Hoje';
  if (diff === 1) return 'Amanhã';
  if (diff === -1) return 'Ontem';
  if (diff > 1 && diff < 7) return `Em ${diff} dias`;
  if (diff < -1 && diff > -7) return `Há ${-diff} dias`;
  return dayLabel(iso);
}

export function greeting(d = new Date()) {
  const h = d.getHours();
  if (h < 5) return 'Boa madrugada';
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const sum = (arr, f = (x) => x) => arr.reduce((s, x) => s + (Number(f(x)) || 0), 0);

export function groupBy(arr, f) {
  const m = new Map();
  for (const x of arr) {
    const k = f(x);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(x);
  }
  return m;
}

export function debounce(fn, ms) {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
}

export const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function hexToRgb(hex) {
  const h = hex.trim().replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6);
  const n = Number.parseInt(full, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function cssVar(name, el = document.body) {
  return getComputedStyle(el).getPropertyValue(name).trim();
}

export function download(filename, text, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
