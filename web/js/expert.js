// 專家診斷資料建置頁（#/expert）
// 流程：拍照／上傳（縮到 1024px）→ 作物、部位 → 症狀特徵（既有 19 個或自訂）→ 診斷結果（既有 47 條目或自訂）→ 儲存並公開
import {
  cloudReady, signIn, signOut, getSession, getExpertProfile,
  createExpertPhoto, listMyPhotos, deleteExpertPhoto, photoUrl, ApiError,
} from './expert-api.js';
import { makeUploadImages, aiDiagnose, aiAvailable, errorMessage } from './photo.js';

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
const $ = (sel, root = document) => root.querySelector(sel);

/** 表單內容（重新繪製時保留） */
const blankForm = (keep = {}) => ({
  images: null, crop: keep.crop || '', cropCustom: keep.cropCustom || '', part: keep.part || '',
  tags: new Set(), customTags: '', issue: '', diagCustom: '', note: '', agree: keep.agree || false,
});
let F = blankForm();
let ctx; // { data, idx }
let view;

/** 自訂特徵：以逗號、頓號、分號或換行分隔，最多 10 個、每個 20 字 */
const parseCustomTags = (s) => [...new Set(s.split(/[,，、;；\n]/).map((t) => t.trim()).filter(Boolean))].slice(0, 10).map((t) => t.slice(0, 20));
const appliesTo = (it, crop) => it.crops.includes('*') || it.crops.includes(crop);
const cropShort = (id) => (ctx.idx.crop.get(id)?.name || id).replace(/（.*）/, '');

export async function renderExpert(viewEl, context) {
  view = viewEl;
  ctx = context;
  document.title = '專家建檔｜作物病蟲害檢索';
  view.innerHTML = `<div class="empty">讀取中…</div>`;

  if (!cloudReady()) {
    view.innerHTML = `<div class="empty">尚未設定 Supabase，無法使用專家建檔。</div>`;
    return;
  }
  const session = await getSession();
  if (!session) return renderLogin();

  let profile;
  try {
    profile = await getExpertProfile();
  } catch (err) {
    if (err.status === 401) { await signOut(); return renderLogin('登入已過期，請重新登入。'); }
    const missing = err.status === 404 || /experts/.test(err.message);
    view.innerHTML = `<div class="empty">${missing ? '資料庫尚未建立專家資料表，請管理者先執行 supabase/expert.sql。' : `讀取專家資料失敗：${esc(err.message)}`}</div>`;
    return;
  }
  if (!profile) {
    view.innerHTML = `<section class="expert narrow">
      <h2>🧑‍🔬 專家建檔</h2>
      <p>此帳號（${esc(session.user.email)}）尚未開通專家權限，請聯絡管理者。</p>
      <button type="button" class="btn ghost" id="ex-logout">登出</button>
    </section>`;
    $('#ex-logout').addEventListener('click', async () => { await signOut(); renderLogin(); });
    return;
  }
  renderForm(profile);
}

/* ------------------------------------------------------------------ */
/* 登入                                                                */
/* ------------------------------------------------------------------ */

function renderLogin(message = '') {
  view.innerHTML = `<section class="expert narrow">
    <h2>🧑‍🔬 專家登入</h2>
    <p class="lead">此區供農業專家建立「實拍照片 ＋ 診斷」資料，建立後會顯示在各條目的實拍照片中，協助農友比對。</p>
    <p class="hint">帳號由管理者開通，未開放自行註冊。</p>
    <form id="ex-login" class="form">
      <label class="field"><span>Email</span><input type="email" name="email" autocomplete="username" required></label>
      <label class="field"><span>密碼</span><input type="password" name="password" autocomplete="current-password" required></label>
      <button type="submit" class="btn">登入</button>
      <p class="ai-status error" id="ex-login-msg" aria-live="polite">${esc(message)}</p>
    </form>
  </section>`;
  $('#ex-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const btn = e.target.querySelector('button');
    btn.disabled = true;
    btn.textContent = '登入中…';
    try {
      await signIn(String(fd.get('email')).trim(), String(fd.get('password')));
      await renderExpert(view, ctx);
    } catch (err) {
      $('#ex-login-msg').textContent = /invalid/i.test(err.message) ? 'Email 或密碼錯誤。' : `登入失敗：${err.message}`;
      btn.disabled = false;
      btn.textContent = '登入';
    }
  });
}

/* ------------------------------------------------------------------ */
/* 建檔表單                                                            */
/* ------------------------------------------------------------------ */

function cropOptions() {
  const groups = new Map();
  for (const c of ctx.data.crops) {
    if (!groups.has(c.group)) groups.set(c.group, []);
    groups.get(c.group).push(c);
  }
  return [...groups].map(([g, list]) => `<optgroup label="${esc(g)}">${list
    .map((c) => `<option value="${esc(c.id)}"${F.crop === c.id ? ' selected' : ''}>${c.emoji} ${esc(c.name)}</option>`).join('')}</optgroup>`).join('') +
    `<option value="__custom"${F.crop === '__custom' ? ' selected' : ''}>✏️ 其他（自訂作物）</option>`;
}

/** 診斷選單：選了作物時，適用此作物的條目在前 */
function issueOptions() {
  const crop = F.crop && F.crop !== '__custom' ? F.crop : '';
  const opt = (it, suffix = '') => `<option value="${esc(it.id)}"${F.issue === it.id ? ' selected' : ''}>${esc(it.name)}${suffix}</option>`;
  const types = ctx.data.meta.types;
  let html = '';
  for (const t of types) {
    const list = ctx.data.issues.filter((it) => it.type === t.id);
    const ok = crop ? list.filter((it) => appliesTo(it, crop)) : list;
    if (ok.length) html += `<optgroup label="${t.icon} ${esc(t.name)}${crop ? `（適用${esc(cropShort(crop))}）` : ''}">${ok.map((it) => opt(it)).join('')}</optgroup>`;
  }
  if (crop) {
    const rest = ctx.data.issues.filter((it) => !appliesTo(it, crop));
    if (rest.length) html += `<optgroup label="其他作物的條目">${rest.map((it) => opt(it, '（其他作物）')).join('')}</optgroup>`;
  }
  return html + `<option value="__custom"${F.issue === '__custom' ? ' selected' : ''}>✏️ 其他（自訂診斷）</option>`;
}

const chip = (group, value, label, active) =>
  `<button type="button" class="chip${active ? ' active' : ''}" data-group="${group}" data-value="${esc(value)}" aria-pressed="${active}">${label}</button>`;

function previewHTML() {
  if (!F.images) return `<p class="hint">請拍照或選擇一張照片（會自動縮到長邊 1024px）。</p>`;
  return `<figure class="ex-preview"><img src="${F.images.dataUrl}" alt="待上傳的照片">
    <figcaption>${F.images.width} × ${F.images.height}px ・ 約 ${Math.round(F.images.full.size / 1024)} KB</figcaption></figure>`;
}

function renderForm(profile) {
  const { meta } = ctx.data;
  view.innerHTML = `<section class="expert">
    <div class="expert-head">
      <h2>🧑‍🔬 專家診斷建檔</h2>
      <p class="hint">${esc(profile.name)}${profile.org ? `（${esc(profile.org)}）` : ''} ・ ${esc(profile.email)}
        <button type="button" class="linkbtn" id="ex-logout">登出</button></p>
    </div>

    <form id="ex-form" class="form" novalidate>
      <h3><span class="step">1</span> 照片</h3>
      <div class="ai-actions">
        <label class="btn">📸 拍照<input type="file" accept="image/*" capture="environment" data-ex-file hidden></label>
        <label class="btn ghost">🖼️ 選擇照片<input type="file" accept="image/*" data-ex-file hidden></label>
      </div>
      <div id="ex-preview">${previewHTML()}</div>
      ${aiAvailable() ? `<div class="ex-ai"><button type="button" class="btn ghost" id="ex-ai" ${F.images ? '' : 'disabled'}>🤖 用 AI 預填作物、部位、特徵與診斷</button>
        <span class="hint" id="ex-ai-msg">預填後請務必確認並修改。</span></div>` : ''}

      <h3><span class="step">2</span> 作物與部位</h3>
      <label class="sel"><span>作物</span><select id="ex-crop"><option value="">請選擇作物</option>${cropOptions()}</select></label>
      <input class="input" id="ex-crop-custom" placeholder="自訂作物名稱，例如：洋香瓜" maxlength="30" value="${esc(F.cropCustom)}" ${F.crop === '__custom' ? '' : 'hidden'}>
      <div class="chips" data-group="part" style="margin-top:10px">
        ${meta.parts.map((p) => chip('part', p.id, `${p.icon} ${esc(p.name)}`, F.part === p.id)).join('')}
      </div>

      <h3><span class="step">3</span> 照片中看得到的症狀特徵（可複選）</h3>
      <div class="chips" data-group="tag">
        ${meta.tags.map((t) => chip('tag', t.id, `${t.icon} ${esc(t.name)}`, F.tags.has(t.id))).join('')}
      </div>
      <label class="field"><span>其他特徵（自訂，以逗號或頓號分隔）</span>
        <input class="input" id="ex-custom-tags" placeholder="例如：葉背灰紫色黴層、果皮木栓化" value="${esc(F.customTags)}"></label>

      <h3><span class="step">4</span> 診斷結果</h3>
      <label class="sel"><span>診斷</span><select id="ex-issue"><option value="">請選擇診斷結果</option>${issueOptions()}</select></label>
      <input class="input" id="ex-diag-custom" placeholder="自訂診斷名稱，例如：番茄褪綠病毒病" maxlength="60" value="${esc(F.diagCustom)}" ${F.issue === '__custom' ? '' : 'hidden'}>
      <label class="field"><span>補充說明（選填，例如發生環境、田間比例、確認方式）</span>
        <textarea class="input" id="ex-note" rows="3" maxlength="500">${esc(F.note)}</textarea></label>

      <label class="check"><input type="checkbox" id="ex-agree" ${F.agree ? 'checked' : ''}>
        我同意以 <a href="https://creativecommons.org/licenses/by/4.0/deed.zh-hant" target="_blank" rel="noopener">CC BY 4.0</a> 授權公開這張照片，署名「${esc(profile.name)}」。</label>
      <button type="submit" class="btn" id="ex-submit">💾 儲存並公開</button>
      <p class="ai-status" id="ex-msg" aria-live="polite"></p>
    </form>

    <h3 class="result-title">📁 我最近建立的資料</h3>
    <div id="ex-mine" class="photo-grid"><p class="hint">讀取中…</p></div>
  </section>`;

  bindForm(profile);
  loadMine(profile);
}

function bindForm(profile) {
  const form = $('#ex-form');
  const msg = (text, cls = '') => { const m = $('#ex-msg'); m.className = `ai-status ${cls}`; m.innerHTML = text; };

  $('#ex-logout').addEventListener('click', async () => { await signOut(); F = blankForm(); renderLogin(); });

  form.addEventListener('change', async (e) => {
    const input = e.target.closest('[data-ex-file]');
    if (input?.files?.[0]) {
      try {
        F.images = await makeUploadImages(input.files[0]);
        $('#ex-preview').innerHTML = previewHTML();
        const ai = $('#ex-ai');
        if (ai) ai.disabled = false;
      } catch {
        msg('無法讀取這張照片，請換一張。', 'error');
      }
      input.value = '';
    }
  });

  $('#ex-crop').addEventListener('change', (e) => {
    F.crop = e.target.value;
    $('#ex-crop-custom').hidden = F.crop !== '__custom';
    if (F.issue && F.issue !== '__custom' && F.crop && F.crop !== '__custom') {
      const it = ctx.idx.issue.get(F.issue);
      if (it && !appliesTo(it, F.crop)) msg(`提醒：「${esc(it.name)}」目前資料未列「${esc(cropShort(F.crop))}」為適用作物，請確認。`, 'warn');
    }
    $('#ex-issue').innerHTML = `<option value="">請選擇診斷結果</option>${issueOptions()}`;
  });
  $('#ex-crop-custom').addEventListener('input', (e) => { F.cropCustom = e.target.value; });
  $('#ex-custom-tags').addEventListener('input', (e) => { F.customTags = e.target.value; });
  $('#ex-issue').addEventListener('change', (e) => {
    F.issue = e.target.value;
    $('#ex-diag-custom').hidden = F.issue !== '__custom';
  });
  $('#ex-diag-custom').addEventListener('input', (e) => { F.diagCustom = e.target.value; });
  $('#ex-note').addEventListener('input', (e) => { F.note = e.target.value; });
  $('#ex-agree').addEventListener('change', (e) => { F.agree = e.target.checked; });

  form.addEventListener('click', (e) => {
    const btn = e.target.closest('.chip');
    if (!btn) return;
    const { group, value } = btn.dataset;
    if (group === 'tag') {
      F.tags.has(value) ? F.tags.delete(value) : F.tags.add(value);
      btn.classList.toggle('active', F.tags.has(value));
      btn.setAttribute('aria-pressed', F.tags.has(value));
    } else if (group === 'part') {
      F.part = F.part === value ? '' : value;
      form.querySelectorAll('.chip[data-group="part"]').forEach((c) => {
        const on = c.dataset.value === F.part;
        c.classList.toggle('active', on);
        c.setAttribute('aria-pressed', on);
      });
    }
  });

  // AI 預填：沿用拍照診斷的 Edge Function
  $('#ex-ai')?.addEventListener('click', async (e) => {
    if (!F.images) return;
    const btn = e.currentTarget;
    const note = $('#ex-ai-msg');
    btn.disabled = true;
    note.textContent = 'AI 分析中，約需 5～20 秒…';
    try {
      const r = await aiDiagnose({ base64: F.images.base64, mime: 'image/jpeg', crop: F.crop && F.crop !== '__custom' ? F.crop : '' });
      if (!F.crop && r.crop && ctx.idx.crop.has(r.crop)) F.crop = r.crop;
      if (r.part) F.part = r.part;
      if (r.tags?.length) F.tags = new Set(r.tags.filter((t) => ctx.idx.tag.has(t)));
      const top = r.candidates?.find((c) => ctx.idx.issue.has(c.id));
      if (top) F.issue = top.id;
      if (r.observation && !F.note) F.note = `（AI 觀察，請修改）${r.observation}`;
      renderForm(profile);
      msg(top ? `AI 預填完成：${esc(ctx.idx.issue.get(top.id).name)}（把握度 ${Math.round(top.confidence * 100)}%）。請確認後再儲存。` : 'AI 無法判斷，請自行填寫。', 'warn');
    } catch (err) {
      note.textContent = errorMessage(err.code);
      btn.disabled = false;
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const customTags = parseCustomTags(F.customTags);
    const problems = [];
    if (!F.images) problems.push('照片');
    if (!F.crop || (F.crop === '__custom' && !F.cropCustom.trim())) problems.push('作物');
    if (!F.tags.size && !customTags.length) problems.push('至少一個症狀特徵');
    if (!F.issue || (F.issue === '__custom' && !F.diagCustom.trim())) problems.push('診斷結果');
    if (!F.agree) problems.push('同意授權');
    if (problems.length) { msg(`請補上：${problems.join('、')}`, 'error'); return; }

    const btn = $('#ex-submit');
    btn.disabled = true;
    try {
      const row = await createExpertPhoto(profile, F.images, {
        crop: F.crop === '__custom' ? null : F.crop,
        crop_custom: F.crop === '__custom' ? F.cropCustom.trim() : null,
        part: F.part || null,
        tags: [...F.tags],
        custom_tags: customTags,
        issue_id: F.issue === '__custom' ? null : F.issue,
        diagnosis_custom: F.issue === '__custom' ? F.diagCustom.trim() : null,
        note: F.note.trim() || null,
      }, (text) => msg(`<span class="spinner"></span>${esc(text)}`));
      // 保留作物、部位與授權勾選，方便連續建檔
      F = blankForm({ crop: F.crop, cropCustom: F.cropCustom, part: F.part, agree: F.agree });
      renderForm(profile);
      const link = row?.issue_id ? `<a href="#/issue/${encodeURIComponent(row.issue_id)}${row.crop ? `?crop=${encodeURIComponent(row.crop)}` : ''}">到條目頁查看</a>` : '（自訂診斷不會顯示在條目頁）';
      msg(`✅ 已儲存並公開。${link}`, 'ok');
    } catch (err) {
      btn.disabled = false;
      if (err instanceof ApiError && err.status === 401) { msg('登入已過期，請重新登入（照片需重新選擇）。', 'error'); return; }
      msg(`儲存失敗：${esc(err.message)}`, 'error');
    }
  });
}

async function loadMine(profile) {
  const box = $('#ex-mine');
  try {
    const rows = await listMyPhotos(profile);
    if (!document.body.contains(box)) return;
    if (!rows.length) { box.innerHTML = `<p class="hint">還沒有資料。</p>`; return; }
    box.innerHTML = rows.map((r) => {
      const it = r.issue_id ? ctx.idx.issue.get(r.issue_id) : null;
      const diag = it ? esc(it.name) : `✏️ ${esc(r.diagnosis_custom || '（未指定）')}`;
      const crop = r.crop ? `${ctx.idx.crop.get(r.crop)?.emoji || ''} ${esc(cropShort(r.crop))}` : esc(r.crop_custom || '');
      return `<figure class="photo expert-photo">
        <a href="${esc(photoUrl(r.image_path))}" target="_blank" rel="noopener"><img loading="lazy" src="${esc(photoUrl(r.thumb_path))}" alt="${diag}"></a>
        <figcaption><b>${diag}</b><br>${crop}${r.part ? ` ・ ${esc(ctx.idx.part.get(r.part)?.name || r.part)}` : ''}<br>
          ${esc(new Date(r.created_at).toLocaleDateString('zh-TW'))}
          <button type="button" class="linkbtn danger" data-del="${esc(r.id)}">刪除</button></figcaption>
      </figure>`;
    }).join('');
    box.onclick = async (e) => {
      const id = e.target.closest('[data-del]')?.dataset.del;
      if (!id) return;
      const row = rows.find((r) => r.id === id);
      if (!row || !confirm('確定要刪除這筆資料與照片嗎？刪除後無法復原。')) return;
      try {
        await deleteExpertPhoto(row);
        loadMine(profile);
      } catch (err) {
        alert(`刪除失敗：${err.message}`);
      }
    };
  } catch (err) {
    box.innerHTML = `<p class="hint">讀取失敗：${esc(err.message)}</p>`;
  }
}
