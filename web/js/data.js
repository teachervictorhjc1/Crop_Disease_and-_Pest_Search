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
  const { photo_query, updated_at, sort, ...rest } = row;
  return { ...rest, photoQuery: photo_query ?? row.photoQuery ?? '' };
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
        return { meta, crops, issues: issues.map(normalizeIssue), source: 'supabase' };
      }
    } catch (err) {
      console.warn('Supabase 讀取失敗，改用內建資料：', err);
    }
  }

  const [crops, issues] = await Promise.all([fetchJSON('./data/crops.json'), fetchJSON('./data/issues.json')]);
  return { meta, crops, issues, source: 'local' };
}
