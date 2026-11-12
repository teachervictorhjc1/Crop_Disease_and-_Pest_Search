// 病害／蟲害／營養缺乏 特徵示意圖產生器
// 以程式繪製 SVG（無版權問題、離線可用、檔案極小）。
// 每個圖由資料中的 illus 規格描述，例如：
//   { "k": "leaf", "shape": "grass", "p": "spindle" }
//   { "k": "fruit", "fruit": "mango", "p": "rot", "spores": true }
//   { "k": "bug", "t": "aphid" }

import { t as tr } from './i18n.js';

const BG = 'var(--illus-bg, #eef5e6)';
const C = {
  leaf: '#5ea842', edge: '#3f7d2b', vein: '#3c7a2a', stalk: '#4d7d2c',
  yellow: '#e4d34f', brown: '#7a4a22', dark: '#3b2a1a',
  soil: '#a9825a', soilDark: '#7d5c3c', water: '#a9cfe6',
};

let seq = 0;
const uid = (p) => `${p}${++seq}`;
const f = (n) => (Math.round(n * 10) / 10).toString();

/** 以字串為種子的可重現亂數（同一條目每次畫出來都一樣） */
function rng(seed) {
  let h = 2166136261 >>> 0;
  for (const ch of String(seed)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619) >>> 0; }
  if (!h) h = 1;
  return () => {
    h ^= h << 13; h >>>= 0; h ^= h >>> 17; h ^= h << 5; h >>>= 0;
    return h / 4294967296;
  };
}

/** 以平滑曲線產生不規則團塊路徑 */
function blob(cx, cy, rad, r, k = 9, jitter = 0.4, sx = 1, sy = 1) {
  const p = [];
  for (let i = 0; i < k; i++) {
    const a = (i / k) * Math.PI * 2;
    const rr = rad * (1 - jitter / 2 + r() * jitter);
    p.push([cx + Math.cos(a) * rr * sx, cy + Math.sin(a) * rr * sy]);
  }
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const m0 = mid(p[0], p[1]);
  let d = `M${f(m0[0])} ${f(m0[1])}`;
  for (let i = 1; i <= k; i++) {
    const c = p[i % k], m = mid(p[i % k], p[(i + 1) % k]);
    d += ` Q${f(c[0])} ${f(c[1])} ${f(m[0])} ${f(m[1])}`;
  }
  return d + 'Z';
}

/** 外框：背景、角落標籤、「示意圖」浮水印 */
function frame(inner, defs = '', tag = '') {
  const t = tag
    ? `<rect x="8" y="8" width="${Math.round([...tag].reduce((w, ch) => w + (/[⺀-￿]/.test(ch) ? 12 : 6.8), 0) + 14)}" height="20" rx="10" fill="#ffffffd9" stroke="#0000001f"/>` +
      `<text x="15" y="22" font-size="12" fill="#2d3a24" font-weight="600">${tag}</text>`
    : '';
  return `<svg viewBox="0 0 200 150" xmlns="http://www.w3.org/2000/svg" class="illus-svg" aria-hidden="true">` +
    `<defs>${defs}</defs><rect width="200" height="150" rx="12" fill="${BG}"/>${inner}${t}` +
    `<text x="193" y="145" font-size="8" text-anchor="end" fill="currentColor" opacity=".45">${tr('示意圖')}</text></svg>`;
}

/* ------------------------------------------------------------------ */
/* 葉片                                                                */
/* ------------------------------------------------------------------ */

const LEAF = {
  broad: {
    d: 'M100 10 C140 25 172 60 160 95 C150 120 120 130 100 132 C80 130 50 120 40 95 C28 60 60 25 100 10 Z',
    veins() {
      let s = 'M100 132 L100 16';
      [[46, 20], [54, 20], [54, 20], [48, 18], [38, 16], [22, 12]].forEach(([dx, dy], i) => {
        const y = 118 - i * 16;
        s += ` M100 ${y} Q${100 - dx * 0.5} ${y - dy * 0.2} ${100 - dx} ${y - dy}`;
        s += ` M100 ${y} Q${100 + dx * 0.5} ${y - dy * 0.2} ${100 + dx} ${y - dy}`;
      });
      return s;
    },
    stalk: `<path d="M100 131 L100 146" stroke="${C.stalk}" stroke-width="3.5" stroke-linecap="round"/>`,
    inside: (x, y) => ((x - 100) / 54) ** 2 + ((y - 72) / 58) ** 2 < 0.78,
    margin: (x, y) => ((x - 100) / 54) ** 2 + ((y - 72) / 58) ** 2 > 0.5,
    box: [40, 14, 160, 130],
  },
  grass: {
    d: 'M6 63 C60 57 140 57 194 74 C140 91 60 91 6 87 Z',
    veins: () => [-8, -4, 0, 4, 8].map((o) => `M6 ${75 + o} Q110 ${74 + o * 0.8} 190 74`).join(' '),
    stalk: '',
    inside: (x, y) => x > 14 && x < 182 && Math.abs(y - 74) < (x < 140 ? 11 : (11 * (184 - x)) / 44),
    margin: (x, y) => Math.abs(y - 74) > 7,
    box: [14, 60, 182, 90],
  },
  lobed: {
    d: 'M100 132 C80 128 40 120 30 98 C18 92 14 70 30 62 C24 44 40 28 60 34 C66 18 86 10 100 18 C114 10 134 18 140 34 C160 28 176 44 170 62 C186 70 182 92 170 98 C160 120 120 128 100 132 Z',
    veins() {
      const tips = [[34, 94], [40, 52], [100, 24], [160, 52], [166, 94]];
      let s = tips.map(([x, y]) => `M100 124 Q${f((100 + x) / 2)} ${f((124 + y) / 2 + 6)} ${x} ${y}`).join(' ');
      // 次級葉脈
      tips.forEach(([x, y]) => {
        const mx = (100 + x) / 2, my = (124 + y) / 2 + 3;
        const nx = -(y - 124), ny = x - 100, len = Math.hypot(nx, ny) || 1;
        s += ` M${f(mx)} ${f(my)} l${f((nx / len) * 16)} ${f((ny / len) * 16 - 6)}`;
        s += ` M${f(mx)} ${f(my)} l${f((-nx / len) * 16)} ${f((-ny / len) * 16 - 6)}`;
      });
      return s;
    },
    stalk: `<path d="M100 128 L100 146" stroke="${C.stalk}" stroke-width="3.5" stroke-linecap="round"/>`,
    inside: (x, y) => ((x - 100) / 64) ** 2 + ((y - 74) / 54) ** 2 < 0.8,
    margin: (x, y) => ((x - 100) / 64) ** 2 + ((y - 74) / 54) ** 2 > 0.5,
    box: [24, 18, 176, 128],
  },
  // 披針形（芒果）
  lance: {
    d: 'M100 8 C126 28 134 66 128 98 C123 118 110 130 100 134 C90 130 77 118 72 98 C66 66 74 28 100 8 Z',
    veins() {
      let s = 'M100 134 L100 14';
      for (let i = 0; i < 9; i++) {
        const y = 124 - i * 12, w = 26 - Math.abs(i - 4) * 2.6 - (i > 6 ? 6 : 0);
        s += ` M100 ${y} Q${f(100 - w * 0.5)} ${y - 6} ${f(100 - w)} ${y - 14} M100 ${y} Q${f(100 + w * 0.5)} ${y - 6} ${f(100 + w)} ${y - 14}`;
      }
      return s;
    },
    stalk: `<path d="M100 133 L100 146" stroke="${C.stalk}" stroke-width="3" stroke-linecap="round"/>`,
    inside: (x, y) => ((x - 100) / 30) ** 2 + ((y - 72) / 60) ** 2 < 0.8,
    margin: (x, y) => ((x - 100) / 30) ** 2 + ((y - 72) / 60) ** 2 > 0.45,
    box: [72, 14, 128, 130],
  },
  // 長橢圓大葉、羽狀平行側脈（香蕉）
  banana: {
    d: 'M14 75 C14 48 34 40 100 40 C166 40 190 50 190 75 C190 100 166 110 100 110 C34 110 14 102 14 75 Z',
    veins() {
      let s = 'M14 75 L190 75';
      for (let x = 22; x < 184; x += 8) s += ` M${x} 75 Q${x + 4} 58 ${x + 10} 42 M${x} 75 Q${x + 4} 92 ${x + 10} 108`;
      return s;
    },
    stalk: `<path d="M16 75 L2 75" stroke="${C.stalk}" stroke-width="6" stroke-linecap="round"/>`,
    inside: (x, y) => ((x - 102) / 88) ** 4 + ((y - 75) / 35) ** 4 < 0.8,
    margin: (x, y) => ((x - 102) / 88) ** 4 + ((y - 75) / 35) ** 4 > 0.3,
    box: [16, 42, 188, 108],
  },
};

/** 由數片小葉組成的複葉（草莓三出複葉），小葉邊緣有鋸齒 */
function compoundLeaf(leaflets, stalk) {
  const local = (lf, x, y) => {
    const a = (-lf.rot * Math.PI) / 180, dx = x - lf.cx, dy = y - lf.cy;
    return [dx * Math.cos(a) - dy * Math.sin(a), dx * Math.sin(a) + dy * Math.cos(a)];
  };
  const world = (lf, u, v) => {
    const a = (lf.rot * Math.PI) / 180;
    return [lf.cx + u * Math.cos(a) - v * Math.sin(a), lf.cy + u * Math.sin(a) + v * Math.cos(a)];
  };
  const norm = (lf, x, y) => { const [u, v] = local(lf, x, y); return (u / lf.rx) ** 2 + (v / lf.ry) ** 2; };
  const d = leaflets.map((lf) => {
    let s = '';
    for (let i = 0; i < 48; i++) {
      const t = (i / 48) * Math.PI * 2;
      const k = i % 2 ? 0.94 : 1.03; // 鋸齒
      const [x, y] = world(lf, Math.cos(t) * lf.rx * k, Math.sin(t) * lf.ry * k);
      s += `${i ? 'L' : 'M'}${f(x)} ${f(y)} `;
    }
    return s + 'Z';
  }).join(' ');
  return {
    d,
    veins() {
      return leaflets.map((lf) => {
        const p = (u, v) => world(lf, u, v).map(f).join(' ');
        let s = `M${p(0, lf.ry)} L${p(0, -lf.ry * 0.92)}`;
        for (let i = 0; i < 5; i++) {
          const v = lf.ry * (0.6 - i * 0.3);
          s += ` M${p(0, v)} L${p(-lf.rx * 0.85, v - lf.ry * 0.28)} M${p(0, v)} L${p(lf.rx * 0.85, v - lf.ry * 0.28)}`;
        }
        return s;
      }).join(' ');
    },
    stalk,
    inside: (x, y) => leaflets.some((lf) => norm(lf, x, y) < 0.78),
    margin: (x, y) => leaflets.some((lf) => { const n = norm(lf, x, y); return n < 0.78 && n > 0.45; }),
    box: [24, 8, 176, 132],
  };
}

LEAF.trifoliate = compoundLeaf(
  [
    { cx: 100, cy: 44, rx: 27, ry: 34, rot: 0 },
    { cx: 60, cy: 94, rx: 25, ry: 31, rot: -58 },
    { cx: 140, cy: 94, rx: 25, ry: 31, rot: 58 },
  ],
  `<path d="M100 146 L100 92 M100 92 L100 78 M100 92 L86 108 M100 92 L114 108" stroke="${C.stalk}" stroke-width="3.2" stroke-linecap="round" fill="none"/>`,
);

/** 在葉片內隨機取點（可設定最小間距） */
function pts(L, r, n, pad = 0, filter) {
  const [x0, y0, x1, y1] = L.box;
  const out = [];
  let guard = 0;
  while (out.length < n && guard++ < n * 120) {
    const x = x0 + r() * (x1 - x0), y = y0 + r() * (y1 - y0);
    if (!L.inside(x, y)) continue;
    if (filter && !filter(x, y)) continue;
    if (pad && out.some((p) => Math.hypot(p[0] - x, p[1] - y) < pad)) continue;
    out.push([x, y]);
  }
  return out;
}

/** 隨機遊走的蛇行路徑（潛葉隧道） */
function walk(L, r, start, steps, step = 4) {
  let [x, y] = start;
  let a = r() * Math.PI * 2;
  let d = `M${f(x)} ${f(y)}`;
  for (let i = 0; i < steps; i++) {
    let tries = 0, nx, ny;
    do {
      a += (r() - 0.5) * 1.3 + (tries ? 0.9 : 0);
      nx = x + Math.cos(a) * step; ny = y + Math.sin(a) * step;
    } while (!L.inside(nx, ny) && ++tries < 12);
    x = nx; y = ny;
    d += ` L${f(x)} ${f(y)}`;
  }
  return d;
}

const BG_FILL = BG;

const LEAF_PATTERNS = {
  // 稻熱病：紡錘形病斑
  spindle(L, r) {
    let over = '';
    for (const [x, y] of pts(L, r, 6, 26)) {
      const len = 9 + r() * 6, w = 2.6 + r() * 1.4;
      over += `<path d="M${f(x - len - 5)} ${f(y)} L${f(x)} ${f(y - w - 2.6)} L${f(x + len + 5)} ${f(y)} L${f(x)} ${f(y + w + 2.6)}Z" fill="#e2cf4a" opacity=".75"/>`;
      over += `<path d="M${f(x - len)} ${f(y)} L${f(x)} ${f(y - w)} L${f(x + len)} ${f(y)} L${f(x)} ${f(y + w)}Z" fill="#ece6cf" stroke="${C.brown}" stroke-width="1.4"/>`;
    }
    return { over };
  },
  // 白葉枯病：葉尖、葉緣波浪狀枯斑
  'margin-blight'() {
    const top = 'M60 40 C80 60 90 64 105 66 C115 70 125 64 135 70 C148 76 160 72 172 78 C180 80 190 76 200 80';
    const bot = 'M110 110 C120 92 130 88 142 86 C155 84 165 88 175 82 C185 79 192 80 200 78';
    return {
      over: `<path d="${top} L200 40 Z" fill="#efe8b5"/><path d="${bot} L200 110 Z" fill="#efe8b5"/>` +
        `<path d="M160 50 L200 50 L200 100 L170 100 C176 90 178 80 172 76 Z" fill="#dcd8c8"/>` +
        `<path d="${top}" fill="none" stroke="#c9a43a" stroke-width="2"/><path d="${bot}" fill="none" stroke="#c9a43a" stroke-width="2"/>`,
    };
  },
  // 晚疫病：大型水浸狀褐斑，周緣白黴
  blight(L, r) {
    let under = '';
    for (const [x, y, rad] of [[80, 58, 22], [124, 96, 15]]) {
      under += `<path d="${blob(x, y, rad + 8, r)}" fill="#a9c860" opacity=".85"/>`;
      under += `<path d="${blob(x, y, rad + 3, r)}" fill="none" stroke="#f6f6ef" stroke-width="3.5" stroke-dasharray="1.2 1.8"/>`;
      under += `<path d="${blob(x, y, rad, r)}" fill="#4a3424"/><path d="${blob(x - 2, y - 2, rad * 0.6, r)}" fill="#5d4330"/>`;
    }
    return { under };
  },
  // 一般病斑（可加黃暈、同心輪紋、隆起）
  spots(L, r, o) {
    const n = o.n || 6, R0 = o.r || 6, color = o.color || C.brown;
    let over = '';
    for (const [x, y] of pts(L, r, n, R0 * 2.8)) {
      const R = R0 * (0.7 + r() * 0.6);
      if (o.halo) over += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(R + 3.8)}" fill="${C.yellow}" opacity=".85"/>`;
      if (o.raised) {
        over += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(R)}" fill="#b0864e" stroke="#6d4a22" stroke-width="1.1"/>`;
        over += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(R * 0.45)}" fill="#7d5a2e"/>`;
        for (let i = 0; i < 4; i++) over += `<circle cx="${f(x + (r() - 0.5) * R)}" cy="${f(y + (r() - 0.5) * R)}" r=".7" fill="#5a3a18"/>`;
      } else {
        over += o.irregular
          ? `<path d="${blob(x, y, R, r, 8, 0.6)}" fill="${color}"/>`
          : `<circle cx="${f(x)}" cy="${f(y)}" r="${f(R)}" fill="${color}"/>`;
      }
      if (o.rings) for (let k = 1; k <= 3; k++) over += `<circle cx="${f(x)}" cy="${f(y)}" r="${f((R * k) / 3.4)}" fill="none" stroke="#2e1b0d" stroke-width=".8"/>`;
    }
    return { over };
  },
  // 露菌病：受葉脈限制的多角形黃斑
  angular(L, r) {
    let over = '';
    for (const [x, y] of pts(L, r, 15, 15)) {
      const k = 5 + Math.floor(r() * 2), R = 6 + r() * 4;
      let d = '';
      for (let i = 0; i < k; i++) {
        const a = (i / k) * Math.PI * 2 + r() * 0.5;
        d += `${i ? 'L' : 'M'}${f(x + Math.cos(a) * R)} ${f(y + Math.sin(a) * R)} `;
      }
      over += `<path d="${d}Z" fill="${r() < 0.3 ? '#b58f3c' : '#e3d24a'}" opacity=".95"/>`;
    }
    return { over };
  },
  // 白粉病
  powdery(L, r) {
    const fid = uid('blur');
    let over = '';
    for (const [x, y] of pts(L, r, 12, 18)) {
      over += `<circle cx="${f(x)}" cy="${f(y)}" r="11" fill="#d6dc7a" opacity=".45"/>`;
      for (let i = 0; i < 9; i++) {
        over += `<circle cx="${f(x + (r() - 0.5) * 16)}" cy="${f(y + (r() - 0.5) * 16)}" r="${f(2 + r() * 5)}" fill="#f8f8f3" opacity="${f(0.55 + r() * 0.35)}"/>`;
      }
    }
    return { defs: `<filter id="${fid}"><feGaussianBlur stdDeviation="1.1"/></filter>`, over: `<g filter="url(#${fid})">${over}</g>` };
  },
  // 嵌紋（病毒）
  mosaic(L, r) {
    let under = '';
    for (const [x, y] of pts(L, r, 16, 12)) under += `<path d="${blob(x, y, 7 + r() * 8, r)}" fill="#cbe07c" opacity=".95"/>`;
    for (const [x, y] of pts(L, r, 6, 20)) under += `<path d="${blob(x, y, 6 + r() * 6, r)}" fill="#3d8429"/>`;
    let over = '';
    for (let i = 0; i < 7; i++) {
      const [x, y] = pts(L, r, 1)[0] || [100, 70];
      over += `<path d="M${f(x)} ${f(y)} q8 -4 14 2 t14 0" fill="none" stroke="#2f6b22" stroke-width="1" opacity=".45"/>`;
    }
    return { under, over };
  },
  // 黃龍病：左右不對稱黃綠斑駁
  blotchy(L, r) {
    let under = '';
    for (const [x, y] of pts(L, r, 9, 10, (x) => x < 102)) under += `<path d="${blob(x, y, 9 + r() * 8, r, 9, 0.7)}" fill="#5ea842"/>`;
    for (const [x, y] of pts(L, r, 2, 20, (x) => x > 110)) under += `<path d="${blob(x, y, 6 + r() * 5, r, 9, 0.7)}" fill="#6fae47"/>`;
    return { fill: '#d7cf5e', vein: '#b3a73c', under };
  },
  // 黑腐病：葉緣 V 字形病斑，葉脈變黑
  'v-lesion'() {
    const v1 = 'M164 58 Q150 74 104 80 Q150 90 162 106 Z';
    const v2 = 'M44 38 Q60 50 94 52 Q62 60 40 70 Z';
    const veins = 'M106 80 L156 66 M106 80 L158 92 M120 80 L150 78 M130 82 L148 98 M92 52 L54 42 M92 52 L52 64 M80 52 L60 54';
    return {
      over: `<path d="${v1}" fill="#e6d34a"/><path d="${v2}" fill="#e6d34a"/>` +
        `<path d="M162 70 Q148 80 132 81 Q148 86 160 96 Z" fill="#b58a3a"/>` +
        `<path d="${veins}" stroke="#1d1a14" stroke-width="1.4" fill="none" stroke-linecap="round"/>`,
    };
  },
  // 銹病：密集橙色孢子堆
  rust(L, r) {
    let over = '';
    for (const [x, y] of pts(L, r, 70, 4.2)) {
      over += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="2.4" ry="1.5" fill="#dc842c" stroke="#9a5414" stroke-width=".6"/>`;
    }
    return { over };
  },
  // 葡萄露菌病：油斑 + 葉背白霜黴小插圖
  oilspot(L, r) {
    const fid = uid('blur');
    let over = '';
    for (const [x, y] of pts(L, r, 6, 26)) {
      const R = 9 + r() * 5;
      over += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(R)}" fill="#ece070" opacity=".85" filter="url(#${fid})"/>`;
      if (r() < 0.4) over += `<path d="${blob(x, y, R * 0.45, r)}" fill="#a5803a"/>`;
    }
    let fuzz = '';
    for (let i = 0; i < 26; i++) fuzz += `<circle cx="${f(172 + (r() - 0.5) * 22)}" cy="${f(120 + (r() - 0.5) * 22)}" r="${f(1 + r() * 2)}" fill="#fff" opacity=".9"/>`;
    return {
      defs: `<filter id="${fid}"><feGaussianBlur stdDeviation="1.6"/></filter>`,
      over,
      outside: `<circle cx="172" cy="120" r="19" fill="#93bf73" stroke="#3f7d2b"/>${fuzz}<text x="172" y="146" font-size="9" text-anchor="middle" fill="currentColor">${tr('葉背')}</text>`,
    };
  },
  // 食痕：chew 大缺刻、window 天窗、shot 小圓孔
  holes(L, r, o) {
    let top = '', over = '';
    if (o.style === 'shot') {
      for (const [x, y] of pts(L, r, 42, 7)) top += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(1.6 + r() * 1.6)}" fill="${BG_FILL}" stroke="#9a6d3c" stroke-width=".7"/>`;
    } else if (o.style === 'window') {
      for (const [x, y] of pts(L, r, 8, 20)) over += `<path d="${blob(x, y, 6 + r() * 6, r, 8, 0.6)}" fill="#eef2d6" stroke="#c9d39a" stroke-width="1"/>`;
      for (const [x, y] of pts(L, r, 3, 30)) top += `<path d="${blob(x, y, 4 + r() * 3, r)}" fill="${BG_FILL}" stroke="#9a8a5a" stroke-width=".7"/>`;
    } else {
      const n = L === LEAF.grass ? 6 : 7;
      for (const [x, y] of pts(L, r, n, 22, L === LEAF.grass ? null : L.margin)) {
        top += `<path d="${blob(x, y, 9 + r() * 9, r, 10, 0.7)}" fill="${BG_FILL}" stroke="#8a6a3a" stroke-width=".8"/>`;
      }
      if (L === LEAF.grass) for (const [x, y] of pts(L, r, 14, 5)) over += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(1 + r() * 1.3)}" fill="#7a5a2a"/>`;
    }
    return { over, top };
  },
  // 煤煙病
  sooty(L, r) {
    let over = '';
    for (const [x, y] of pts(L, r, 8, 16)) over += `<path d="${blob(x, y, 9 + r() * 10, r, 10, 0.7)}" fill="#262626" opacity=".78"/>`;
    for (const [x, y] of pts(L, r, 40)) over += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(0.6 + r() * 1.2)}" fill="#1a1a1a" opacity=".7"/>`;
    return { fill: '#7aa84a', over };
  },
  // 銀葉症
  silverleaf(L, r) {
    let over = '';
    for (let i = 0; i < 10; i++) {
      const [x, y] = pts(L, r, 1)[0] || [100, 70];
      over += `<path d="M${f(x)} ${f(y)} l${f(10 + r() * 14)} ${f(-4 - r() * 6)}" stroke="#fff" stroke-width="2" opacity=".55" stroke-linecap="round"/>`;
    }
    return { fill: '#c4d2c0', vein: '#6a9a55', over };
  },
  // 薊馬：銀白／褐色擦痕
  silver(L, r) {
    let over = '';
    for (const [x, y] of pts(L, r, 28, 8)) {
      const a = r() * Math.PI, len = 5 + r() * 9;
      const col = r() < 0.25 ? '#a58456' : '#eef2ea';
      over += `<path d="M${f(x)} ${f(y)} l${f(Math.cos(a) * len)} ${f(Math.sin(a) * len)}" stroke="${col}" stroke-width="2.8" stroke-linecap="round" opacity=".9"/>`;
    }
    for (const [x, y] of pts(L, r, 24)) over += `<circle cx="${f(x)}" cy="${f(y)}" r=".8" fill="#1b1b1b"/>`;
    return { over };
  },
  // 葉蟎：密集褪色小點 + 細絲
  stipple(L, r) {
    let over = `<path d="${blob(100, 74, 34, r, 10, 0.5)}" fill="#c9d36a" opacity=".55"/>`;
    for (const [x, y] of pts(L, r, 380)) over += `<circle cx="${f(x)}" cy="${f(y)}" r=".9" fill="#f3f1c8" opacity=".9"/>`;
    let web = '';
    for (let i = 0; i < 9; i++) {
      web += `<path d="M${f(118 + r() * 50)} ${f(16 + r() * 30)} L${f(140 + r() * 50)} ${f(30 + r() * 40)}" stroke="#fff" stroke-width=".7" opacity=".75"/>`;
    }
    for (let i = 0; i < 5; i++) web += `<circle cx="${f(130 + r() * 40)}" cy="${f(28 + r() * 30)}" r="1.4" fill="#c0452a"/>`;
    return { over, outside: web };
  },
  // 斑潛蠅：蛇行隧道
  mines(L, r) {
    let over = '';
    for (const s of [[70, 100], [122, 46]]) {
      const d = walk(L, r, s, 40, 3.6);
      over += `<path d="${d}" fill="none" stroke="#f2efd6" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`;
      over += `<path d="${d}" fill="none" stroke="#3a3a2a" stroke-width=".9" stroke-dasharray="2 3"/>`;
    }
    for (const [x, y] of pts(L, r, 14, 6)) over += `<circle cx="${f(x)}" cy="${f(y)}" r="1.1" fill="#f6f4df"/>`;
    return { over };
  },
  // 稻縱捲葉蟲：縱捲成筒 + 白色條斑
  rolled() {
    return {
      over: `<path d="M136 66 L176 70 M138 74 L182 74 M136 82 L176 78" stroke="#f1f1e4" stroke-width="2.6" stroke-linecap="round"/>`,
      outside: `<rect x="54" y="60" width="78" height="28" rx="14" fill="#6fb350" stroke="${C.edge}"/>` +
        `<path d="M64 62 Q72 74 64 86 M82 61 Q90 74 82 87 M100 61 Q108 74 100 87 M118 62 Q126 74 118 86" stroke="#ffffffaa" stroke-width=".8" fill="none"/>` +
        `<path d="M58 70 L132 70 M58 78 L132 78" stroke="#4f8a35" stroke-width=".8"/>` +
        `<circle cx="132" cy="74" r="4" fill="#8fc76a" stroke="#3b6a2a"/>`,
    };
  },
  // 均勻黃化（缺氮、缺硫）
  chlorosis(L, r, o) {
    return { fill: o.color || '#d9d06a', vein: '#b9ad45', edge: '#a99d3a' };
  },
  // 缺磷：暗綠帶紫紅
  purple(L) {
    return {
      fill: '#2f6e2c', vein: '#244f1f',
      under: `<path d="${L.d}" fill="none" stroke="#7b3f8c" stroke-width="28" opacity=".8"/><rect width="200" height="150" fill="#6a3a7a" opacity=".18"/>`,
    };
  },
  // 葉緣焦枯（缺鉀、缺鈣）
  scorch(L) {
    return {
      under: `<path d="${L.d}" fill="none" stroke="${C.yellow}" stroke-width="34"/><path d="${L.d}" fill="none" stroke="#8a5a2b" stroke-width="15"/>`,
    };
  },
  // 葉脈間黃化（缺鎂、缺鐵、缺錳、缺鋅）
  interveinal(L, r, o) {
    const fid = uid('blur');
    const fill = o.pale ? '#f1edb6' : o.soft ? '#d8dc86' : '#e4d84f';
    const band = o.wide ? 10 : o.soft ? 9 : o.pale ? 3 : 6;
    let under = `<path d="${L.veins()}" fill="none" stroke="#58a03e" stroke-width="${band}" stroke-linecap="round" ${o.soft ? `filter="url(#${fid})"` : ''}/>`;
    if (o.mottled) for (const [x, y] of pts(L, r, 10, 14)) under += `<path d="${blob(x, y, 4 + r() * 4, r)}" fill="#7ab655"/>`;
    if (o.soft) for (const [x, y] of pts(L, r, 10, 14)) under += `<circle cx="${f(x)}" cy="${f(y)}" r="1.4" fill="#8a5a2b"/>`;
    return {
      fill, vein: '#3c7a2a', veinW: o.pale ? 1.1 : 1.4, under,
      defs: `<filter id="${fid}"><feGaussianBlur stdDeviation="2"/></filter>`,
    };
  },
};

/** 黃化捲葉：向上捲曲成杯狀的小葉 */
function curlSVG(o) {
  const cup = (tx, ty, s) => `<g transform="translate(${tx} ${ty}) scale(${s})">` +
    `<path d="M0 36 L0 58" stroke="${C.stalk}" stroke-width="3.5" stroke-linecap="round"/>` +
    `<path d="M-40 -4 C-34 26 -12 40 0 40 C12 40 34 26 40 -4 C24 6 -24 6 -40 -4Z" fill="#5a9e3c" stroke="${C.edge}"/>` +
    `<path d="M0 39 L0 4 M-6 34 L-28 6 M6 34 L28 6" stroke="${C.vein}" stroke-width="1.2" fill="none"/>` +
    `<ellipse cx="0" cy="-4" rx="40" ry="11" fill="#86c25e" stroke="#e2d04a" stroke-width="4"/>` +
    `<path d="M-36 -4 q6 -5 12 0 t12 0 t12 0 t12 0 t12 0" stroke="#d8c840" stroke-width="2" fill="none"/>` +
    `</g>`;
  return frame(cup(78, 62, 1) + cup(150, 84, 0.62), '', o.tag);
}

function leafSVG(o, seed) {
  if (o.p === 'curl') return curlSVG(o);
  const L = LEAF[o.shape || 'broad'] || LEAF.broad;
  const r = rng(seed);
  const clip = uid('lc');
  const res = (LEAF_PATTERNS[o.p] || (() => ({})))(L, r, o) || {};
  const defs = `<clipPath id="${clip}"><path d="${L.d}"/></clipPath>${res.defs || ''}`;
  const body =
    `${L.stalk}<path d="${L.d}" fill="${res.fill || C.leaf}"/>` +
    `<g clip-path="url(#${clip})">${res.under || ''}` +
    `<path d="${L.veins()}" fill="none" stroke="${res.vein || C.vein}" stroke-width="${res.veinW ?? 1.4}" stroke-linecap="round"/>` +
    `${res.over || ''}</g>` +
    `<path d="${L.d}" fill="none" stroke="${res.edge || C.edge}" stroke-width="1.3"/>` +
    (res.top ? `<g clip-path="url(#${clip})">${res.top}</g>` : '') +
    (res.outside || '');
  return frame(body, defs, o.tag);
}

/* ------------------------------------------------------------------ */
/* 果實                                                                */
/* ------------------------------------------------------------------ */

const ell = (cx, cy, rx, ry) => `M${cx - rx} ${cy} a${rx} ${ry} 0 1 0 ${rx * 2} 0 a${rx} ${ry} 0 1 0 ${-rx * 2} 0Z`;

const FRUIT = {
  tomato: { d: ell(100, 82, 52, 46), color: '#d83a2a', hi: '#f37a5c', top: 'calyx', ty: 38 },
  citrus: { d: ell(100, 82, 47, 46), color: '#ef9a2c', hi: '#ffcb6a', top: 'stem', ty: 36, pores: true },
  mango: { d: 'M70 40 C100 18 152 38 154 84 C156 126 112 142 80 128 C50 116 44 60 70 40Z', color: '#e3bf45', hi: '#b6c853', top: 'stem', ty: 34, tx: 82 },
  strawberry: { d: 'M100 136 C62 116 48 66 66 48 C80 36 120 36 134 48 C152 66 138 116 100 136Z', color: '#d8283a', hi: '#f26070', top: 'calyx', ty: 42, seeds: true },
  papaya: { d: ell(100, 82, 40, 56), color: '#a9c24a', hi: '#e8cb52', top: 'stem', ty: 26 },
  pepper: { d: 'M78 40 C68 70 80 112 100 138 C120 112 132 70 122 40 C112 33 88 33 78 40Z', color: '#c8231e', hi: '#ee5a48', top: 'pstem', ty: 36 },
  cucurbit: { d: ell(100, 80, 80, 30), color: '#4c8c3a', hi: '#8fc06a', top: 'side', stripes: true },
  eggplant: { d: 'M86 36 C64 50 56 94 72 122 C86 144 126 142 138 118 C150 92 130 54 114 40 C106 33 94 32 86 36Z', color: '#4e2160', hi: '#9361ad', top: 'calyx', ty: 38, tx: 100 },
  guava: { d: 'M100 32 C126 32 150 54 150 86 C150 116 128 134 100 134 C72 134 50 116 50 86 C50 54 74 32 100 32Z', color: '#9cc04e', hi: '#e2eea0', top: 'stem', ty: 32 },
  banana: { d: 'M34 58 C62 98 132 106 174 66 C180 62 186 66 182 74 C146 124 62 122 28 68 C25 62 30 55 34 58Z', color: '#e2c43a', hi: '#f6ea94', top: 'bstem' },
};

const FRUIT_LESIONS = {
  greasy(F, r) {
    return `<path d="${blob(84, 70, 28, r, 10, 0.5)}" fill="#7a5a30" opacity=".92"/>` +
      `<path d="M66 64 q8 -6 16 0 t16 0 M70 76 q8 -6 16 0 t16 0" stroke="#5a3e20" stroke-width="1.5" fill="none"/>`;
  },
  rot(F, r, o) {
    let s = '';
    for (const [x, y, R] of [[92, 78, 21], [128, 106, 11]]) {
      s += `<circle cx="${x}" cy="${y}" r="${R + 2}" fill="#6a4a2a" opacity=".6"/><circle cx="${x}" cy="${y}" r="${R}" fill="#3b2616"/>`;
      s += `<circle cx="${x}" cy="${y}" r="${f(R * 0.7)}" fill="none" stroke="#21140b" stroke-width="1"/><circle cx="${x}" cy="${y}" r="${f(R * 0.4)}" fill="none" stroke="#21140b" stroke-width="1"/>`;
      if (o.spores) for (let i = 0; i < R; i++) {
        const a = r() * 6.28, d = r() * R * 0.85;
        s += `<circle cx="${f(x + Math.cos(a) * d)}" cy="${f(y + Math.sin(a) * d)}" r="${f(0.9 + r() * 1.2)}" fill="#f2875a"/>`;
      }
    }
    return s;
  },
  canker(F, r) {
    let s = '';
    for (let i = 0; i < 9; i++) {
      const x = 66 + r() * 68, y = 50 + r() * 64, R = 3 + r() * 3;
      s += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(R + 3)}" fill="#e7d35a" opacity=".9"/><circle cx="${f(x)}" cy="${f(y)}" r="${f(R)}" fill="#a07845" stroke="#6d4a22"/><circle cx="${f(x)}" cy="${f(y)}" r="${f(R * 0.4)}" fill="#6d4a22"/>`;
    }
    return s;
  },
  mold(F, r) {
    let s = `<path d="${blob(110, 76, 32, r, 10, 0.4)}" fill="#a8775a"/>`;
    for (let i = 0; i < 80; i++) {
      const a = r() * 6.28, d = r() * 28;
      s += `<circle cx="${f(110 + Math.cos(a) * d)}" cy="${f(76 + Math.sin(a) * d)}" r="${f(1.4 + r() * 2.4)}" fill="${r() < 0.5 ? '#9b9b93' : '#c4c4ba'}" opacity=".95"/>`;
    }
    return s;
  },
  ringspot(F, r) {
    let s = '';
    for (let i = 0; i < 11; i++) {
      const x = 74 + r() * 52, y = 40 + r() * 86, R = 3.5 + r() * 3;
      s += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(R)}" fill="none" stroke="#4e7d26" stroke-width="1.8"/><circle cx="${f(x)}" cy="${f(y)}" r="1" fill="#4e7d26"/>`;
    }
    return s;
  },
  whitemold(F, r) {
    let s = `<path d="${blob(98, 92, 28, r, 10, 0.5)}" fill="#7d5636" opacity=".85"/>`;
    for (let i = 0; i < 50; i++) {
      const a = r() * 6.28, d = r() * 24;
      s += `<circle cx="${f(98 + Math.cos(a) * d)}" cy="${f(92 + Math.sin(a) * d)}" r="${f(1.2 + r() * 2.2)}" fill="#fbfbf6" opacity=".9"/>`;
    }
    return s;
  },
  sting(F, r, o, name) {
    let s = '';
    const pts0 = name === 'cucurbit' ? [[60, 72], [86, 88], [118, 70], [140, 90]] : [[86, 60], [118, 70], [100, 92], [130, 100]];
    for (const [x, y] of pts0) {
      s += `<circle cx="${x}" cy="${y}" r="4.5" fill="#c99a3a" opacity=".75"/><circle cx="${x}" cy="${y}" r="1.2" fill="#2b1a0b"/>`;
      if (name === 'cucurbit') s += `<path d="M${x} ${y + 2} q-2 5 0 8 q2 -3 0 -8Z" fill="#f0c247" stroke="#c0901c" stroke-width=".5"/>`;
    }
    s += `<path d="${blob(name === 'cucurbit' ? 150 : 82, name === 'cucurbit' ? 74 : 104, 13, r)}" fill="#6a4a2a" opacity=".85"/>`;
    return s;
  },
  scar(F, r) {
    let s = `<path d="${blob(110, 92, 26, r, 10, 0.6, 1.2, 0.8)}" fill="#9a7448" opacity=".85"/>`;
    for (let i = 0; i < 14; i++) {
      const x = 90 + r() * 40, y = 80 + r() * 26;
      s += `<path d="M${f(x)} ${f(y)} l${f(4 + r() * 6)} ${f((r() - 0.5) * 4)}" stroke="#6d4f2c" stroke-width="1"/>`;
    }
    return s;
  },
  'blossom-end'() {
    return `<ellipse cx="100" cy="117" rx="31" ry="15" fill="#6a4a2a"/><ellipse cx="100" cy="119" rx="25" ry="11" fill="#2f1f12"/>` +
      `<path d="M84 117 q8 -3 16 0 t16 0" stroke="#4d3520" stroke-width="1.2" fill="none"/>`;
  },
  crack() {
    return `<g stroke-linecap="round" fill="none">` +
      `<path d="M100 40 C92 56 86 70 76 82 M100 40 C108 58 120 66 128 84 M100 40 C100 60 102 80 98 98" stroke="#7a3a1a" stroke-width="3.2"/>` +
      `<path d="M100 40 C92 56 86 70 76 82 M100 40 C108 58 120 66 128 84 M100 40 C100 60 102 80 98 98" stroke="#f0b47a" stroke-width="1.1"/>` +
      `<path d="M70 50 C84 40 116 40 130 50" stroke="#7a3a1a" stroke-width="2.4"/></g>`;
  },
};

function fruitTop(F, name) {
  const x = F.tx || 100, y = F.ty || 36;
  if (F.top === 'calyx') {
    let s = '';
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
      s += `<path d="M${x} ${y} L${f(x + Math.cos(a) * 18)} ${f(y + Math.sin(a) * 8 + 2)}" stroke="#3f8a2a" stroke-width="5" stroke-linecap="round"/>`;
    }
    return s + `<path d="M${x} ${y} L${x + 2} ${y - 12}" stroke="#3f8a2a" stroke-width="4" stroke-linecap="round"/>`;
  }
  if (F.top === 'pstem') return `<path d="M100 38 C100 26 106 18 116 14" stroke="#3f8a2a" stroke-width="5" fill="none" stroke-linecap="round"/><ellipse cx="100" cy="38" rx="20" ry="6" fill="#4f9a38"/>`;
  if (F.top === 'side') return `<path d="M20 78 L6 72" stroke="#3f8a2a" stroke-width="5" stroke-linecap="round"/>`;
  if (F.top === 'bstem') return `<path d="M32 60 L18 46" stroke="#7a6a2a" stroke-width="7" stroke-linecap="round"/><path d="M180 70 l6 2" stroke="#3b2a1a" stroke-width="4" stroke-linecap="round"/>`;
  return `<path d="M${x} ${y + 2} L${x + 3} ${y - 10}" stroke="#6b4a2a" stroke-width="3.5" stroke-linecap="round"/><path d="M${x + 3} ${y - 8} C${x + 16} ${y - 18} ${x + 30} ${y - 12} ${x + 34} ${y - 4} C${x + 20} ${y - 2} ${x + 10} ${y - 4} ${x + 3} ${y - 8}Z" fill="#4f9a38"/>`;
}

function grapeSVG(o, seed) {
  const r = rng(seed);
  const gid = uid('gg');
  let s = `<path d="M100 14 L100 34 M100 26 L120 16" stroke="#6b4a2a" stroke-width="3" fill="none"/>`;
  const rows = [6, 6, 5, 5, 4, 3, 2, 1];
  rows.forEach((n, ri) => {
    for (let i = 0; i < n; i++) {
      const x = 100 + (i - (n - 1) / 2) * 19 + (r() - 0.5) * 3, y = 40 + ri * 13;
      const bad = o.p && r() < 0.42;
      const scar = o.p === 'scar' || o.p === 'sting';
      const fill = !bad || scar ? `url(#${gid})` : o.p === 'rot' ? '#5a3a22' : '#8a6a42';
      s += `<circle cx="${f(x)}" cy="${f(y)}" r="10.5" fill="${fill}" stroke="${bad && !scar ? '#5d4326' : '#6e8f3a'}"/>`;
      if (bad && o.p === 'downy') {
        s += `<path d="M${f(x - 5)} ${f(y - 2)} q5 4 10 0" stroke="#5d4326" fill="none"/>`;
        for (let k = 0; k < 6; k++) s += `<circle cx="${f(x + (r() - 0.5) * 12)}" cy="${f(y + (r() - 0.5) * 12)}" r="1.3" fill="#fbfbf6"/>`;
      } else if (bad && scar) {
        s += `<path d="M${f(x - 6)} ${f(y + 1)} q4 -5 9 -2 t4 3" stroke="#8a6234" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;
      } else if (bad && (o.p === 'mold' || o.p === 'whitemold' || o.p === 'rot')) {
        const dot = o.p === 'rot' ? (o.spores ? '#f2875a' : '#2a1a0e') : o.p === 'mold' ? '#b4b4aa' : '#fbfbf6';
        for (let k = 0; k < 7; k++) s += `<circle cx="${f(x + (r() - 0.5) * 13)}" cy="${f(y + (r() - 0.5) * 13)}" r="1.4" fill="${dot}"/>`;
      }
    }
  });
  const defs = `<radialGradient id="${gid}" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#d6ea9a"/><stop offset="1" stop-color="#93b552"/></radialGradient>`;
  return frame(s, defs, o.tag);
}

function fruitSVG(o, seed) {
  if (o.fruit === 'grape') return grapeSVG(o, seed);
  const F = FRUIT[o.fruit] || FRUIT.tomato;
  const r = rng(seed);
  const clip = uid('fc'), gid = uid('fg');
  let d = F.d;
  let grad = `<radialGradient id="${gid}" cx=".35" cy=".3" r=".85"><stop offset="0" stop-color="${F.hi}"/><stop offset="1" stop-color="${F.color}"/></radialGradient>`;
  if (o.p === 'hlb') {
    d = 'M100 34 C140 34 150 70 146 92 C140 120 115 130 98 128 C76 126 56 112 54 86 C52 60 66 34 100 34Z';
    grad = `<linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f0a030"/><stop offset=".42" stop-color="#e2a83c"/><stop offset=".7" stop-color="#8db53e"/><stop offset="1" stop-color="#6e9e34"/></linearGradient>`;
  }
  let deco = '';
  if (F.pores) for (let i = 0; i < 40; i++) deco += `<circle cx="${f(60 + r() * 80)}" cy="${f(40 + r() * 84)}" r=".8" fill="#00000022"/>`;
  if (F.seeds) for (let i = 0; i < 26; i++) deco += `<ellipse cx="${f(68 + r() * 64)}" cy="${f(52 + r() * 70)}" rx="1.4" ry="2" fill="#f4d35e"/>`;
  if (F.stripes) for (const y of [62, 72, 82, 92]) deco += `<path d="M24 ${y} Q100 ${y + (y - 77) * 0.25} 176 ${y}" stroke="#a7d07e" stroke-width="2.5" fill="none" opacity=".75"/>`;
  const lesion = (FRUIT_LESIONS[o.p] || (() => ''))(F, r, o, o.fruit);
  const body = `<path d="${d}" fill="url(#${gid})" stroke="#00000033"/>` +
    `<g clip-path="url(#${clip})">${deco}${lesion}<ellipse cx="78" cy="58" rx="14" ry="8" fill="#ffffff" opacity=".22"/></g>` +
    fruitTop(F, o.fruit);
  return frame(body, `<clipPath id="${clip}"><path d="${d}"/></clipPath>${grad}`, o.tag);
}

/* ------------------------------------------------------------------ */
/* 植株                                                                */
/* ------------------------------------------------------------------ */

const leafPath = (len) => `M0 0 C${f(len * 0.3)} ${f(-len * 0.3)} ${f(len * 0.75)} ${f(-len * 0.26)} ${len} 0 C${f(len * 0.75)} ${f(len * 0.26)} ${f(len * 0.3)} ${f(len * 0.3)} 0 0Z`;
const leafAt = (x, y, ang, len, fill, stroke = '#00000030') =>
  `<path d="${leafPath(len)}" transform="translate(${f(x)} ${f(y)}) rotate(${f(ang)})" fill="${fill}" stroke="${stroke}"/>`;
const ground = `<rect x="0" y="128" width="200" height="22" fill="${C.soil}"/><path d="M0 128 H200" stroke="${C.soilDark}" stroke-width="2"/>`;

/** 禾本科植株（水稻、玉米）：由外而內、由老到新的弧形長葉；colorAt(0) 為最老的葉 */
function grassPlant(cx, scale, colorAt) {
  let s = `<path d="M${cx} 130 L${cx} ${f(130 - 70 * scale)}" stroke="#4d8a2e" stroke-width="${f(6 * scale + 1)}" stroke-linecap="round"/>`;
  [[66, 50], [56, 72], [44, 92], [28, 106], [10, 114]].forEach(([sx, h], i) => {
    const col = colorAt(i);
    for (const side of [-1, 1]) {
      const dx = sx * scale * side, hh = h * scale;
      const tipY = 130 - hh * (i < 2 ? 0.5 : 0.9);
      s += `<path d="M${cx} 128 Q${f(cx + dx * 0.3)} ${f(130 - hh)} ${f(cx + dx)} ${f(tipY)}" stroke="${col}" stroke-width="${f(5 * scale + 1.5)}" fill="none" stroke-linecap="round"/>`;
    }
  });
  return s;
}

function basicPlant(cx, scale, colorAt, droop = 0, form = '') {
  if (form === 'grass') return grassPlant(cx, scale, colorAt);
  const levels = [118, 98, 78, 58, 40];
  let s = `<path d="M${cx} 130 L${cx} ${f(130 - 100 * scale)}" stroke="#4d8a2e" stroke-width="${f(4 * scale + 1)}" stroke-linecap="round"/>`;
  levels.forEach((y0, i) => {
    const y = 130 - (130 - y0) * scale;
    const len = (40 - i * 4.5) * scale;
    const col = colorAt(i);
    s += leafAt(cx + 1, y, -25 + droop, len, col) + leafAt(cx - 1, y - 6 * scale, 205 - droop, len, col);
  });
  return s;
}

const PLANT_STATES = {
  old(o) {
    const c = o.color || C.yellow;
    return basicPlant(100, 1, (i) => (i < 2 ? c : i === 2 ? '#9fbf52' : C.leaf), 0, o.form) +
      `<path d="M150 124 L150 92" stroke="currentColor" stroke-width="1.5" marker-end="url(#arr)" opacity=".7"/><text x="156" y="112" font-size="11" fill="currentColor">${tr('老葉')}</text>`;
  },
  young(o) {
    const c = o.color || '#ece79a';
    return basicPlant(100, 1, (i) => (i > 2 ? c : i === 2 ? '#9fbf52' : C.leaf), 0, o.form) +
      `<text x="150" y="40" font-size="11" fill="currentColor">${tr('新葉')}</text>`;
  },
  wilt() {
    let s = `<path d="M100 130 C100 90 104 60 120 48 C128 44 132 52 128 62" stroke="#5d8a33" stroke-width="5" fill="none" stroke-linecap="round"/>`;
    [[100, 110, 30], [101, 92, 28], [104, 74, 24], [112, 58, 20]].forEach(([x, y, len]) => {
      s += leafAt(x, y, 70, len, '#5f9a3a') + leafAt(x, y - 2, 115, len, '#5f9a3a');
    });
    return s;
  },
  stunt(o) {
    let s = basicPlant(150, 1, () => C.leaf, 0, o.form);
    s += `<g opacity=".95">${basicPlant(62, 0.5, (i) => (i > 2 ? '#d8cf4a' : '#6aa646'), 0, o.form)}</g>`;
    s += `<text x="62" y="146" font-size="10" text-anchor="middle" fill="#fff">${tr('罹病株')}</text><text x="150" y="146" font-size="10" text-anchor="middle" fill="#fff">${tr('健康株')}</text>`;
    return s;
  },
  tipdie(o) {
    return basicPlant(100, 1, (i) => (i === 4 ? '#7a5a2a' : i === 3 ? '#a5b04a' : C.leaf), 0, o.form) +
      `<circle cx="100" cy="30" r="6" fill="#4a2e18"/><text x="114" y="26" font-size="11" fill="currentColor">${tr('生長點壞死')}</text>`;
  },
  rosette() {
    let s = `<path d="M100 130 L100 52" stroke="#4d8a2e" stroke-width="5" stroke-linecap="round"/>`;
    s += leafAt(101, 112, -22, 38, C.leaf) + leafAt(99, 106, 202, 38, C.leaf) + leafAt(101, 88, -24, 32, '#76b04f') + leafAt(99, 82, 204, 32, '#76b04f');
    for (let i = 0; i < 10; i++) s += leafAt(100, 54 + (i % 3), -90 + (i - 4.5) * 22, 13, i % 2 ? '#d6d066' : '#b8cc5c');
    return s + `<text x="128" y="44" font-size="11" fill="currentColor">${tr('小葉簇生')}</text>`;
  },
  skirt() {
    let s = `<rect x="91" y="44" width="18" height="86" rx="6" fill="#7c9a4a" stroke="#5a7434"/>`;
    s += `<path d="M100 46 C80 20 50 14 24 26" stroke="#4f9a38" stroke-width="10" fill="none" stroke-linecap="round"/><path d="M100 46 C122 18 152 14 178 26" stroke="#4f9a38" stroke-width="10" fill="none" stroke-linecap="round"/>`;
    s += `<path d="M100 46 C100 24 104 10 112 4" stroke="#62ad46" stroke-width="8" fill="none" stroke-linecap="round"/>`;
    for (const [dx, col] of [[-12, '#cdb43e'], [12, '#c5a83a'], [-6, '#9a7a3a'], [6, '#a88a40']]) {
      s += `<path d="M${100 + dx * 0.4} 56 C${100 + dx * 2.2} 60 ${100 + dx * 2.4} 84 ${100 + dx * 1.4} 112" stroke="${col}" stroke-width="7" fill="none" stroke-linecap="round"/>`;
    }
    s += `<path d="M96 108 L100 114 L96 120 L100 126" stroke="#3a2a1a" stroke-width="1.6" fill="none"/>`;
    return s;
  },
  hopperburn(o, r) {
    let s = `<rect x="6" y="6" width="188" height="138" rx="8" fill="#a8c6a6"/>`;
    for (let row = 0; row < 8; row++) for (let col = 0; col < 12; col++) {
      const x = 18 + col * 15.4, y = 18 + row * 16.4;
      const d = Math.hypot(x - 100, (y - 76) * 1.2);
      if (d < 30) s += `<path d="M${f(x - 4)} ${f(y + 3)} L${f(x + 4)} ${f(y - 2)}" stroke="#9a7a3a" stroke-width="2.4" stroke-linecap="round"/>`;
      else if (d < 40) s += `<circle cx="${f(x)}" cy="${f(y)}" r="4.5" fill="#cdb45a"/>`;
      else s += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(4.3 + r() * 0.8)}" fill="#3f8a2a"/>`;
    }
    return s;
  },
  panicle() {
    let s = `<path d="M100 135 C100 96 102 66 108 44" stroke="#7aa54a" stroke-width="4" fill="none"/>`;
    s += `<path d="M106 54 C107 49 108 46 109 42" stroke="#2e2016" stroke-width="6.5" fill="none" stroke-linecap="round"/>`;
    s += leafAt(100, 110, -60, 46, '#6aa646') + leafAt(100, 96, 235, 40, '#6aa646');
    const branch = (pts0) => {
      let b = `<path d="M${pts0.map((p) => p.join(' ')).join(' L')}" stroke="#bfb38c" stroke-width="1.5" fill="none"/>`;
      pts0.slice(1).forEach(([x, y]) => { b += `<ellipse cx="${x}" cy="${y}" rx="2.6" ry="4.6" transform="rotate(-20 ${x} ${y})" fill="#ecebe0" stroke="#bdb79d" stroke-width=".7"/>`; });
      return b;
    };
    s += branch([[109, 42], [120, 36], [132, 38], [142, 46], [150, 58], [155, 72], [158, 86]]);
    s += branch([[112, 44], [118, 54], [124, 66], [128, 80], [130, 94]]);
    s += branch([[126, 38], [138, 54], [144, 70], [146, 84]]);
    return s + `<text x="50" y="36" font-size="11" fill="currentColor">${tr('穗頸變黑')}</text><path d="M78 40 L102 46" stroke="currentColor" stroke-width="1" opacity=".7"/>`;
  },
};

function plantSVG(o, seed) {
  const r = rng(seed);
  const st = PLANT_STATES[o.state] || PLANT_STATES.old;
  const noGround = o.state === 'hopperburn';
  const defs = `<marker id="arr" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10z" fill="currentColor"/></marker>`;
  return frame((noGround ? '' : ground) + st(o, r), defs, o.tag);
}

/* ------------------------------------------------------------------ */
/* 莖部、根部                                                          */
/* ------------------------------------------------------------------ */

const STEM = {
  sheath(r) {
    let s = `<rect x="0" y="104" width="200" height="46" fill="${C.water}" opacity=".8"/>`;
    for (const x of [72, 100, 128]) {
      s += `<path d="M${x - 5} 150 L${x - 4} 30 Q${x} 18 ${x + 4} 30 L${x + 5} 150Z" fill="#78ad4f" stroke="#4f7d33"/>`;
      s += `<path d="M${x} 34 C${x - 14} 16 ${x - 26} 10 ${x - 38} 8" stroke="#6aa646" stroke-width="4" fill="none"/>`;
    }
    for (const [x, y] of [[72, 92], [72, 70], [100, 98], [100, 76], [128, 88], [128, 60]]) {
      s += `<ellipse cx="${x}" cy="${y}" rx="5" ry="12" fill="#e6e2cc" stroke="${C.brown}" stroke-width="1.3"/>`;
      s += `<ellipse cx="${x}" cy="${y}" rx="2.4" ry="7" fill="#d6d0b4"/>`;
    }
    for (let i = 0; i < 6; i++) s += `<circle cx="${f(68 + r() * 64)}" cy="${f(64 + r() * 36)}" r="1.6" fill="#6b4a2a"/>`;
    return s + `<text x="150" y="122" font-size="10" fill="#2a5a7a">${tr('水面')}</text>`;
  },
  ooze() {
    return `<rect x="58" y="38" width="84" height="100" rx="8" fill="#d8ecf5" opacity=".6" stroke="#7aa6b8" stroke-width="2"/>` +
      `<rect x="60" y="60" width="80" height="76" rx="6" fill="#bfe0ef" opacity=".7"/>` +
      `<rect x="94" y="14" width="12" height="80" rx="3" fill="#6e9a3e" stroke="#4d7a2a"/>` +
      `<g stroke="#fbfbf3" stroke-width="2.6" fill="none" stroke-linecap="round" opacity=".95">` +
      `<path d="M97 94 C95 104 99 112 94 124"/><path d="M100 94 C102 106 98 116 102 130"/><path d="M103 94 C106 102 104 110 108 122"/></g>` +
      `<text x="146" y="70" font-size="10" fill="currentColor">${tr('清水')}</text><text x="112" y="140" font-size="10" fill="currentColor">${tr('乳白色菌泥')}</text>`;
  },
  vascular(r) {
    let s = '';
    for (const [R, col] of [[58, '#a7c46a'], [48, '#d9dcb0'], [38, '#c4cd8e'], [28, '#e2e3c0'], [17, '#d2d7a4']]) s += `<circle cx="100" cy="76" r="${R}" fill="${col}" stroke="#8a9a5a" stroke-width=".8"/>`;
    for (const R of [53, 43, 33, 22]) {
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * 6.28 + r() * 0.3;
        if (r() < 0.65) s += `<circle cx="${f(100 + Math.cos(a) * R)}" cy="${f(76 + Math.sin(a) * R)}" r="${f(1.2 + r() * 1.3)}" fill="#8a2e14"/>`;
      }
    }
    return s;
  },
  collar() {
    let s = ground + `<path d="M100 130 L100 66 C102 52 112 44 120 46" stroke="#5d8a33" stroke-width="6" fill="none" stroke-linecap="round"/>`;
    s += `<path d="M96 128 L96 104 Q100 100 104 104 L104 128Z" fill="#2e2016"/>`;
    [[100, 84, 26], [101, 66, 22], [110, 52, 18]].forEach(([x, y, len]) => { s += leafAt(x, y, 65, len, '#6a9a3e') + leafAt(x, y - 2, 118, len, '#6a9a3e'); });
    return s + `<text x="112" y="118" font-size="10" fill="#fff">${tr('莖基部黑褐')}</text>`;
  },
};

function stemSVG(o, seed) {
  return frame((STEM[o.p] || STEM.sheath)(rng(seed)), '', o.tag);
}

function rootsSVG(o, seed) {
  const r = rng(seed);
  let s = `<rect x="0" y="48" width="200" height="102" fill="${C.soil}"/><path d="M0 48 H200" stroke="${C.soilDark}" stroke-width="2"/>`;
  s += leafAt(101, 44, -30, 34, '#7aa84a') + leafAt(99, 40, 210, 34, '#7aa84a') + leafAt(100, 38, -90, 26, '#8ab85a');
  const roots = [[100, 50, 100, 140], [100, 64, 54, 110], [100, 64, 146, 112], [100, 82, 66, 136], [100, 82, 136, 138], [100, 100, 82, 146], [100, 100, 122, 146]];
  for (const [x1, y1, x2, y2] of roots) s += `<path d="M${x1} ${y1} Q${(x1 + x2) / 2 + (r() - 0.5) * 16} ${(y1 + y2) / 2} ${x2} ${y2}" stroke="#efe2c4" stroke-width="2.2" fill="none"/>`;
  if (o.type === 'club') {
    s += `<path d="${blob(100, 86, 20, r, 10, 0.3, 0.9, 1.5)}" fill="#efe2c4" stroke="#b39a6e" stroke-width="1.4"/>`;
    s += `<path d="${blob(68, 98, 9, r, 8, 0.4, 1.3, 0.8)}" fill="#efe2c4" stroke="#b39a6e" stroke-width="1.2"/>`;
    s += `<path d="${blob(134, 104, 10, r, 8, 0.4, 1.3, 0.8)}" fill="#efe2c4" stroke="#b39a6e" stroke-width="1.2"/>`;
  } else {
    for (const [x1, y1, x2, y2] of roots) {
      for (let t = 0.25; t < 1; t += 0.2) {
        const x = x1 + (x2 - x1) * t, y = y1 + (y2 - y1) * t;
        s += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(2.6 + r() * 2.6)}" fill="#efe2c4" stroke="#b39a6e"/>`;
      }
    }
  }
  return frame(s, '', o.tag);
}

/* ------------------------------------------------------------------ */
/* 蟲體                                                                */
/* ------------------------------------------------------------------ */

const leafBg = `<ellipse cx="100" cy="78" rx="90" ry="64" fill="#cfe5b4"/><path d="M14 92 Q100 70 190 64" stroke="#b2d295" stroke-width="3" fill="none"/>`;
const legs = (x, y, side, n, len, col, spread = 14) => {
  let s = '';
  for (let i = 0; i < n; i++) {
    const yy = y + (i - (n - 1) / 2) * spread;
    const kx = x + side * len * 0.6, ky = yy - 4 + i * 2;
    s += `<path d="M${x} ${f(yy)} L${f(kx)} ${f(ky)} L${f(x + side * len)} ${f(ky + 8 + (i - 1) * 4)}" stroke="${col}" stroke-width="1.6" fill="none" stroke-linejoin="round"/>`;
  }
  return s;
};

const BUGS = {
  caterpillar(o) {
    const col = o.color || '#6b8a3a';
    let s = leafBg;
    const n = 12;
    const seg = [];
    for (let i = 0; i < n; i++) {
      const x = 36 + i * 10, y = 84 + Math.sin(i * 0.55) * 6;
      const R = o.spindle ? 4 + 7 * Math.sin((Math.PI * (i + 0.6)) / (n + 0.2)) : i < 2 ? 7 + i * 1.5 : 10;
      seg.push([x, y, R]);
    }
    for (const [x, y, R] of seg) if (R > 6) s += `<path d="M${f(x - 3)} ${f(y + R - 1)} l0 5 M${f(x + 3)} ${f(y + R - 1)} l0 5" stroke="#3a2a1a" stroke-width="2.2" stroke-linecap="round"/>`;
    for (const [x, y, R] of seg) s += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(R)}" fill="${col}" stroke="#00000040"/>`;
    if (!o.spindle) s += `<path d="M${seg.map(([x, y, R]) => `${f(x)} ${f(y + R * 0.35)}`).join(' L')}" stroke="#e6d27a" stroke-width="2.4" fill="none" opacity=".85"/>`;
    if (o.marks) for (const [x, y, R] of seg.slice(1, -1)) s += `<path d="M${f(x - R * 0.6)} ${f(y - R * 0.45)} q${f(R * 0.6)} ${f(-R * 0.7)} ${f(R * 1.2)} 0Z" fill="#141414"/>`;
    if (o.dots) { const [x, y] = seg[1]; s += [[-3, -3], [3, -3], [-3, 3], [3, 3]].map(([dx, dy]) => `<circle cx="${f(x + dx)}" cy="${f(y - 4 + dy)}" r="1.6" fill="#111"/>`).join(''); }
    const [hx, hy] = seg[n - 1];
    s += `<circle cx="${hx + 9}" cy="${f(hy)}" r="${o.spindle ? 5 : 9}" fill="${o.spindle ? '#6a9a3a' : '#3b2a1a'}"/>`;
    if (o.y) s += `<path d="M${hx + 4} ${f(hy - 6)} L${hx + 9} ${f(hy)} L${hx + 4} ${f(hy + 6)} M${hx + 9} ${f(hy)} L${hx + 16} ${f(hy)}" stroke="#f4f0e0" stroke-width="1.8" fill="none"/>`;
    return s;
  },
  moth() {
    let s = leafBg;
    s += `<path d="M100 30 L82 8 M100 30 L118 8" stroke="#6b5338" stroke-width="1.3"/>`;
    s += `<path d="M100 28 C114 34 120 64 118 122 L100 130 L82 122 C80 64 86 34 100 28Z" fill="#8a6e4e" stroke="#5d4630"/>`;
    s += `<path d="M100 46 L109 60 L100 74 L109 88 L100 102 L109 116 L100 124 L91 116 L100 102 L91 88 L100 74 L91 60Z" fill="#f0e2b8"/>`;
    s += `<path d="M84 122 l-4 8 M90 126 l-2 8 M110 126 l2 8 M116 122 l4 8" stroke="#8a6e4e" stroke-width="1.2"/>`;
    return s + `<circle cx="100" cy="30" r="5" fill="#6b5338"/>`;
  },
  aphid(o) {
    const col = o.color || '#86b84a';
    let s = leafBg;
    for (const [x, y, k] of [[48, 54, 0.35], [150, 60, 0.4], [56, 112, 0.3], [146, 112, 0.36], [128, 36, 0.28]]) {
      s += `<ellipse cx="${x}" cy="${y}" rx="${f(15 * k)}" ry="${f(21 * k)}" fill="#a6cc6a" stroke="#00000030"/>`;
    }
    s += legs(88, 82, -1, 3, 22, '#4a6a2a') + legs(112, 82, 1, 3, 22, '#4a6a2a');
    s += `<path d="M95 52 C80 30 60 38 54 70 M105 52 C120 30 140 38 146 70" stroke="#4a6a2a" stroke-width="1.3" fill="none"/>`;
    s += `<ellipse cx="100" cy="84" rx="16" ry="22" fill="${col}" stroke="#4a7a2a"/><ellipse cx="100" cy="58" rx="9" ry="7" fill="${col}" stroke="#4a7a2a"/>`;
    s += `<circle cx="94" cy="55" r="2" fill="#7a1a1a"/><circle cx="106" cy="55" r="2" fill="#7a1a1a"/>`;
    s += `<path d="M92 98 L86 110 M108 98 L114 110" stroke="#355a1e" stroke-width="3.2" stroke-linecap="round"/>`;
    return s + `<text x="120" y="112" font-size="9" fill="#2d3a24">${tr('腹管')}</text>`;
  },
  whitefly() {
    let s = leafBg;
    for (const [x, y] of [[44, 56], [60, 112], [150, 110], [160, 50], [130, 128]]) s += `<ellipse cx="${x}" cy="${y}" rx="5" ry="3.4" fill="#f2efc6" stroke="#cfc890"/>`;
    s += `<path d="M100 50 C78 54 70 82 78 112 L100 104Z" fill="#fcfcf8" stroke="#cfcfc4"/><path d="M100 50 C122 54 130 82 122 112 L100 104Z" fill="#fcfcf8" stroke="#cfcfc4"/>`;
    s += `<ellipse cx="100" cy="76" rx="6" ry="20" fill="#e8d870" opacity=".55"/><ellipse cx="100" cy="46" rx="7" ry="6" fill="#efe5a0"/>`;
    s += `<circle cx="95" cy="45" r="2.2" fill="#b0201a"/><circle cx="105" cy="45" r="2.2" fill="#b0201a"/><path d="M96 41 L86 30 M104 41 L114 30" stroke="#c0b070" stroke-width="1"/>`;
    return s + `<text x="20" y="140" font-size="9" fill="#2d3a24">${tr('淡黃色橢圓形為若蟲')}</text>`;
  },
  thrips() {
    let s = leafBg;
    const fringe = (x0, side) => {
      let p = `<path d="M${x0} 52 L${x0 + side * 4} 128" stroke="#a89a6a" stroke-width="2.4"/>`;
      for (let y = 56; y < 128; y += 3.5) p += `<path d="M${f(x0 + side * (4 * (y - 52)) / 76)} ${y} l${side * 7} 1.5" stroke="#8a7a50" stroke-width=".6"/>`;
      return p;
    };
    s += fringe(94, -1) + fringe(106, 1);
    s += legs(96, 60, -1, 3, 16, '#9a8030', 9) + legs(104, 60, 1, 3, 16, '#9a8030', 9);
    s += `<ellipse cx="100" cy="94" rx="8" ry="34" fill="#e2c044" stroke="#9a8030"/>`;
    for (let y = 72; y < 126; y += 7) s += `<path d="M93 ${y} Q100 ${y + 2} 107 ${y}" stroke="#b8952e" stroke-width="1" fill="none"/>`;
    s += `<ellipse cx="100" cy="56" rx="8" ry="8" fill="#d8b43a"/><rect x="94" y="36" width="12" height="13" rx="4" fill="#d8b43a"/>`;
    s += `<path d="M97 37 L90 22 L86 12 M103 37 L110 22 L114 12" stroke="#9a8030" stroke-width="1.4" fill="none"/>`;
    return s + `<path d="M140 132 L180 132" stroke="#2d3a24" stroke-width="1.5"/><text x="160" y="128" font-size="9" text-anchor="middle" fill="#2d3a24">${tr('約 1 mm')}</text>`;
  },
  mite() {
    let s = leafBg;
    for (let i = 0; i < 8; i++) s += `<path d="M${20 + i * 22} 20 L${10 + i * 24} 140" stroke="#ffffff" stroke-width=".7" opacity=".7"/>`;
    for (const [x, y] of [[44, 60], [52, 64], [150, 116], [156, 112], [146, 120]]) s += `<circle cx="${x}" cy="${y}" r="2.6" fill="#f8f4d8" stroke="#d6cfa0"/>`;
    for (const side of [-1, 1]) for (let i = 0; i < 4; i++) {
      const y = 68 + i * 9, x = 100 + side * 16;
      s += `<path d="M${x} ${y} L${x + side * 14} ${y - 10 + i * 5} L${x + side * 24} ${y + (i - 1.5) * 9}" stroke="#a89a50" stroke-width="1.8" fill="none"/>`;
    }
    s += `<ellipse cx="100" cy="82" rx="20" ry="25" fill="#c8c060" stroke="#8a8a3a"/>`;
    s += `<ellipse cx="88" cy="84" rx="6" ry="10" fill="#3a3a1a" opacity=".85"/><ellipse cx="112" cy="84" rx="6" ry="10" fill="#3a3a1a" opacity=".85"/>`;
    s += `<ellipse cx="100" cy="56" rx="6" ry="5" fill="#bdb458"/><circle cx="92" cy="62" r="1.8" fill="#b0201a"/><circle cx="108" cy="62" r="1.8" fill="#b0201a"/>`;
    return s;
  },
  fruitfly(o) {
    const melon = o.t === 'melonfly';
    let s = leafBg;
    const wing = (side) => {
      const sx = side;
      let w = `<path d="M${100 + sx * 8} 58 C${100 + sx * 40} 52 ${100 + sx * 72} 70 ${100 + sx * 76} 92 C${100 + sx * 60} 100 ${100 + sx * 30} 90 ${100 + sx * 8} 66Z" fill="#ffffff" opacity=".5" stroke="#8a8a80"/>`;
      w += `<path d="M${100 + sx * 10} 58 C${100 + sx * 40} 52 ${100 + sx * 70} 68 ${100 + sx * 76} 90" stroke="#7a4a1a" stroke-width="${melon ? 4 : 2.5}" fill="none"/>`;
      if (melon) w += `<path d="M${100 + sx * 36} 60 L${100 + sx * 44} 92" stroke="#7a4a1a" stroke-width="4"/><circle cx="${100 + sx * 72}" cy="90" r="5" fill="#7a4a1a"/>`;
      return w;
    };
    s += wing(-1) + wing(1);
    s += `<ellipse cx="100" cy="92" rx="12" ry="20" fill="${melon ? '#c8873a' : '#c98a3a'}" stroke="#7a4a1a"/>`;
    if (!melon) s += `<path d="M90 80 L110 80 M100 80 L100 108" stroke="#1a1a1a" stroke-width="3"/>`;
    s += `<ellipse cx="100" cy="60" rx="12" ry="13" fill="${melon ? '#a8662a' : '#2b2420'}"/>`;
    s += `<path d="M91 54 L91 68 M109 54 L109 68" stroke="#f2cf3a" stroke-width="3" stroke-linecap="round"/><ellipse cx="100" cy="72" rx="6" ry="3" fill="#f2cf3a"/>`;
    s += `<ellipse cx="100" cy="42" rx="10" ry="7" fill="#d8a85a"/><circle cx="92" cy="41" r="4" fill="#9a2a1a"/><circle cx="108" cy="41" r="4" fill="#9a2a1a"/>`;
    return s;
  },
  planthopper() {
    let s = `<rect x="0" y="112" width="200" height="38" fill="${C.water}" opacity=".8"/>`;
    for (const x of [60, 100, 140]) s += `<path d="M${x - 6} 150 L${x - 4} 10 L${x + 4} 10 L${x + 6} 150Z" fill="#7fb256" stroke="#4f7d33"/>`;
    const hop = (x, y, k, flip) => `<g transform="translate(${x} ${y}) scale(${flip ? -k : k} ${k})">` +
      `<path d="M0 0 C4 -6 18 -7 28 -3 L31 3 C18 7 6 6 0 0Z" fill="#8a5a2a" stroke="#5a3a1a"/>` +
      `<circle cx="1" cy="-1" r="2.4" fill="#5a1a1a"/><path d="M6 3 l-2 5 M12 4 l0 5 M18 4 l2 5" stroke="#5a3a1a" stroke-width="1.2"/></g>`;
    s += hop(64, 90, 1.3, false) + hop(56, 70, 1.1, true) + hop(104, 100, 1.4, false) + hop(96, 78, 1, true) + hop(144, 86, 1.2, false) + hop(136, 104, 1.1, true) + hop(108, 58, 0.9, false);
    return s;
  },
  psyllid() {
    let s = leafBg + `<path d="M10 116 C60 108 140 110 192 100" stroke="#7a5a3a" stroke-width="7" fill="none" stroke-linecap="round"/>`;
    s += `<g transform="translate(108 106) rotate(-45)">` +
      `<path d="M4 -1 L-2 8 M14 1 L10 10 M22 1 L22 10" stroke="#6a5a3a" stroke-width="1.4"/>` +
      `<path d="M2 -4 C20 -14 52 -10 66 0 C52 8 20 10 2 4Z" fill="#d8c8a8" stroke="#8a7050"/>` +
      `<g fill="#7a5a3a">${[[18, -4], [28, 2], [38, -3], [48, 2], [56, -1], [24, -8]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.6"/>`).join('')}</g>` +
      `<ellipse cx="0" cy="0" rx="5" ry="4.5" fill="#9a7a50"/><circle cx="-2" cy="-3" r="1.6" fill="#a02a1a"/><path d="M-3 0 L-12 -4" stroke="#6a5a3a"/></g>`;
    for (const [x, y] of [[40, 106], [58, 104], [74, 105]]) {
      s += `<ellipse cx="${x}" cy="${y}" rx="6" ry="4" fill="#f0a63a" stroke="#c07a1a"/>`;
      s += `<path d="M${x + 4} ${y - 2} c4 -6 -2 -10 4 -16 c4 -4 0 -8 4 -12" stroke="#fff" stroke-width="1.3" fill="none"/>`;
    }
    return s + `<text x="128" y="40" font-size="10" fill="#2d3a24">${tr('約 45° 斜角')}</text>`;
  },
  snail(o, r) {
    let s = `<rect x="0" y="108" width="200" height="42" fill="${C.water}" opacity=".7"/>`;
    s += `<path d="M162 150 L162 10" stroke="#6aa646" stroke-width="6"/>`;
    for (let i = 0; i < 46; i++) s += `<circle cx="${f(162 + (r() - 0.5) * 18)}" cy="${f(56 + (r() - 0.5) * 44)}" r="${f(2.2 + r() * 1.2)}" fill="${r() < 0.5 ? '#ff4f97' : '#ff86ba'}"/>`;
    s += `<path d="M40 112 C40 100 90 100 128 104 C140 106 142 114 128 116 L40 118Z" fill="#9a8a78" stroke="#6e6252"/>`;
    s += `<path d="M126 104 L138 90 M130 106 L144 96" stroke="#7a6e5e" stroke-width="2.4" stroke-linecap="round"/>`;
    let sp = '';
    for (let t = 0; t < 14; t += 0.25) { const R = 2.8 * t, a = t * 0.9; sp += `${t ? 'L' : 'M'}${f(78 + Math.cos(a) * R)} ${f(76 + Math.sin(a) * R)} `; }
    s += `<circle cx="78" cy="76" r="38" fill="#8a6a34" stroke="#5a4320"/><path d="${sp}" stroke="#5a4320" stroke-width="2" fill="none"/>`;
    return s + `<text x="132" y="140" font-size="10" fill="#2a3a4a">${tr('粉紅色卵塊')}</text>`;
  },
  flea(o, r) {
    let s = leafBg;
    for (let i = 0; i < 14; i++) s += `<circle cx="${f(20 + r() * 160)}" cy="${f(26 + r() * 100)}" r="${f(1.6 + r() * 1.6)}" fill="${BG_FILL}" stroke="#9a6d3c" stroke-width=".7"/>`;
    s += legs(82, 88, -1, 3, 22, '#2a2a2a', 13) + legs(118, 88, 1, 3, 22, '#2a2a2a', 13);
    s += `<ellipse cx="78" cy="104" rx="6" ry="10" fill="#2a2a2a" transform="rotate(30 78 104)"/><ellipse cx="122" cy="104" rx="6" ry="10" fill="#2a2a2a" transform="rotate(-30 122 104)"/>`;
    s += `<ellipse cx="100" cy="88" rx="22" ry="32" fill="#1e1e22"/><path d="M100 60 L100 120" stroke="#444" stroke-width="1"/>`;
    s += `<path d="M90 64 C82 76 94 90 86 114" stroke="#e8c838" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M110 64 C118 76 106 90 114 114" stroke="#e8c838" stroke-width="5" fill="none" stroke-linecap="round"/>`;
    s += `<ellipse cx="100" cy="52" rx="15" ry="9" fill="#26262c"/><ellipse cx="100" cy="40" rx="9" ry="7" fill="#26262c"/>`;
    s += `<path d="M95 35 L82 14 M105 35 L118 14" stroke="#2a2a2a" stroke-width="1.6"/><ellipse cx="92" cy="80" rx="5" ry="12" fill="#ffffff" opacity=".12"/>`;
    return s;
  },
  nematode() {
    let s = `<rect x="6" y="6" width="188" height="138" rx="10" fill="#e9e1cf"/>`;
    s += `<circle cx="100" cy="75" r="62" fill="none" stroke="#c9bda2" stroke-width="2"/>`;
    s += `<path d="M86 84 C70 84 62 70 68 58 C76 42 104 40 112 58 C116 66 112 76 104 82 C100 86 98 94 96 106" fill="#fbf8ee" stroke="#a8987a" stroke-width="1.6"/>`;
    for (const [x, y, a] of [[40, 108, 0], [130, 112, 1], [140, 40, 2]]) {
      s += `<path d="M${x} ${y} c8 -${6 + a} 16 ${6 + a} 24 0 s16 -${6 + a} 24 0" stroke="#bfb08e" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
    }
    return s + `<text x="100" y="140" font-size="10" text-anchor="middle" fill="#5a4a30">${tr('雌蟲（洋梨形）與幼蟲')}</text>`;
  },
  scale(o, r) {
    let s = leafBg + `<path d="M8 128 C60 110 130 72 194 34" stroke="#7a5a3a" stroke-width="12" fill="none" stroke-linecap="round"/>`;
    for (let i = 0; i < 16; i++) {
      const t = 0.08 + r() * 0.62;
      const x = 8 + 186 * t, y = 128 - 94 * t + (r() - 0.5) * 6;
      s += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="4.2" ry="2.8" transform="rotate(-28 ${f(x)} ${f(y)})" fill="#9a7a52" stroke="#5d4326"/><circle cx="${f(x)}" cy="${f(y)}" r="1" fill="#e2c890"/>`;
    }
    for (const [x, y] of [[150, 60], [164, 52], [140, 74]]) {
      s += `<ellipse cx="${x}" cy="${y}" rx="8" ry="5" fill="#fbfbf6" stroke="#d8d8cc"/>`;
      for (let k = -3; k <= 3; k++) s += `<path d="M${x + k * 2.2} ${y + 4} l${k * 0.6} 4 M${x + k * 2.2} ${y - 4} l${k * 0.6} -4" stroke="#fbfbf6" stroke-width="1"/>`;
    }
    return s + `<text x="20" y="40" font-size="9" fill="#2d3a24">${tr('褐色為介殼，白色為粉介殼蟲')}</text>`;
  },
};
BUGS.melonfly = BUGS.fruitfly;

function bugSVG(o, seed) {
  return frame((BUGS[o.t] || BUGS.aphid)(o, rng(seed)), '', o.tag);
}

/* ------------------------------------------------------------------ */

const KINDS = { leaf: leafSVG, fruit: fruitSVG, plant: plantSVG, stem: stemSVG, roots: rootsSVG, bug: bugSVG };

/* ------------------------------------------------------------------ */
/* 依作物調整示意圖                                                    */
/* ------------------------------------------------------------------ */

/** 各作物的葉形、果實與植株型態 */
const CROP_STYLE = {
  rice: { leaf: 'grass', plant: 'grass' },
  corn: { leaf: 'grass', plant: 'grass' },
  potato: { leaf: 'broad' },
  tomato: { leaf: 'broad', fruit: 'tomato' },
  pepper: { leaf: 'broad', fruit: 'pepper' },
  eggplant: { leaf: 'broad', fruit: 'eggplant' },
  crucifer: { leaf: 'broad' },
  cucurbit: { leaf: 'lobed', fruit: 'cucurbit' },
  strawberry: { leaf: 'trifoliate', fruit: 'strawberry' },
  citrus: { leaf: 'broad', fruit: 'citrus' },
  banana: { leaf: 'banana', fruit: 'banana' },
  mango: { leaf: 'lance', fruit: 'mango' },
  grape: { leaf: 'lobed', fruit: 'grape' },
  papaya: { leaf: 'lobed', fruit: 'papaya' },
  guava: { leaf: 'broad', fruit: 'guava' },
};
// 這些葉片圖樣的位置是針對特定葉形設計的，不換葉形
const SHAPE_FIXED = new Set(['curl', 'margin-blight', 'v-lesion', 'rolled', 'spindle', 'oilspot', 'blotchy']);
// 這些果實病徵只在特定作物上出現，其他作物不換果實（改為「以○○為例」）
const FRUIT_LESION_CROPS = {
  'blossom-end': new Set(['tomato', 'pepper', 'eggplant', 'cucurbit']),
  crack: new Set(['tomato', 'citrus']),
  hlb: new Set(['citrus']),
};
// 這些植株狀態是特定作物專用，不換成禾本科型態
const PLANT_FORM_STATES = new Set(['old', 'young', 'stunt', 'tipdie']);

/**
 * 把示意圖規格換成指定作物的葉形／果實／植株型態。
 * @returns {{spec: object, example: string}} example：無法換成該作物時，圖中實際畫的作物（例如 'tomato'），否則為空字串
 */
export function adaptIllus(spec, crop) {
  const st = CROP_STYLE[crop];
  if (!spec || !st) return { spec, example: '' };
  if (spec.k === 'leaf' && !SHAPE_FIXED.has(spec.p)) {
    return { spec: { ...spec, shape: st.leaf || 'broad' }, example: '' };
  }
  if (spec.k === 'fruit') {
    const fruit = spec.fruit || 'tomato';
    if (fruit === st.fruit) return { spec, example: '' };
    const limited = FRUIT_LESION_CROPS[spec.p];
    const ok = st.fruit && (!limited || limited.has(crop));
    return ok ? { spec: { ...spec, fruit: st.fruit }, example: '' } : { spec, example: fruit };
  }
  if (spec.k === 'plant' && st.plant && PLANT_FORM_STATES.has(spec.state)) {
    return { spec: { ...spec, form: st.plant }, example: '' };
  }
  return { spec, example: '' };
}

/** 依規格產生 SVG 字串；seed 用來讓同一條目的圖保持一致 */
export function renderIllus(spec, seed = '') {
  const fn = KINDS[spec?.k];
  if (!fn) return frame(`<text x="100" y="80" text-anchor="middle" font-size="14" fill="currentColor">${tr('（無示意圖）')}</text>`);
  try {
    return fn(spec, `${seed}:${spec.k}:${spec.p || spec.t || spec.state || spec.type || ''}`);
  } catch (err) {
    console.error('示意圖繪製失敗', spec, err);
    return frame(`<text x="100" y="80" text-anchor="middle" font-size="14" fill="currentColor">${tr('（示意圖錯誤）')}</text>`);
  }
}
