-- TikTok台本ジェネレーター スキーマ
-- handmade-shipping-manager と同じ Supabase プロジェクトを共有するため、
-- テーブルは vsg_ プレフィックスで名前空間化している。

-- 拡張（uuid生成用）
create extension if not exists "pgcrypto";

-- ============================================================
-- vsg_narrators（ナレーター登録）
-- ============================================================
create table if not exists public.vsg_narrators (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  sort_order  int not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- vsg_scripts（過去動画＝お手本）
-- ============================================================
create table if not exists public.vsg_scripts (
  id          uuid primary key default gen_random_uuid(),
  narrator_id uuid not null references public.vsg_narrators(id) on delete cascade,
  title       text not null,
  script      text not null,
  story       text not null,
  theme       text,
  note        text,
  created_at  timestamptz not null default now()
);

create index if not exists idx_vsg_scripts_narrator_id on public.vsg_scripts(narrator_id);

-- ============================================================
-- vsg_patterns（抽出した「型」・ナレーター別）
-- ============================================================
create table if not exists public.vsg_patterns (
  id             uuid primary key default gen_random_uuid(),
  narrator_id    uuid not null references public.vsg_narrators(id) on delete cascade,
  title_pattern  text,
  script_pattern text,
  story_pattern  text,
  source_count   int not null default 0,
  created_at     timestamptz not null default now()
);

create index if not exists idx_vsg_patterns_narrator_id on public.vsg_patterns(narrator_id);

-- ============================================================
-- vsg_generations（生成履歴）
-- ============================================================
create table if not exists public.vsg_generations (
  id            uuid primary key default gen_random_uuid(),
  narrator_id   uuid references public.vsg_narrators(id) on delete set null,
  input_theme   text,
  output_titles text,
  output_script text,
  output_story  text,
  is_favorite   boolean not null default false,
  created_at    timestamptz not null default now()
);

create index if not exists idx_vsg_generations_narrator_id on public.vsg_generations(narrator_id);

-- ============================================================
-- 初期データ（ナレーター2人）
-- ============================================================
insert into public.vsg_narrators (name, description, sort_order)
select 'ナレーターA', '落ち着いた語り口', 1
where not exists (select 1 from public.vsg_narrators);

insert into public.vsg_narrators (name, description, sort_order)
select 'ナレーターB', 'テンポの速い元気な語り口', 2
where (select count(*) from public.vsg_narrators) = 1;
