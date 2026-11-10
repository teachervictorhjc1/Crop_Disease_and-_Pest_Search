// 部署設定
// ------------------------------------------------------------
// 若要改用 Supabase（免費雲端 PostgreSQL）提供資料，請填入：
//   SUPABASE_URL      ：專案網址，例如 https://xxxxxxxx.supabase.co
//   SUPABASE_ANON_KEY ：Project Settings → API Keys 中的 publishable key（sb_publishable_…）
//                       或舊版 anon public key。此金鑰本來就設計為可公開，
//                       資料表已用 RLS 設為「僅能讀取」。
// 兩者留空時，App 會直接讀取 web/data/*.json（離線也能使用）。
// 千萬不要把 service_role / secret key 放在這裡！
export const CONFIG = {
  SUPABASE_URL: 'https://ocnawzdzsvufvkwvwqlu.supabase.co',
  SUPABASE_ANON_KEY: '',
};
