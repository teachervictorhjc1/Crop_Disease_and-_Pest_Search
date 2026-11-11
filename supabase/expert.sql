-- 專家診斷資料建置：專家白名單、照片診斷資料表、照片儲存空間
-- 在 Supabase SQL Editor 執行一次即可（可重複執行）。需先執行 schema.sql。
--
-- 權限設計：
--   ・任何人都可以「讀取」專家照片與診斷（公開顯示在條目頁）
--   ・只有列在 experts 白名單中的登入帳號可以新增；只能修改、刪除自己的資料
--   ・即使有人自行註冊 Supabase 帳號，不在白名單中就無法寫入

-- ------------------------------------------------------------
-- 專家白名單
-- ------------------------------------------------------------
create table if not exists public.experts (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  name       text not null,              -- 照片署名
  org        text,                       -- 服務單位（選填）
  created_at timestamptz not null default now()
);
alter table public.experts enable row level security;
drop policy if exists "experts_read_self" on public.experts;
create policy "experts_read_self" on public.experts
  for select to authenticated using (user_id = auth.uid());
revoke all on public.experts from anon;
grant select on public.experts to authenticated;

-- 目前登入者是否為專家（security definer：不受 experts 的 RLS 限制）
create or replace function public.is_expert()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.experts where user_id = auth.uid());
$$;
grant execute on function public.is_expert() to anon, authenticated;

-- ------------------------------------------------------------
-- 專家照片與診斷
-- ------------------------------------------------------------
create table if not exists public.expert_photos (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  created_by       uuid default auth.uid() references auth.users (id) on delete set null,
  author           text not null,                       -- 署名（專家姓名）
  image_path       text not null,                       -- storage 路徑：1024px 原圖
  thumb_path       text not null,                       -- storage 路徑：360px 縮圖
  width            int,
  height           int,
  crop             text references public.crops (id) on delete set null,  -- 既有作物
  crop_custom      text,                                -- 自訂作物（清單中沒有時）
  part             text,                                -- leaf / stem / fruit / flower / root / whole
  tags             text[] not null default '{}',        -- 既有的 19 個症狀特徵代碼
  custom_tags      text[] not null default '{}',        -- 自訂症狀特徵
  issue_id         text references public.issues (id) on delete set null,  -- 既有條目
  diagnosis_custom text,                                -- 自訂診斷（清單中沒有時）
  note             text,                                -- 補充說明
  license          text not null default 'CC BY 4.0',
  constraint expert_photos_has_diagnosis check (issue_id is not null or coalesce(diagnosis_custom, '') <> ''),
  constraint expert_photos_part check (part is null or part in ('leaf', 'stem', 'fruit', 'flower', 'root', 'whole'))
);
create index if not exists expert_photos_issue_idx on public.expert_photos (issue_id, created_at desc);
create index if not exists expert_photos_author_idx on public.expert_photos (created_by, created_at desc);

alter table public.expert_photos enable row level security;
drop policy if exists "expert_photos_read" on public.expert_photos;
drop policy if exists "expert_photos_insert" on public.expert_photos;
drop policy if exists "expert_photos_update" on public.expert_photos;
drop policy if exists "expert_photos_delete" on public.expert_photos;
create policy "expert_photos_read" on public.expert_photos
  for select to anon, authenticated using (true);
create policy "expert_photos_insert" on public.expert_photos
  for insert to authenticated with check (public.is_expert() and created_by = auth.uid());
create policy "expert_photos_update" on public.expert_photos
  for update to authenticated using (public.is_expert() and created_by = auth.uid())
  with check (created_by = auth.uid());
create policy "expert_photos_delete" on public.expert_photos
  for delete to authenticated using (public.is_expert() and created_by = auth.uid());
grant select on public.expert_photos to anon, authenticated;
grant insert, update, delete on public.expert_photos to authenticated;

-- ------------------------------------------------------------
-- 照片儲存空間（公開讀取；專家只能寫入自己的資料夾 <user_id>/）
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('expert-photos', 'expert-photos', true, 2097152, array['image/jpeg'])
on conflict (id) do update
  set public = true, file_size_limit = 2097152, allowed_mime_types = array['image/jpeg'];

drop policy if exists "expert_photos_upload" on storage.objects;
drop policy if exists "expert_photos_select_own" on storage.objects;
drop policy if exists "expert_photos_delete_own" on storage.objects;
create policy "expert_photos_upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'expert-photos' and public.is_expert() and (storage.foldername(name))[1] = auth.uid()::text);
create policy "expert_photos_select_own" on storage.objects
  for select to authenticated
  using (bucket_id = 'expert-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "expert_photos_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'expert-photos' and public.is_expert() and (storage.foldername(name))[1] = auth.uid()::text);

-- ------------------------------------------------------------
-- 新增專家帳號（管理者操作）：
--   1. Supabase → Authentication → Users → Add user → Create new user
--      填 Email、密碼，勾選 Auto Confirm User
--   2. 執行下面這行（改成實際的 Email 與姓名）：
-- insert into public.experts (user_id, name, org)
--   select id, '王大明', '○○區農業改良場' from auth.users where email = 'expert@example.com'
--   on conflict (user_id) do update set name = excluded.name, org = excluded.org;
-- ------------------------------------------------------------
