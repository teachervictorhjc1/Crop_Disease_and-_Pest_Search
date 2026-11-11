// 作物病蟲害檢索 主程式
import { loadAll } from './data.js';
import { renderIllus, adaptIllus } from './illus.js';
import { aiAvailable, shrinkImage, aiDiagnose, errorMessage } from './photo.js';
import { fetchIssuePhotos, photoUrl } from './expert-api.js';
import { renderExpert } from './expert.js';

const $ = (sel, root = document) => root.querySelector(sel);
const view = $('#view');

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
/** 跳脫 HTML（資料可能來自資料庫，一律跳脫後再插入） */
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

const state = {
  data: null,
  idx: { crop: new Map(), type: new Map(), part: new Map(), tag: new Map(), issue: new Map() },
  browse: { q: '', type: '', crop: '', part: '' },
  // ai：拍照診斷狀態 { status: 'loading'|'done'|'error', preview, result, error }
  wizard: { crop: '', part: '', tags: new Set(), ai: null },
};

/* ------------------------------------------------------------------ */
/* 共用小元件                                                          */
/* ------------------------------------------------------------------ */

function typeBadge(typeId) {
  const t = state.idx.type.get(typeId);
  return t ? `<span class="badge type-${esc(t.id)}">${t.icon} ${esc(t.name)}</span>` : '';
}

function cropLabel(id) {
  if (id === '*') return '🌱 多數作物';
  const c = state.idx.crop.get(id);
  return c ? `${c.emoji} ${esc(c.name)}` : esc(id);
}

function cropEmojis(issue) {
  if (issue.crops.includes('*')) return '🌱 多數作物';
  return issue.crops.map((id) => state.idx.crop.get(id)?.emoji || '').join(' ');
}

/* ---------- 依作物顯示 ---------- */

/** 條目是否適用此作物（含「多數作物」通用條目） */
const appliesTo = (it, crop) => Boolean(crop) && (it.crops.includes(crop) || it.crops.includes('*'));
/** 作物簡稱（去掉括號說明），例如「十字花科」 */
const cropShort = (id) => (state.idx.crop.get(id)?.name || id).replace(/（.*）/, '');
/** 條目在此作物上的專屬說明 */
const cropNoteOf = (it, crop) => (crop && it.cropNotes?.[crop]) || '';
/** 條目連結；有作物情境時帶上 ?crop= */
const issueHref = (it, crop) =>
  `#/issue/${encodeURIComponent(it.id)}${appliesTo(it, crop) ? `?crop=${encodeURIComponent(crop)}` : ''}`;

/**
 * 依作物調整條目的示意圖；無法換成該作物的果實圖移到最後，並註明以哪種作物為例。
 * @returns {{spec: object, example: string, i: number}[]}
 */
function cropIllus(it, crop) {
  const list = (it.illus || []).map((spec, i) => ({ ...(appliesTo(it, crop) ? adaptIllus(spec, crop) : { spec, example: '' }), i }));
  return [...list.filter((x) => !x.example), ...list.filter((x) => x.example)];
}

/** 診斷結果用的單張示意圖（依作物調整） */
function diagIllus(it, crop) {
  const first = cropIllus(it, crop)[0];
  return first ? renderIllus(first.spec, it.id + first.i) : '';
}

function card(issue, crop = '') {
  const first = cropIllus(issue, crop)[0];
  const note = cropNoteOf(issue, crop);
  return `<a class="card" href="${issueHref(issue, crop)}">
    <div class="card-illus">${first ? renderIllus(first.spec, issue.id + first.i) : ''}</div>
    <div class="card-body">
      ${typeBadge(issue.type)}
      <h3>${esc(issue.name)}</h3>
      <p class="sci">${esc(issue.sci)}</p>
      ${note
        ? `<p class="crop-note">${state.idx.crop.get(crop)?.emoji || ''} ${esc(note)}</p>`
        : `<p class="summary">${esc(issue.summary)}</p>`}
      <p class="crop-mini" title="適用作物">${cropEmojis(issue)}</p>
    </div>
  </a>`;
}

function chip(group, value, label, active) {
  return `<button type="button" class="chip${active ? ' active' : ''}" data-group="${group}" data-value="${esc(value)}" aria-pressed="${active}">${label}</button>`;
}

const matchesCrop = (issue, crop) => !crop || issue.crops.includes(crop) || issue.crops.includes('*');

/* ------------------------------------------------------------------ */
/* 瀏覽／搜尋                                                          */
/* ------------------------------------------------------------------ */

function searchText(issue) {
  if (!issue._text) {
    const crops = issue.crops.map((c) => (c === '*' ? '多數作物' : state.idx.crop.get(c)?.name || c));
    const tags = issue.tags.map((t) => state.idx.tag.get(t)?.name || t);
    issue._text = [issue.name, issue.en, issue.sci, issue.summary, ...issue.symptoms, issue.conditions, ...crops, ...tags,
      ...Object.values(issue.cropNotes || {})]
      .join(' ')
      .toLowerCase();
  }
  return issue._text;
}

function filterIssues({ q, type, crop, part }) {
  const tokens = q.toLowerCase().split(/\s+/).filter(Boolean);
  return state.data.issues.filter(
    (it) =>
      (!type || it.type === type) &&
      matchesCrop(it, crop) &&
      (!part || it.parts.includes(part)) &&
      tokens.every((t) => searchText(it).includes(t)),
  );
}

function renderBrowse(params) {
  const b = state.browse;
  for (const k of ['type', 'crop', 'part', 'q']) if (params.has(k)) b[k] = params.get(k) || '';
  const { meta, crops } = state.data;

  view.innerHTML = `
    <section class="filters" aria-label="篩選條件">
      <div class="seg" role="group" aria-label="類別">
        ${chip('type', '', '全部', !b.type)}
        ${meta.types.map((t) => chip('type', t.id, `${t.icon} ${esc(t.name)}`, b.type === t.id)).join('')}
      </div>
      <div class="filter-row">
        <label class="sel"><span>作物</span>
          <select id="f-crop">
            <option value="">全部作物</option>
            ${groupedCropOptions(crops, b.crop)}
          </select>
        </label>
        <label class="sel"><span>部位</span>
          <select id="f-part">
            <option value="">全部部位</option>
            ${meta.parts.map((p) => `<option value="${p.id}"${b.part === p.id ? ' selected' : ''}>${p.icon} ${esc(p.name)}</option>`).join('')}
          </select>
        </label>
      </div>
    </section>
    <p class="result-count" id="count" aria-live="polite"></p>
    <section class="grid" id="results"></section>`;

  const update = () => {
    const list = filterIssues(b);
    $('#count').textContent = `共 ${list.length} 筆${b.q ? `（關鍵字：「${b.q}」）` : ''}`;
    if (!list.length) {
      $('#results').innerHTML = `<div class="empty">找不到符合的項目。<br>試試看減少篩選條件，或改用「症狀診斷」。</div>`;
      return;
    }
    if (!b.crop) {
      $('#results').innerHTML = list.map((it) => card(it)).join('');
      return;
    }
    // 選了作物：先列該作物專屬的條目，再列有此作物說明的通用條目，最後是其他共通條目
    const c = state.idx.crop.get(b.crop);
    const name = cropShort(b.crop);
    const own = list.filter((it) => it.crops.includes(b.crop));
    const noted = list.filter((it) => !own.includes(it) && cropNoteOf(it, b.crop));
    const general = list.filter((it) => !own.includes(it) && !noted.includes(it));
    const main = [...own, ...noted];
    const head = (title, sub) => `<div class="grid-head"><h3>${title}</h3>${sub ? `<p class="hint">${sub}</p>` : ''}</div>`;
    $('#results').innerHTML =
      (main.length ? head(`${c?.emoji || ''} ${esc(name)}（${main.length}）`, `以下說明與示意圖都以${esc(name)}為主。`) + main.map((it) => card(it, b.crop)).join('') : '') +
      (general.length
        ? head(`🌱 多數作物共通（${general.length}）`, `這些條目目前只有共通說明；示意圖已盡量換成${esc(name)}的葉形與果實。`) + general.map((it) => card(it, b.crop)).join('')
        : '');
  };

  view.querySelector('.seg').addEventListener('click', (e) => {
    const btn = e.target.closest('.chip');
    if (!btn) return;
    b.type = btn.dataset.value;
    view.querySelectorAll('.seg .chip').forEach((c) => {
      const on = c === btn;
      c.classList.toggle('active', on);
      c.setAttribute('aria-pressed', on);
    });
    update();
  });
  $('#f-crop').addEventListener('change', (e) => { b.crop = e.target.value; update(); });
  $('#f-part').addEventListener('change', (e) => { b.part = e.target.value; update(); });

  const search = $('#search');
  search.value = b.q;
  search.oninput = () => { b.q = search.value.trim(); update(); };
  update();
}

function groupedCropOptions(crops, selected) {
  const groups = new Map();
  for (const c of crops) {
    if (!groups.has(c.group)) groups.set(c.group, []);
    groups.get(c.group).push(c);
  }
  return [...groups]
    .map(([g, list]) => `<optgroup label="${esc(g)}">${list.map((c) => `<option value="${esc(c.id)}"${selected === c.id ? ' selected' : ''}>${c.emoji} ${esc(c.name)}</option>`).join('')}</optgroup>`)
    .join('');
}

/* ------------------------------------------------------------------ */
/* 詳細頁                                                              */
/* ------------------------------------------------------------------ */

function list(items) {
  return `<ul>${(items || []).map((s) => `<li>${esc(s)}</li>`).join('')}</ul>`;
}

/** 詳細頁上方的「在某作物上的特徵」區塊 */
function cropFocusHTML(it, crop) {
  if (!crop) return '';
  const c = state.idx.crop.get(crop);
  const name = esc(cropShort(crop));
  const note = cropNoteOf(it, crop);
  const generic = it.crops.includes('*') || it.crops.length > 1;
  if (!note && !generic) return '';
  return `<div class="crop-focus">
    <strong>${c?.emoji || ''} 在${name}上的特徵</strong>
    <p>${note ? esc(note) : `此條目適用多種作物，下方為共通說明；示意圖已換成${name}的樣子。`}</p>
    <a href="#/issue/${encodeURIComponent(it.id)}">查看不分作物的完整說明 →</a>
  </div>`;
}

function renderDetail(id, cropParam = '') {
  const it = state.idx.issue.get(id);
  if (!it) {
    view.innerHTML = `<div class="empty">找不到這個條目。<br><a href="#/">回到首頁</a></div>`;
    return;
  }
  const crop = appliesTo(it, cropParam) ? cropParam : '';
  const isNutrient = it.type === 'nutrient';
  const parts = it.parts.map((p) => state.idx.part.get(p)).filter(Boolean);
  const related = (it.related || []).map((r) => state.idx.issue.get(r)).filter(Boolean);
  document.title = `${it.name}${crop ? `（${cropShort(crop)}）` : ''}｜作物病蟲害檢索`;

  view.innerHTML = `
    <article class="detail">
      <button type="button" class="back" id="back">← 返回</button>
      <header class="detail-head">
        ${typeBadge(it.type)}
        <h2>${esc(it.name)}</h2>
        <p class="sci">${esc(it.en)}${it.sci && it.sci !== it.en && !isNutrient ? ` ・ <i>${esc(it.sci)}</i>` : ''}</p>
        <p class="lead">${esc(it.summary)}</p>
        ${cropFocusHTML(it, crop)}
        <div class="meta-row">
          <span class="meta-label">作物</span>
          ${it.crops.map((c) => `<a class="chip small${c === crop ? ' active' : ''}" href="#/?crop=${encodeURIComponent(c === '*' ? '' : c)}">${cropLabel(c)}</a>`).join('')}
        </div>
        <div class="meta-row">
          <span class="meta-label">部位</span>
          ${parts.map((p) => `<span class="chip small static">${p.icon} ${esc(p.name)}</span>`).join('')}
        </div>
      </header>

      <section class="gallery" aria-label="特徵示意圖">
        ${cropIllus(it, crop).map(({ spec, example, i }) => `<figure>${renderIllus(spec, it.id + i)}<figcaption>${esc(spec.cap || '')}${
          example ? `<span class="example">（以${esc(cropShort(example))}為例）</span>` : ''}</figcaption></figure>`).join('')}
      </section>

      <section class="block">
        <h3>🔎 特徵與症狀</h3>
        ${list(it.symptoms)}
        <div class="tag-row">${it.tags.map((t) => state.idx.tag.get(t)).filter(Boolean).map((t) => `<span class="tag">${t.icon} ${esc(t.name)}</span>`).join('')}</div>
      </section>

      <section class="block">
        <h3>🌦️ ${isNutrient ? '發生原因' : '好發條件'}</h3>
        <p>${esc(it.conditions)}</p>
      </section>

      <section class="block prevent">
        <h3>🛡️ 預防與栽培管理</h3>
        ${list(it.prevention)}
      </section>

      <section class="block control">
        <h3>${isNutrient ? '🧪 改善方法' : '💊 防治方法'}</h3>
        ${list(it.control)}
      </section>

      <section class="block photos">
        <h3>📷 實拍照片</h3>
        <div id="expert-photos"><p class="hint">讀取專家照片中…</p></div>
        <div id="commons-photos" hidden>
          <p class="hint">目前還沒有專家提供的照片。以下照片從 Wikimedia Commons 即時搜尋，授權與作者標示於每張照片下方。搜尋結果可能包含不相關的影像，請以示意圖與文字描述為準。</p>
          <button type="button" class="btn" id="load-photos">載入網路照片</button>
          <div class="photo-grid" id="photo-grid"></div>
        </div>
      </section>

      ${related.length ? `<section class="block"><h3>🔗 相關條目</h3><div class="related">${related.map((r) => `<a class="rel" href="${issueHref(r, crop)}">${typeBadge(r.type)} ${esc(r.name)}</a>`).join('')}</div></section>` : ''}

      <aside class="notice">
        <strong>⚠️ 用藥安全提醒：</strong>本 App 只提供診斷參考，不取代專業鑑定。施用農藥前，請先查詢
        <a href="https://otserv2.tactri.gov.tw/ppm/" target="_blank" rel="noopener">植物保護資訊系統（植物保護手冊）</a>
        確認該作物的<b>登記藥劑、稀釋倍數與安全採收期</b>，並遵照標示使用。無法確定時，可洽詢各區農業改良場或植物醫師。
      </aside>
    </article>`;

  $('#back').addEventListener('click', () => {
    if (history.length > 1 && state.navigated) history.back();
    else location.hash = '#/';
  });
  $('#load-photos').addEventListener('click', () => loadPhotos(it, crop));
  loadExpertPhotos(it, crop);
  window.scrollTo(0, 0);
}

/* ------------------------------------------------------------------ */
/* Wikimedia Commons 實拍照片                                          */
/* ------------------------------------------------------------------ */

function stripHTML(html) {
  if (!html) return '';
  return new DOMParser().parseFromString(html, 'text/html').body.textContent.trim().replace(/\s+/g, ' ');
}

async function commonsSearch(query, limit = 8) {
  const u = new URL('https://commons.wikimedia.org/w/api.php');
  const params = {
    action: 'query', format: 'json', origin: '*',
    generator: 'search', gsrsearch: `${query} filetype:bitmap`, gsrnamespace: '6', gsrlimit: String(limit),
    prop: 'imageinfo', iiprop: 'url|extmetadata', iiurlwidth: '360',
  };
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  const res = await fetch(u);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  return Object.values(json.query?.pages || {})
    .sort((a, b) => a.index - b.index)
    .map((p) => {
      const ii = p.imageinfo?.[0];
      if (!ii) return null;
      const m = ii.extmetadata || {};
      return {
        thumb: ii.thumburl || ii.url,
        page: ii.descriptionurl,
        title: p.title.replace(/^File:/, ''),
        artist: stripHTML(m.Artist?.value),
        license: m.LicenseShortName?.value || '',
      };
    })
    .filter(Boolean);
}

/** 先從資料庫找專家照片；沒有才顯示 Wikimedia Commons 的搜尋按鈕 */
async function loadExpertPhotos(it, crop) {
  const box = $('#expert-photos');
  const rows = await fetchIssuePhotos(it.id);
  if (!document.body.contains(box)) return; // 已離開此頁
  if (!rows.length) {
    box.innerHTML = '';
    $('#commons-photos').hidden = false;
    return;
  }
  // 選定作物時，該作物的照片排前面
  const sorted = crop ? [...rows.filter((r) => r.crop === crop), ...rows.filter((r) => r.crop !== crop)] : rows;
  const sameCrop = crop ? rows.filter((r) => r.crop === crop).length : 0;
  box.innerHTML = `<p class="hint">以下 ${rows.length} 張照片由農業專家拍攝並診斷為「${esc(it.name)}」${
    crop ? (sameCrop ? `，${esc(cropShort(crop))}的照片（${sameCrop} 張）排在前面` : `；目前還沒有${esc(cropShort(crop))}的照片`) : ''}。點照片可看大圖。</p>
    <div class="photo-grid">${sorted.map((r) => {
      const cropName = r.crop ? `${state.idx.crop.get(r.crop)?.emoji || ''} ${esc(cropShort(r.crop))}` : esc(r.crop_custom || '');
      const part = r.part ? esc(state.idx.part.get(r.part)?.name || r.part) : '';
      const tags = [...(r.tags || []).map((t) => state.idx.tag.get(t)?.name || t), ...(r.custom_tags || [])];
      return `<figure class="photo expert-photo">
        <a href="${esc(photoUrl(r.image_path))}" target="_blank" rel="noopener"><img loading="lazy" src="${esc(photoUrl(r.thumb_path))}" alt="${esc(it.name)}：${cropName}"></a>
        <figcaption>
          <span class="ex-badge">專家診斷</span> ${cropName}${part ? ` ・ ${part}` : ''}
          ${tags.length ? `<br>${tags.map(esc).join('、')}` : ''}
          ${r.note ? `<br><span class="ex-note">${esc(r.note)}</span>` : ''}
          <br>📷 ${esc(r.author)} ・ ${esc(r.license)}
        </figcaption>
      </figure>`;
    }).join('')}</div>`;
}

async function loadPhotos(it, crop = '') {
  const btn = $('#load-photos');
  const grid = $('#photo-grid');
  btn.disabled = true;
  btn.textContent = '載入中…';
  try {
    let photos = [];
    // 有作物情境時，先搜尋「病名 + 作物英文名」，找不到再用一般關鍵字
    const cropEn = crop ? state.idx.crop.get(crop)?.en : '';
    const queries = [cropEn && `${it.en} ${cropEn}`, it.photoQuery, it.en].filter(Boolean);
    for (const q of queries) {
      photos = await commonsSearch(q);
      if (photos.length) break;
    }
    if (!photos.length) {
      grid.innerHTML = `<p class="hint">找不到相關照片。</p>`;
    } else {
      grid.innerHTML = photos
        .map((p) => `<figure class="photo">
          <a href="${esc(p.page)}" target="_blank" rel="noopener"><img loading="lazy" src="${esc(p.thumb)}" alt="${esc(p.title)}"></a>
          <figcaption>${esc(p.artist || '作者未標示')}${p.license ? ` ・ ${esc(p.license)}` : ''}</figcaption>
        </figure>`)
        .join('');
    }
    btn.remove();
  } catch (err) {
    console.error(err);
    btn.disabled = false;
    btn.textContent = '載入失敗，點此重試（需連網）';
  }
}

/* ------------------------------------------------------------------ */
/* 症狀診斷精靈                                                        */
/* ------------------------------------------------------------------ */

function diagnose({ crop, part, tags }) {
  if (!tags.size) return [];
  // 計分：每個符合特徵 3 分、部位符合 2 分、作物專屬（非「多數作物」通用條目）1 分
  const max = tags.size * 3 + (part ? 2 : 0) + (crop ? 1 : 0);
  return state.data.issues
    .filter((it) => matchesCrop(it, crop))
    .map((it) => {
      const hit = it.tags.filter((t) => tags.has(t));
      const partHit = part && it.parts.includes(part);
      const cropHit = crop && it.crops.includes(crop);
      const score = hit.length * 3 + (partHit ? 2 : 0) + (cropHit ? 1 : 0);
      return { it, hit, partHit, score, pct: Math.round((score / max) * 100) };
    })
    .filter((r) => r.hit.length)
    .sort((a, b) => b.score - a.score || a.it.tags.length - b.it.tags.length)
    .slice(0, 12);
}

/** AI 拍照診斷的結果區塊 */
function aiResultHTML(ai) {
  if (!ai) return '';
  const preview = ai.preview ? `<img class="ai-preview" src="${esc(ai.preview)}" alt="上傳的照片">` : '';
  if (ai.status === 'loading') {
    return `<div class="ai-result">${preview}<p class="ai-status"><span class="spinner"></span>AI 分析中，約需 5～20 秒…</p></div>`;
  }
  if (ai.status === 'error') {
    return `<div class="ai-result">${preview}<p class="ai-status error">⚠️ ${esc(ai.error)}</p></div>`;
  }
  const r = ai.result;
  const cands = r.candidates
    .map((c) => ({ ...c, it: state.idx.issue.get(c.id) }))
    .filter((c) => c.it);
  const quality = r.photo_quality === 'poor' ? `<p class="ai-status warn">照片不太清楚，結果可能不準確。</p>` : '';
  const advice = r.advice ? `<p class="ai-advice">💡 ${esc(r.advice)}</p>` : '';
  if (!r.is_plant || !cands.length) {
    return `<div class="ai-result">${preview}
      <p class="ai-status warn">${r.is_plant ? 'AI 無法從這張照片判斷出清單中的問題。' : '這張照片看起來不是作物。'}</p>
      ${r.observation ? `<p class="ai-obs">${esc(r.observation)}</p>` : ''}${advice}</div>`;
  }
  return `<div class="ai-result">${preview}
    ${quality}
    ${r.observation ? `<p class="ai-obs"><b>AI 看到：</b>${esc(r.observation)}</p>` : ''}
    <div class="ai-cands">
      ${cands.map(({ it, confidence, reason }) => {
        const pct = Math.round(confidence * 100);
        return `<a class="diag" href="${issueHref(it, state.wizard.crop)}">
          <div class="diag-illus">${diagIllus(it, state.wizard.crop)}</div>
          <div class="diag-body">
            <div class="diag-top"><span class="ai-badge">AI 推薦</span>${typeBadge(it.type)}<strong>${esc(it.name)}</strong></div>
            <div class="bar" aria-label="AI 把握度 ${pct}%"><span style="width:${pct}%"></span></div>
            <p class="diag-hit">${esc(reason)}</p>
          </div>
          <span class="pct">${pct}%</span>
        </a>`;
      }).join('')}
    </div>
    ${advice}
    <p class="hint">已依照片自動勾選下方的作物、部位與特徵，可以再調整；請點進條目對照特徵圖確認。</p>
  </div>`;
}

function aiPanelHTML(w) {
  if (!aiAvailable()) return '';
  return `<div class="ai-card" id="ai-card">
    <div class="ai-head">
      <strong>📷 拍照診斷（AI）</strong>
      <span class="hint">拍下受害部位，AI 會推薦可能原因並幫你勾選特徵。若先選好下方的作物，AI 會一併參考。</span>
    </div>
    <div class="ai-actions">
      <label class="btn">📸 拍照<input type="file" accept="image/*" capture="environment" data-ai-file hidden></label>
      <label class="btn ghost">🖼️ 選擇照片<input type="file" accept="image/*" data-ai-file hidden></label>
    </div>
    <details class="ai-tips">
      <summary>拍照技巧</summary>
      <ul>
        <li>對焦清楚、光線充足，避免逆光與強烈反光。</li>
        <li>拍「健康與受害交界」的部位，一張只拍一種症狀。</li>
        <li>葉片問題請正面、背面各拍一張；懷疑蟲害時靠近拍蟲體。</li>
        <li>萎凋或矮化時，加拍整株與根部。</li>
      </ul>
    </details>
    ${aiResultHTML(w.ai)}
    <p class="hint">照片會傳送到 Google Gemini 分析，本 App 不會儲存照片。AI 判斷僅供參考，需要連網。</p>
  </div>`;
}

/** 執行 AI 拍照診斷，完成後把結果帶入勾選條件 */
async function runAiDiagnose(file) {
  const w = state.wizard;
  const rerender = () => {
    if (state.wizard === w && location.hash.startsWith('#/wizard')) {
      renderWizard();
      $('#ai-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };
  let img;
  try {
    img = await shrinkImage(file);
  } catch {
    w.ai = { status: 'error', error: errorMessage('bad_image') };
    return rerender();
  }
  w.ai = { status: 'loading', preview: img.dataUrl };
  rerender();
  try {
    const r = await aiDiagnose({ base64: img.base64, mime: img.mime, crop: w.crop });
    w.ai = { status: 'done', preview: img.dataUrl, result: r };
    if (r.is_plant) {
      if (!w.crop && r.crop && state.idx.crop.has(r.crop)) w.crop = r.crop;
      if (r.part) w.part = r.part;
      if (r.tags.length) w.tags = new Set(r.tags.filter((t) => state.idx.tag.has(t)));
    }
  } catch (err) {
    console.warn('AI 診斷失敗：', err);
    w.ai = { status: 'error', preview: img.dataUrl, error: errorMessage(err.code) };
  }
  rerender();
}

function renderWizard() {
  const w = state.wizard;
  const { meta, crops } = state.data;
  document.title = '症狀診斷｜作物病蟲害檢索';

  view.innerHTML = `
    <section class="wizard">
      <h2>🩺 症狀診斷</h2>
      ${aiPanelHTML(w)}
      <p class="lead">依序選擇作物、發生部位，再勾選田間觀察到的特徵，系統會列出最可能的病害、蟲害或營養缺乏。</p>

      <h3><span class="step">1</span> 作物</h3>
      <div class="chips" data-group="crop">
        ${chip('crop', '', '不限', !w.crop)}
        ${crops.map((c) => chip('crop', c.id, `${c.emoji} ${esc(c.name.replace(/（.*）/, ''))}`, w.crop === c.id)).join('')}
      </div>

      <h3><span class="step">2</span> 發生部位</h3>
      <div class="chips" data-group="part">
        ${chip('part', '', '不限', !w.part)}
        ${meta.parts.map((p) => chip('part', p.id, `${p.icon} ${esc(p.name)}`, w.part === p.id)).join('')}
      </div>

      <h3><span class="step">3</span> 觀察到的特徵（可複選）</h3>
      <div class="chips" data-group="tag">
        ${meta.tags.map((t) => chip('tag', t.id, `${t.icon} ${esc(t.name)}`, w.tags.has(t.id))).join('')}
      </div>
      <button type="button" class="btn ghost" id="wz-reset">清除重選</button>

      <h3 class="result-title">可能的原因</h3>
      <div id="wz-results"></div>
    </section>`;

  const update = () => {
    const res = diagnose(w);
    const box = $('#wz-results');
    if (!w.tags.size) {
      box.innerHTML = `<div class="empty">請至少勾選一個觀察到的特徵。</div>`;
      return;
    }
    if (!res.length) {
      box.innerHTML = `<div class="empty">沒有找到符合的項目，請調整條件。</div>`;
      return;
    }
    box.innerHTML = res
      .map(({ it, hit, partHit, pct }) => `<a class="diag" href="${issueHref(it, w.crop)}">
        <div class="diag-illus">${diagIllus(it, w.crop)}</div>
        <div class="diag-body">
          <div class="diag-top">${typeBadge(it.type)}<strong>${esc(it.name)}</strong></div>
          <div class="bar" aria-label="符合度 ${pct}%"><span style="width:${pct}%"></span></div>
          <p class="diag-hit">符合：${hit.map((t) => esc(state.idx.tag.get(t)?.name || t)).join('、')}${partHit ? '、部位' : ''}</p>
        </div>
        <span class="pct">${pct}%</span>
      </a>`)
      .join('');
  };

  view.querySelector('.wizard').addEventListener('click', (e) => {
    const btn = e.target.closest('.chip');
    if (!btn) return;
    const { group, value } = btn.dataset;
    if (group === 'tag') {
      w.tags.has(value) ? w.tags.delete(value) : w.tags.add(value);
      btn.classList.toggle('active');
      btn.setAttribute('aria-pressed', w.tags.has(value));
    } else {
      w[group] = value;
      view.querySelectorAll(`.chip[data-group="${group}"]`).forEach((c) => {
        const on = c === btn;
        c.classList.toggle('active', on);
        c.setAttribute('aria-pressed', on);
      });
    }
    update();
  });
  view.querySelector('.wizard').addEventListener('change', (e) => {
    const input = e.target.closest('[data-ai-file]');
    if (input?.files?.[0]) runAiDiagnose(input.files[0]);
  });
  $('#wz-reset').addEventListener('click', () => {
    state.wizard = { crop: '', part: '', tags: new Set(), ai: null };
    renderWizard();
  });
  update();
}

/* ------------------------------------------------------------------ */
/* 關於                                                                */
/* ------------------------------------------------------------------ */

function renderAbout() {
  const { issues, source } = state.data;
  const count = (t) => issues.filter((i) => i.type === t).length;
  document.title = '關於｜作物病蟲害檢索';
  view.innerHTML = `
    <section class="about">
      <h2>ℹ️ 關於本 App</h2>
      <p>「作物病蟲害檢索」協助農友從田間觀察到的症狀，快速查詢蔬菜、果樹、糧食作物可能遭遇的<b>病害、蟲害與營養缺乏</b>，並提供特徵圖示與防治、改善方法。</p>
      <div class="stats">
        <div><b>${count('disease')}</b><span>病害</span></div>
        <div><b>${count('pest')}</b><span>蟲害</span></div>
        <div><b>${count('nutrient')}</b><span>營養缺乏</span></div>
        <div><b>${state.data.crops.length}</b><span>作物</span></div>
      </div>
      <p class="hint">目前資料來源：<b>${source === 'supabase' ? 'Supabase 雲端資料庫' : '內建資料（離線可用）'}</b></p>

      <h3>📱 安裝到手機</h3>
      <ul>
        <li><b>Android（Chrome）</b>：點右上角選單「⋮」→「安裝應用程式」或「加入主畫面」。</li>
        <li><b>iPhone／iPad（Safari）</b>：點下方「分享」按鈕 →「加入主畫面」。</li>
        <li>安裝後可像 App 一樣全螢幕開啟，<b>瀏覽過的內容在沒有網路時也能查詢</b>。</li>
      </ul>

      <h3>📷 AI 拍照診斷</h3>
      <p>在「症狀診斷」頁可以拍照或選擇照片，由 Google Gemini 判讀並從本 App 的條目中推薦可能原因。照片只用於當次分析，<b>本 App 不會儲存照片</b>；Gemini 免費方案的資料可能被 Google 用於改進服務。AI 可能判斷錯誤，請務必對照特徵圖與說明確認。</p>

      <h3>🧑‍🔬 專家專區</h3>
      <p>農業專家可登入建立「實拍照片 ＋ 診斷」資料，建立後會優先顯示在各條目的實拍照片中。帳號由管理者開通。</p>
      <p><a class="btn ghost" href="#/expert">前往專家建檔</a></p>

      <h3>🖼️ 關於圖片</h3>
      <p>每個條目的特徵圖都是程式繪製的<b>示意圖</b>，用來凸顯辨識重點。條目頁面可另外載入 Wikimedia Commons 的實拍照片（依各照片授權標示作者）。</p>

      <h3>📚 參考資源</h3>
      <ul>
        <li><a href="https://otserv2.tactri.gov.tw/ppm/" target="_blank" rel="noopener">植物保護資訊系統（植物保護手冊）</a>：查詢登記藥劑、使用方法與安全採收期。</li>
        <li><a href="https://pesticide.aphia.gov.tw/" target="_blank" rel="noopener">農藥資訊服務網</a></li>
        <li><a href="https://www.acri.gov.tw/" target="_blank" rel="noopener">農業部農業藥物試驗所</a></li>
        <li>各區農業改良場、植物醫師：田間診斷與病害鑑定。</li>
      </ul>

      <aside class="notice">本 App 內容僅供參考，不能取代專業診斷。實際用藥請以政府公告的登記資訊與標示為準，並遵守安全採收期。</aside>
    </section>`;
}

/* ------------------------------------------------------------------ */
/* 路由與啟動                                                          */
/* ------------------------------------------------------------------ */

function route() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [path, qs = ''] = raw.split('?');
  const params = new URLSearchParams(qs);
  const searchWrap = $('#search-wrap');

  document.querySelectorAll('.tabbar a').forEach((a) => {
    const target = a.getAttribute('href').replace(/^#/, '');
    const active = target === '/' ? path === '/' || path.startsWith('/issue') : path.startsWith(target);
    a.classList.toggle('active', active);
    if (active) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });

  if (path.startsWith('/issue/')) {
    searchWrap.hidden = true;
    renderDetail(decodeURIComponent(path.slice('/issue/'.length)), params.get('crop') || '');
  } else if (path === '/wizard') {
    searchWrap.hidden = true;
    renderWizard();
  } else if (path === '/about') {
    searchWrap.hidden = true;
    renderAbout();
  } else if (path === '/expert') {
    searchWrap.hidden = true;
    renderExpert(view, { data: state.data, idx: state.idx });
  } else {
    searchWrap.hidden = false;
    document.title = '作物病蟲害檢索';
    renderBrowse(params);
  }
}

function buildIndexes(data) {
  const { idx } = state;
  data.crops.forEach((c) => idx.crop.set(c.id, c));
  data.meta.types.forEach((t) => idx.type.set(t.id, t));
  data.meta.parts.forEach((p) => idx.part.set(p.id, p));
  data.meta.tags.forEach((t) => idx.tag.set(t.id, t));
  data.issues.forEach((i) => idx.issue.set(i.id, i));
}

function setupInstall() {
  let deferred = null;
  const btn = $('#install');
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
    btn.hidden = false;
  });
  btn.addEventListener('click', async () => {
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice;
    deferred = null;
    btn.hidden = true;
  });
}

async function main() {
  setupInstall();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch((err) => console.warn('Service Worker 註冊失敗', err));
  }
  try {
    state.data = await loadAll();
  } catch (err) {
    console.error(err);
    view.innerHTML = `<div class="empty">資料載入失敗，請檢查網路後重新整理。</div>`;
    return;
  }
  buildIndexes(state.data);
  window.addEventListener('hashchange', () => { state.navigated = true; route(); });
  route();
}

main();
