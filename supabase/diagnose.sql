-- AI 拍照診斷：每日使用次數限制
-- 在 Supabase SQL Editor 執行一次即可（可重複執行）。
-- 只存「網路位址的雜湊值」與次數，不存照片、不存原始 IP。

create table if not exists public.diagnose_usage (
  day    date not null,
  client text not null,
  n      int  not null default 0,
  primary key (day, client)
);

-- 開啟 RLS 且不建立任何 policy：前端（anon）完全無法讀寫，只有 Edge Function 的伺服器金鑰可用
alter table public.diagnose_usage enable row level security;
revoke all on public.diagnose_usage from anon, authenticated;

-- 取用一次額度：回傳 'ok'、'client'（此位址今日已達上限）或 'global'（全站今日已達上限）
create or replace function public.diagnose_take(p_client text, p_per_client int, p_global int)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  d     date := (now() at time zone 'Asia/Taipei')::date;
  total int;
  mine  int;
begin
  delete from diagnose_usage where day < d - 7;  -- 只保留最近一週

  select coalesce(sum(n), 0) into total from diagnose_usage where day = d;
  if total >= p_global then
    return 'global';
  end if;

  select n into mine from diagnose_usage where day = d and client = p_client;
  if coalesce(mine, 0) >= p_per_client then
    return 'client';  -- 被拒絕的請求不計入次數
  end if;

  insert into diagnose_usage (day, client, n) values (d, p_client, 1)
  on conflict (day, client) do update set n = diagnose_usage.n + 1;
  return 'ok';
end;
$$;

revoke all on function public.diagnose_take(text, int, int) from public, anon, authenticated;
grant execute on function public.diagnose_take(text, int, int) to service_role;
