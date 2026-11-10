# 🌿 作物病蟲害檢索

協助農友依田間觀察到的症狀，查詢蔬菜、果樹、糧食作物可能遭遇的**病害、蟲害與營養缺乏**，並以特徵示意圖說明辨識重點，提供預防與防治（改善）方法。

- 📱 **跨平台**：PWA（漸進式網頁應用程式），可在瀏覽器使用，也能在 Android、iPhone「加入主畫面」當 App 使用，瀏覽過的內容離線也能查詢。
- 🆓 **免費部署**：網站放在 GitHub Pages（或 Cloudflare Pages），資料庫使用 Supabase 免費方案（可選）。
- 🧼 **不弄髒本機環境**：前端不需建置、不需 `node_modules`；Python 工具只透過 `uv` 安裝在專案內的 `.venv`。

## 功能

| 功能 | 說明 |
|---|---|
| 瀏覽／搜尋 | 依類別（病害／蟲害／營養缺乏）、作物、部位篩選，並支援關鍵字搜尋（病名、學名、症狀、作物）。 |
| 症狀診斷 | 選擇作物 → 部位 → 觀察到的特徵（可複選），依符合度列出可能原因。 |
| AI 拍照診斷 | 拍照或選擇照片，由 Google Gemini 從本 App 條目中推薦可能原因，並自動勾選特徵（需連網、需部署 Edge Function）。 |
| 條目詳情 | 特徵示意圖、症狀、好發條件、預防與栽培管理、防治方法、相關條目。 |
| 實拍照片 | 一鍵從 Wikimedia Commons 搜尋實拍照片，並標示作者與授權。 |
| 離線使用 | Service Worker 快取 App 與資料。 |

目前收錄：**20 種病害、17 種蟲害、10 種營養缺乏**，涵蓋 15 類作物（水稻、玉米、馬鈴薯、番茄、辣椒、茄子、十字花科、瓜類、草莓、柑橘、香蕉、芒果、葡萄、木瓜、番石榴）。

> ⚠️ 本 App 只提供診斷參考。實際用藥請查詢 [植物保護資訊系統](https://otserv2.tactri.gov.tw/ppm/)，確認登記藥劑、稀釋倍數與安全採收期。

## 專案結構

```
web/                      ← 要部署的網站（純靜態）
  index.html
  css/app.css
  js/app.js               主程式（路由、瀏覽、詳細頁、症狀診斷）
  js/data.js              資料載入（Supabase 優先，失敗時改用 JSON）
  js/illus.js             特徵示意圖產生器（程式繪製 SVG）
  js/config.js            Supabase 連線設定
  data/meta.json          類別、部位、症狀特徵標籤
  data/crops.json         作物清單
  data/issues.json        病害／蟲害／營養缺乏條目（主要資料）
  manifest.webmanifest    PWA 設定
  sw.js                   Service Worker（離線快取）
  icons/                  App 圖示
supabase/
  schema.sql              資料表 + RLS（唯讀）
  seed.sql                由 JSON 產生的種子資料
  diagnose.sql            AI 診斷的每日次數限制
  functions/diagnose/     AI 拍照診斷 Edge Function（Gemini）
scripts/                  開發工具（以 uv 執行）
  serve.py                本機伺服器
  validate_data.py        資料驗證
  build_seed_sql.py       產生 supabase/seed.sql
  make_icons.py           產生 PNG 圖示
.github/workflows/deploy.yml  自動部署到 GitHub Pages
```

## 本機開發

只需要 [uv](https://docs.astral.sh/uv/)。所有套件都裝在專案的 `.venv`，不會影響系統或 base 環境。

```bash
uv sync                          # 建立 .venv（只有開發用的 Pillow）
uv run scripts/serve.py          # 開啟 http://localhost:8000
uv run scripts/validate_data.py  # 修改資料後驗證
```

想用手機在同一個 Wi-Fi 下測試：`uv run scripts/serve.py --host 0.0.0.0`，再用手機開 `http://<電腦IP>:8000`。
（Service Worker 與「安裝 App」功能需要 HTTPS 或 localhost，正式安裝請使用部署後的網址。）

不再需要時，直接刪除專案資料夾內的 `.venv` 即可完全清除。

## 部署（免費）

### 1. 網站：GitHub Pages

1. 在 GitHub 建立新的 repository（例如 `crop-disease-pest-search`）。
2. 推送程式碼：
   ```bash
   git remote add origin https://github.com/<你的帳號>/crop-disease-pest-search.git
   git push -u origin main
   ```
3. GitHub repository → **Settings → Pages → Build and deployment → Source** 選 **GitHub Actions**。
4. 之後每次推送到 `main`，Actions 會先驗證資料，再自動部署 `web/`。
   網址：`https://<你的帳號>.github.io/crop-disease-pest-search/`

> 替代方案：**Cloudflare Pages** → 連結 GitHub repo → Build command 留空、Build output directory 填 `web`。

### 2. 資料庫：Supabase（可選）

不設定也可以使用（直接讀內建 JSON）。若希望之後在線上後台修改資料、不必重新部署，可以接上 Supabase：

1. 到 [supabase.com](https://supabase.com) 建立免費專案。
2. **SQL Editor** 依序執行 `supabase/schema.sql` 和 `supabase/seed.sql`。
3. **Project Settings → API Keys** 複製 Project URL 和 **publishable key**（或舊版 anon key），填入 `web/js/config.js`：
   ```js
   export const CONFIG = {
     SUPABASE_URL: 'https://xxxxxxxx.supabase.co',
     SUPABASE_ANON_KEY: 'sb_publishable_xxxxxxxx',
   };
   ```
   這個金鑰設計上就是公開的，資料表已用 RLS 限制為**唯讀**。**千萬不要**把 `service_role`／secret key 放進前端。
4. 之後可在 Supabase **Table Editor** 直接新增、修改條目。

> 免費方案的專案若連續一段時間沒有使用會暫停，暫停期間 App 會自動改用內建 JSON，不會壞掉。

### 3. AI 拍照診斷：Supabase Edge Function + Gemini（可選）

流程：手機縮圖（長邊 1024px）→ Edge Function `diagnose` → Gemini 判讀 → 只回傳資料庫中存在的條目代碼 → 前端自動勾選特徵並列出 AI 推薦。
Gemini API key 只存在 Supabase Secrets，不會出現在前端或 git。

1. **Secret**：Supabase → **Edge Functions → Secrets** 新增 `GEMINI_API_KEY`（Google AI Studio 申請）。
   其他選填 Secret：`GEMINI_MODEL`（逗號分隔，依序嘗試；預設 `gemini-flash-latest,gemini-flash-lite-latest,gemini-2.5-flash`）、
   `DIAGNOSE_DAILY_LIMIT`（全站每日上限，預設 200）、`DIAGNOSE_CLIENT_LIMIT`（每個網路位址每日上限，預設 30）、
   `ALLOWED_ORIGINS`（允許的網站來源，預設 `https://teachervictorhjc1.github.io`；localhost 一律允許）。
2. **次數限制資料表**：SQL Editor 執行 `supabase/diagnose.sql`。
3. **部署函式**：Supabase → **Edge Functions → Deploy a new function → Via Editor**，名稱填 `diagnose`，
   把 `supabase/functions/diagnose/index.ts` 全部內容貼上後部署。
   部署後到該函式的 **Details / Settings**，**關閉「Verify JWT」**（前端用的是 publishable key，不是 JWT）。
   使用 CLI 則是：`supabase functions deploy diagnose --no-verify-jwt`。
4. 開啟網站「症狀診斷」頁測試。錯誤訊息可在函式的 **Logs** 查看。

> Gemini 免費方案的額度與可用模型常有變動；遇到額度用完，函式會自動改用下一個模型，全部用完時前端會提示稍後再試。

## 新增或修改資料

1. 編輯 `web/data/issues.json`（欄位說明見下方）。
2. `uv run scripts/validate_data.py` 驗證。
3. 有使用 Supabase 時：`uv run scripts/build_seed_sql.py`，再到 SQL Editor 執行新的 `seed.sql`（可重複執行）。
4. 修改了 App 檔案時，把 `web/sw.js` 裡的 `VERSION` 加 1，使用者才會拿到新版。

### 條目欄位

| 欄位 | 說明 |
|---|---|
| `id` | 唯一代碼（英文、數字、`-`） |
| `name` / `en` / `sci` | 中文名／英文名／學名 |
| `type` | `disease` 病害、`pest` 蟲害、`nutrient` 營養缺乏 |
| `crops` | 作物 id 陣列；`"*"` 表示多數作物 |
| `parts` | 發生部位：`leaf`、`stem`、`fruit`、`flower`、`root`、`whole` |
| `tags` | 症狀特徵（症狀診斷用），見 `data/meta.json` |
| `summary` | 一句話摘要 |
| `symptoms` / `prevention` / `control` | 字串陣列 |
| `conditions` | 好發條件／發生原因 |
| `illus` | 示意圖規格陣列（`k` 為 `leaf`、`fruit`、`plant`、`stem`、`roots`、`bug`，`cap` 為圖說） |
| `photoQuery` | Wikimedia Commons 搜尋關鍵字 |
| `related` | 相關條目 id |

示意圖可用的樣式請參考 `web/js/illus.js` 中的 `LEAF_PATTERNS`、`FRUIT_LESIONS`、`PLANT_STATES`、`STEM`、`BUGS`。

## 後續可擴充

- 上架 Google Play／App Store：可用 [Capacitor](https://capacitorjs.com/) 把 `web/` 包成原生 App（需要時再建置，不影響目前環境）。
- 農友回報：用 Supabase Auth + Storage 讓使用者上傳田間照片。
