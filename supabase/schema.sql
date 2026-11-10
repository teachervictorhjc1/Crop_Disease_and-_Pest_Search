-- 作物病蟲害檢索：Supabase（PostgreSQL）資料表定義
-- 使用方式：Supabase 專案 → SQL Editor → 貼上本檔執行 → 再執行 seed.sql
-- 安全性：啟用 RLS，只開放匿名「讀取」；寫入需使用 Dashboard 或 service_role（不可放在前端）。

create table if not exists public.crops (
  id      text primary key,
  name    text not null,
  en      text,
  "group" text not null,
  emoji   text,
  sort    integer not null default 0
);

create table if not exists public.issues (
  id          text primary key,
  sort        integer not null default 0,
  name        text not null,
  en          text,
  sci         text,
  type        text not null check (type in ('disease', 'pest', 'nutrient')),
  crops       text[] not null default '{}',   -- 作物 id，'*' 代表多數作物
  parts       text[] not null default '{}',   -- 發生部位
  tags        text[] not null default '{}',   -- 症狀特徵標籤（症狀診斷用）
  summary     text not null,
  symptoms    jsonb not null default '[]',    -- 特徵與症狀（字串陣列）
  conditions  text,                           -- 好發條件／發生原因
  prevention  jsonb not null default '[]',    -- 預防與栽培管理
  control     jsonb not null default '[]',    -- 防治／改善方法
  illus       jsonb not null default '[]',    -- 示意圖規格（前端程式繪製）
  photo_query text,                           -- Wikimedia Commons 搜尋關鍵字
  related     text[] not null default '{}',
  updated_at  timestamptz not null default now()
);

create index if not exists issues_type_idx  on public.issues (type);
create index if not exists issues_crops_idx on public.issues using gin (crops);
create index if not exists issues_tags_idx  on public.issues using gin (tags);

-- Row Level Security：任何人可讀、不可寫
alter table public.crops  enable row level security;
alter table public.issues enable row level security;

drop policy if exists "crops are readable by everyone"  on public.crops;
drop policy if exists "issues are readable by everyone" on public.issues;

create policy "crops are readable by everyone"
  on public.crops for select to anon, authenticated using (true);

create policy "issues are readable by everyone"
  on public.issues for select to anon, authenticated using (true);

grant select on public.crops, public.issues to anon, authenticated;
