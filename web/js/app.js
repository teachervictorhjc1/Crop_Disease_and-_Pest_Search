// 作物病蟲害檢索 主程式
import { loadAll } from './data.js';
import { renderIllus } from './illus.js';

const $ = (sel, root = document) => root.querySelector(sel);
const view = $('#view');

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
/** 跳脫 HTML（資料可能來自資料庫，一律跳脫後再插入） */
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

const state = {
  data: null,
  idx: { crop: new Map(), type: new Map(), part: new Map(), tag: new Map(), issue: new Map() },
  browse: { q: '', type: '', crop: '', part: '' },
  wizard: { crop: '', part: '', tags: new Set() },
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

function card(issue) {
  const illus = issue.illus?.[0];
  return `<a class="card" href="#/issue/${encodeURIComponent(issue.id)}">
    <div class="card-illus">${illus ? renderIllus(illus, issue.id) : ''}</div>
    <div class="card-body">
      ${typeBadge(issue.type)}
      <h3>${esc(issue.name)}</h3>
      <p class="sci">${esc(issue.sci)}</p>
      <p class="summary">${esc(issue.summary)}</p>
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
    issue._text = [issue.name, issue.en, issue.sci, issue.summary, ...issue.symptoms, issue.conditions, ...crops, ...tags]
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
    $('#results').innerHTML = list.length
      ? list.map(card).join('')
      : `<div class="empty">找不到符合的項目。<br>試試看減少篩選條件，或改用「症狀診斷」。</div>`;
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

function renderDetail(id) {
  const it = state.idx.issue.get(id);
  if (!it) {
    view.innerHTML = `<div class="empty">找不到這個條目。<br><a href="#/">回到首頁</a></div>`;
    return;
  }
  const isNutrient = it.type === 'nutrient';
  const parts = it.parts.map((p) => state.idx.part.get(p)).filter(Boolean);
  const related = (it.related || []).map((r) => state.idx.issue.get(r)).filter(Boolean);
  document.title = `${it.name}｜作物病蟲害檢索`;

  view.innerHTML = `
    <article class="detail">
      <button type="button" class="back" id="back">← 返回</button>
      <header class="detail-head">
        ${typeBadge(it.type)}
        <h2>${esc(it.name)}</h2>
        <p class="sci">${esc(it.en)}${it.sci && it.sci !== it.en && !isNutrient ? ` ・ <i>${esc(it.sci)}</i>` : ''}</p>
        <p class="lead">${esc(it.summary)}</p>
        <div class="meta-row">
          <span class="meta-label">作物</span>
          ${it.crops.map((c) => `<a class="chip small" href="#/?crop=${encodeURIComponent(c === '*' ? '' : c)}">${cropLabel(c)}</a>`).join('')}
        </div>
        <div class="meta-row">
          <span class="meta-label">部位</span>
          ${parts.map((p) => `<span class="chip small static">${p.icon} ${esc(p.name)}</span>`).join('')}
        </div>
      </header>

      <section class="gallery" aria-label="特徵示意圖">
        ${(it.illus || []).map((g, i) => `<figure>${renderIllus(g, it.id + i)}<figcaption>${esc(g.cap || '')}</figcaption></figure>`).join('')}
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
        <p class="hint">以下照片從 Wikimedia Commons 即時搜尋，授權與作者標示於每張照片下方。搜尋結果可能包含不相關的影像，請以示意圖與文字描述為準。</p>
        <button type="button" class="btn" id="load-photos">載入實拍照片</button>
        <div class="photo-grid" id="photo-grid"></div>
      </section>

      ${related.length ? `<section class="block"><h3>🔗 相關條目</h3><div class="related">${related.map((r) => `<a class="rel" href="#/issue/${encodeURIComponent(r.id)}">${typeBadge(r.type)} ${esc(r.name)}</a>`).join('')}</div></section>` : ''}

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
  $('#load-photos').addEventListener('click', () => loadPhotos(it));
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

async function loadPhotos(it) {
  const btn = $('#load-photos');
  const grid = $('#photo-grid');
  btn.disabled = true;
  btn.textContent = '載入中…';
  try {
    let photos = [];
    for (const q of [it.photoQuery, it.en].filter(Boolean)) {
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

function renderWizard() {
  const w = state.wizard;
  const { meta, crops } = state.data;
  document.title = '症狀診斷｜作物病蟲害檢索';

  view.innerHTML = `
    <section class="wizard">
      <h2>🩺 症狀診斷</h2>
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
      .map(({ it, hit, partHit, pct }) => `<a class="diag" href="#/issue/${encodeURIComponent(it.id)}">
        <div class="diag-illus">${renderIllus(it.illus?.[0], it.id)}</div>
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
  $('#wz-reset').addEventListener('click', () => {
    state.wizard = { crop: '', part: '', tags: new Set() };
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
    renderDetail(decodeURIComponent(path.slice('/issue/'.length)));
  } else if (path === '/wizard') {
    searchWrap.hidden = true;
    renderWizard();
  } else if (path === '/about') {
    searchWrap.hidden = true;
    renderAbout();
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
