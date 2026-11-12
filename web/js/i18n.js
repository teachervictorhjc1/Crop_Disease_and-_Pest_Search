// 多國語言：語言偵測／切換、介面文字翻譯、資料翻譯合併
// 介面文字以繁體中文原文當作 key：t('瀏覽') → 英文版回傳 'Browse'，找不到翻譯時顯示中文原文。
// 資料（條目、作物、標籤）的翻譯放在 data/i18n/<語言>.json，載入後覆蓋到原資料上。
import { EN } from './i18n-en.js';

const STORE_KEY = 'crop-lang';

/** 可選語言（新增語言：加一筆、建立 i18n-<id>.js 與 data/i18n/<id>.json） */
export const LANGS = [
  { id: 'zh-Hant', label: '繁體中文', html: 'zh-Hant-TW' },
  { id: 'en', label: 'English', html: 'en' },
];
const DICTS = { en: EN };

function detect() {
  const fromUrl = new URLSearchParams(location.search).get('lang');
  if (LANGS.some((l) => l.id === fromUrl)) {
    // 網址指定的語言（例如分享 ?lang=en 的連結）也記下來
    try { localStorage.setItem(STORE_KEY, fromUrl); } catch { /* 忽略 */ }
    return fromUrl;
  }
  try {
    const saved = localStorage.getItem(STORE_KEY);
    if (LANGS.some((l) => l.id === saved)) return saved;
  } catch { /* 無痕模式等情況 */ }
  // 瀏覽器語言是中文就用中文，其他一律英文
  return /^zh/i.test(navigator.language || '') ? 'zh-Hant' : 'en';
}

/** 目前語言 id */
export const lang = detect();
export const isZh = lang === 'zh-Hant';
/** 日期等格式化用的地區代碼 */
export const locale = isZh ? 'zh-TW' : 'en';

/**
 * 翻譯介面文字；vars 會取代 {name} 佔位符
 * @param {string} s 繁體中文原文
 */
export function t(s, vars) {
  let out = DICTS[lang]?.[s] ?? s;
  if (vars) out = out.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
  return out;
}

/** 切換語言（重新載入頁面，讓資料與快取的畫面全部換成新語言） */
export function setLang(id) {
  try { localStorage.setItem(STORE_KEY, id); } catch { /* 無法儲存時只影響下次開啟 */ }
  const url = new URL(location.href);
  if (url.searchParams.has('lang')) {
    url.searchParams.set('lang', id);
    location.replace(url.toString());
  } else {
    location.reload();
  }
}

/** 設定 <html lang> 與頁首的語言選單 */
export function setupLangUI() {
  document.documentElement.lang = LANGS.find((l) => l.id === lang)?.html || lang;
  const sel = document.getElementById('lang');
  if (!sel) return;
  sel.innerHTML = LANGS.map((l) => `<option value="${l.id}"${l.id === lang ? ' selected' : ''}>${l.label}</option>`).join('');
  sel.addEventListener('change', () => setLang(sel.value));
  // 靜態 HTML 中標記 data-i18n 的文字
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => { el.placeholder = t(el.dataset.i18nPlaceholder); });
  document.querySelectorAll('[data-i18n-label]').forEach((el) => { el.setAttribute('aria-label', t(el.dataset.i18nLabel)); });
}

/**
 * 把資料翻譯合併到原資料上（原中文保留在 zh 欄位，供搜尋使用）。
 * 資料庫新增、尚未翻譯的條目會維持中文。
 */
export async function translateData(data) {
  if (isZh) return data;
  let tr;
  try {
    const res = await fetch(`./data/i18n/${lang}.json`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    tr = await res.json();
  } catch (err) {
    console.warn('無法載入資料翻譯，維持中文：', err);
    return data;
  }
  const named = (list, map) => list.forEach((x) => {
    const n = map?.[x.id]?.name;
    if (n) { x.zh = x.name; x.name = n; }
  });
  named(data.crops, tr.crops);
  data.crops.forEach((c) => { c.group = t(c.group); });
  named(data.meta.types, tr.types);
  named(data.meta.parts, tr.parts);
  named(data.meta.tags, tr.tags);

  for (const it of data.issues) {
    const o = tr.issues?.[it.id];
    if (!o) continue;
    it.zh = [it.name, it.summary, ...(it.symptoms || []), ...Object.values(it.cropNotes || {})].join(' ');
    for (const k of ['name', 'sci', 'summary', 'conditions']) if (o[k]) it[k] = o[k];
    // 陣列長度不一致（資料庫內容已改、翻譯未更新）時維持原文，避免對不上
    for (const k of ['symptoms', 'prevention', 'control']) {
      if (Array.isArray(o[k]) && o[k].length === (it[k] || []).length) it[k] = o[k];
    }
    if (o.cropNotes) it.cropNotes = { ...it.cropNotes, ...o.cropNotes };
    if (Array.isArray(o.illus) && it.illus?.length === o.illus.length) {
      it.illus = it.illus.map((s, i) => ({ ...s, ...o.illus[i] }));
    }
  }
  return data;
}
