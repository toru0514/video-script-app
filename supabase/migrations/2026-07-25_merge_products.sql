-- lumiere_products を vsg_products に統合する。
--
-- 実データ突合（2026-07-25）の結果、価格・金属分類は全商品で一致していた。
-- 差分は商品名の揺れ2件（カフス / ネクタイピン）と、
-- vsg にのみ存在する「木のイヤリング」1件のみ。
--
-- このファイルは drop table を含まない。移行後に検証クエリを通してから、
-- 手動で `drop table public.lumiere_products;` を実行すること。

begin;

-- ------------------------------------------------------------
-- 1. lumiere 側にしかないカラムを vsg_products に追加
-- ------------------------------------------------------------
alter table public.vsg_products add column if not exists category   text;
alter table public.vsg_products add column if not exists material   text;
alter table public.vsg_products add column if not exists size_range text;

-- ------------------------------------------------------------
-- 2. 金属分類を lumiere 側の4値に統一
--    hypoallergenic と resin_option は同じ概念の呼称違い。
-- ------------------------------------------------------------
update public.vsg_products set metal_type = 'resin_option' where metal_type = 'hypoallergenic';
update public.vsg_products set metal_type = 'unknown'      where metal_type is null;
alter table public.vsg_products alter column metal_type set default 'unknown';

-- ------------------------------------------------------------
-- 3. 商品名の揺れを解消（lumiere 側を vsg 側の表記に合わせる）
-- ------------------------------------------------------------
update public.lumiere_products set name = '木のカフス'       where name = 'カフス';
update public.lumiere_products set name = '木のネクタイピン' where name = 'ネクタイピン';

-- ------------------------------------------------------------
-- 4. lumiere にしかないカラムの値を移す
--    description は vsg 側のほうが詳しいため触らない。
-- ------------------------------------------------------------
update public.vsg_products v
set category   = coalesce(v.category,   l.category),
    material   = coalesce(v.material,   l.material),
    size_range = coalesce(v.size_range, l.size_range)
from public.lumiere_products l
where v.name = l.name;

-- ------------------------------------------------------------
-- 5. vsg にのみ存在する商品のカテゴリを手当て
-- ------------------------------------------------------------
update public.vsg_products set category = 'earring' where name = '木のイヤリング' and category is null;

-- ------------------------------------------------------------
-- 6. lumiere_drafts の参照を vsg_products へ張り替え
-- ------------------------------------------------------------
alter table public.lumiere_drafts drop constraint if exists lumiere_drafts_product_id_fkey;

update public.lumiere_drafts d
set product_id = v.id
from public.lumiere_products l
join public.vsg_products v on v.name = l.name
where d.product_id = l.id;

alter table public.lumiere_drafts
  add constraint lumiere_drafts_product_id_fkey
  foreign key (product_id) references public.vsg_products(id) on delete set null;

commit;
