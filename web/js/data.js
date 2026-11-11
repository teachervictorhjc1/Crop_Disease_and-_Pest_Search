// 資料載入：優先使用 Supabase，失敗或未設定時改用內建 JSON
import { CONFIG } from './config.js';

async function fetchJSON(url, options) {
  const res = await fetch(url, options);
  if (!res.ok) throw new Error(`HTTP ${res.status}：${url}`);
  return res.json();
}

function supabaseHeaders(key) {
  // 新版 publishable key（sb_ 開頭）只能放在 apikey 標頭；舊版 anon JWT 兩個標頭都放
  return key.startsWith('sb_') ? { apikey: key } : { apikey: key, Authorization: `Bearer ${key}` };
}

async function fromSupabase(table, order) {
  const base = CONFIG.SUPABASE_URL.replace(/\/+$/, '');
  const url = `${base}/rest/v1/${table}?select=*&order=${order}`;
  return fetchJSON(url, { headers: supabaseHeaders(CONFIG.SUPABASE_ANON_KEY) });
}

/** 資料庫欄位（snake_case）轉成前端使用的欄位名稱 */
function normalizeIssue(row) {
  const { photo_query, crop_notes, updated_at, sort, ...rest } = row;
  return { ...rest, photoQuery: photo_query ?? row.photoQuery ?? '', cropNotes: crop_notes ?? row.cropNotes ?? {} };
}

/** 資料庫尚未新增 crop_notes 欄位時，用內建 JSON 補上作物專屬說明 */
async function fillCropNotes(issues) {
  try {
    const local = await fetchJSON('./data/issues.json');
    const map = new Map(local.map((i) => [i.id, i.cropNotes || {}]));
    for (const it of issues) it.cropNotes = map.get(it.id) || {};
  } catch (err) {
    console.warn('無法補上作物說明：', err);
  }
}

/**
 * 載入全部資料
 * @returns {Promise<{meta: object, crops: object[], issues: object[], source: 'supabase'|'local'}>}
 */
export async function loadAll() {
  const meta = await fetchJSON('./data/meta.json');

  if (CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY) {
    try {
      const [crops, issues] = await Promise.all([
        fromSupabase('crops', 'sort.asc'),
        fromSupabase('issues', 'sort.asc'),
      ]);
      if (Array.isArray(issues) && issues.length) {
        const list = issues.map(normalizeIssue);
        if (!('crop_notes' in issues[0])) await fillCropNotes(list);
        return { meta, crops, issues: list, source: 'supabase' };
      }
    } catch (err) {
      console.warn('Supabase 讀取失敗，改用內建資料：', err);
    }
  }

  const [crops, issues] = await Promise.all([fetchJSON('./data/crops.json'), fetchJSON('./data/issues.json')]);
  return { meta, crops, issues: issues.map((it) => ({ ...it, cropNotes: it.cropNotes || {} })), source: 'local' };
}
