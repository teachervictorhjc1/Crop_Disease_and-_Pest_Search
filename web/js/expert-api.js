// 專家帳號登入與專家照片資料存取（直接呼叫 Supabase REST API，不需 SDK、不需建置）
import { CONFIG } from './config.js';
import { t } from './i18n.js';

const BASE = () => CONFIG.SUPABASE_URL.replace(/\/+$/, '');
const KEY = () => CONFIG.SUPABASE_ANON_KEY;
const BUCKET = 'expert-photos';
const SESSION_KEY = 'crop-expert-session';

export const cloudReady = () => Boolean(CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY);

/** 公開照片網址 */
export const photoUrl = (path) => `${BASE()}/storage/v1/object/public/${BUCKET}/${path.split('/').map(encodeURIComponent).join('/')}`;

/* ------------------------------------------------------------------ */
/* 登入狀態（存在 localStorage；無法使用時只存在記憶體）              */
/* ------------------------------------------------------------------ */

let memSession = null;

function saveSession(s) {
  memSession = s;
  try {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else localStorage.removeItem(SESSION_KEY);
  } catch { /* 無痕模式等情況：只存在記憶體 */ }
}

function loadSession() {
  if (memSession) return memSession;
  try {
    memSession = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
  } catch {
    memSession = null;
  }
  return memSession;
}

class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

async function authRequest(grant, body) {
  const res = await fetch(`${BASE()}/auth/v1/token?grant_type=${grant}`, {
    method: 'POST',
    headers: { apikey: KEY(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error_description || data.msg || data.message || `HTTP ${res.status}`);
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at || Math.floor(Date.now() / 1000) + (data.expires_in || 3600),
    user: { id: data.user?.id, email: data.user?.email },
  };
}

/** Email + 密碼登入 */
export async function signIn(email, password) {
  const s = await authRequest('password', { email, password });
  saveSession(s);
  return s;
}

export async function signOut() {
  const s = loadSession();
  saveSession(null);
  if (s) {
    fetch(`${BASE()}/auth/v1/logout`, { method: 'POST', headers: { apikey: KEY(), Authorization: `Bearer ${s.access_token}` } }).catch(() => {});
  }
}

/** 取得有效的登入狀態（快過期時自動更新）；未登入回傳 null */
export async function getSession() {
  const s = loadSession();
  if (!s) return null;
  if (s.expires_at - 60 > Date.now() / 1000) return s;
  try {
    const fresh = await authRequest('refresh_token', { refresh_token: s.refresh_token });
    saveSession(fresh);
    return fresh;
  } catch {
    saveSession(null);
    return null;
  }
}

async function authHeaders(extra = {}) {
  const s = await getSession();
  if (!s) throw new ApiError(401, t('登入已過期，請重新登入。'));
  return { apikey: KEY(), Authorization: `Bearer ${s.access_token}`, ...extra };
}

async function rest(path, { method = 'GET', body, headers = {}, auth = false } = {}) {
  const h = auth ? await authHeaders(headers) : { apikey: KEY(), ...headers };
  if (!auth && !KEY().startsWith('sb_')) h.Authorization = `Bearer ${KEY()}`;
  if (body !== undefined) h['Content-Type'] = 'application/json';
  const res = await fetch(`${BASE()}/rest/v1/${path}`, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new ApiError(res.status, data?.message || data?.hint || `HTTP ${res.status}`);
  return data;
}

/* ------------------------------------------------------------------ */
/* 專家                                                                */
/* ------------------------------------------------------------------ */

/** 目前登入者的專家資料；不是專家時回傳 null */
export async function getExpertProfile() {
  const s = await getSession();
  if (!s) return null;
  const rows = await rest(`experts?select=name,org&user_id=eq.${s.user.id}`, { auth: true });
  return rows?.[0] ? { ...rows[0], email: s.user.email, userId: s.user.id } : null;
}

async function uploadObject(path, blob) {
  const res = await fetch(`${BASE()}/storage/v1/object/${BUCKET}/${path}`, {
    method: 'POST',
    headers: await authHeaders({ 'Content-Type': 'image/jpeg', 'x-upsert': 'false', 'cache-control': '31536000' }),
    body: blob,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(res.status, t('照片上傳失敗：') + (data.message || data.error || res.status));
  }
}

async function removeObjects(paths) {
  await fetch(`${BASE()}/storage/v1/object/${BUCKET}`, {
    method: 'DELETE',
    headers: await authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ prefixes: paths }),
  }).catch(() => {});
}

/**
 * 新增一筆專家照片診斷
 * @param {object} rec 欄位見 supabase/expert.sql；images 為 makeUploadImages() 的結果
 */
export async function createExpertPhoto(profile, images, rec, onProgress = () => {}) {
  const id = crypto.randomUUID();
  const image_path = `${profile.userId}/${id}.jpg`;
  const thumb_path = `${profile.userId}/${id}_t.jpg`;
  onProgress('上傳照片中…');
  await uploadObject(image_path, images.full);
  await uploadObject(thumb_path, images.thumb);
  onProgress('儲存診斷資料中…');
  try {
    const rows = await rest('expert_photos', {
      method: 'POST',
      auth: true,
      headers: { Prefer: 'return=representation' },
      body: {
        id, created_by: profile.userId, author: profile.name, image_path, thumb_path,
        width: images.width, height: images.height, ...rec,
      },
    });
    return rows?.[0];
  } catch (err) {
    await removeObjects([image_path, thumb_path]); // 資料寫入失敗時，清掉已上傳的照片
    throw err;
  }
}

/** 我建立的資料（最新在前） */
export async function listMyPhotos(profile, limit = 30) {
  return rest(`expert_photos?select=*&created_by=eq.${profile.userId}&order=created_at.desc&limit=${limit}`, { auth: true });
}

export async function deleteExpertPhoto(row) {
  await rest(`expert_photos?id=eq.${row.id}`, { method: 'DELETE', auth: true });
  await removeObjects([row.image_path, row.thumb_path]);
}

/* ------------------------------------------------------------------ */
/* 公開查詢（條目頁顯示）                                              */
/* ------------------------------------------------------------------ */

/** 某條目的專家實拍照片；資料表不存在或離線時回傳空陣列 */
export async function fetchIssuePhotos(issueId, limit = 24) {
  if (!cloudReady()) return [];
  try {
    return await rest(
      `expert_photos?select=id,created_at,author,image_path,thumb_path,crop,crop_custom,part,tags,custom_tags,note,license` +
      `&issue_id=eq.${encodeURIComponent(issueId)}&order=created_at.desc&limit=${limit}`,
    ) || [];
  } catch (err) {
    console.warn('讀取專家照片失敗：', err);
    return [];
  }
}

export { ApiError };
