// AI 拍照診斷：照片縮圖與呼叫 Supabase Edge Function
import { CONFIG } from './config.js';

/** 是否已設定雲端（AI 診斷需要 Supabase Edge Function） */
export const aiAvailable = () => Boolean(CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY);

/**
 * 把照片縮到長邊 maxSide 像素並轉成 JPEG，減少上傳流量。
 * 會依 EXIF 方向自動轉正（手機直拍的照片）。
 * @returns {Promise<{dataUrl: string, base64: string, mime: string}>}
 */
export async function shrinkImage(file, maxSide = 1024, quality = 0.85) {
  let src;
  try {
    src = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    // 舊版瀏覽器不支援 createImageBitmap 選項時，改用 <img>
    src = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('無法讀取這張圖片'));
      img.src = URL.createObjectURL(file);
    });
  }
  const w = src.width || src.naturalWidth;
  const h = src.height || src.naturalHeight;
  const scale = Math.min(1, maxSide / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  canvas.getContext('2d').drawImage(src, 0, 0, canvas.width, canvas.height);
  if (src.close) src.close();
  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  return { dataUrl, base64: dataUrl.split(',')[1], mime: 'image/jpeg' };
}

/** 錯誤代碼 → 給農友看的訊息 */
const ERRORS = {
  limit_client: '這個網路今天的 AI 診斷次數已用完，請明天再試，或先用下方的手動勾選。',
  limit_global: '今天全站的 AI 診斷額度已用完，請明天再試，或先用下方的手動勾選。',
  upstream_quota: 'AI 服務目前忙碌（免費額度暫時用完），請稍後再試。',
  not_configured: 'AI 診斷尚未設定完成（缺少 API 金鑰）。',
  bad_image: '照片格式或大小不符，請換一張照片。',
  origin: '此網址未被允許使用 AI 診斷。',
  timeout: 'AI 回應逾時，請檢查網路後再試一次。',
  offline: '目前沒有網路，AI 拍照診斷需要連網。可先用下方的手動勾選。',
};
export const errorMessage = (code) => ERRORS[code] || 'AI 診斷暫時無法使用，請稍後再試。';

/**
 * 呼叫 AI 診斷
 * @returns {Promise<{is_plant: boolean, photo_quality: string, crop: string, part: string, tags: string[],
 *   observation: string, candidates: {id: string, confidence: number, reason: string}[], advice: string}>}
 */
export async function aiDiagnose({ base64, mime, crop, note }) {
  if (!navigator.onLine) throw Object.assign(new Error('offline'), { code: 'offline' });
  const key = CONFIG.SUPABASE_ANON_KEY;
  const headers = { 'Content-Type': 'application/json', apikey: key };
  if (!key.startsWith('sb_')) headers.Authorization = `Bearer ${key}`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 60_000);
  let res;
  try {
    res = await fetch(`${CONFIG.SUPABASE_URL.replace(/\/+$/, '')}/functions/v1/diagnose`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ image: base64, mime, crop: crop || '', note: note || '' }),
      signal: ctrl.signal,
    });
  } catch (err) {
    throw Object.assign(new Error(String(err)), { code: err.name === 'AbortError' ? 'timeout' : 'network' });
  } finally {
    clearTimeout(timer);
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.ok) {
    const msg = [body.error || `HTTP ${res.status}`, body.detail].filter(Boolean).join('：');
    throw Object.assign(new Error(msg), { code: body.error || 'server' });
  }
  return body.result;
}
