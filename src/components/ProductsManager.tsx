"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Product } from "@/lib/types";
import {
  METAL_TYPES,
  PRODUCT_CATEGORIES,
  categoryLabel,
  type MetalType,
  type ProductCategory,
} from "@/lib/brand";
import { Button, Card, ErrorBox, Spinner } from "@/components/ui";

const METAL_OPTIONS = Object.entries(METAL_TYPES) as [
  MetalType,
  { label: string; rule: string },
][];

const CATEGORY_OPTIONS = Object.entries(PRODUCT_CATEGORIES) as [
  ProductCategory,
  string,
][];

const inputClass =
  "w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-base";
const selectClass =
  "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-base";

export function ProductsManager() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newMaterial, setNewMaterial] = useState("");
  const [newSize, setNewSize] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newMetal, setNewMetal] = useState("");
  const [adding, setAdding] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setProducts(await api.get<Product[]>("/api/products?all=1"));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function add() {
    if (!newName.trim()) return;
    setAdding(true);
    setError(null);
    try {
      await api.post("/api/products", {
        name: newName.trim(),
        description: newDesc.trim() || undefined,
        category: newCategory,
        material: newMaterial,
        size_range: newSize,
        price_from: newPrice.trim() || null,
        metal_type: newMetal,
      });
      setNewName("");
      setNewDesc("");
      setNewCategory("");
      setNewMaterial("");
      setNewSize("");
      setNewPrice("");
      setNewMetal("");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAdding(false);
    }
  }

  async function update(id: string, patch: Partial<Product>) {
    setError(null);
    try {
      await api.patch("/api/products", { id, ...patch });
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function move(p: Product, dir: -1 | 1) {
    const sorted = [...products].sort((a, b) => a.sort_order - b.sort_order);
    const idx = sorted.findIndex((x) => x.id === p.id);
    const swap = sorted[idx + dir];
    if (!swap) return;
    await api.patch("/api/products", { id: p.id, sort_order: swap.sort_order });
    await api.patch("/api/products", { id: swap.id, sort_order: p.sort_order });
    await load();
  }

  async function remove(p: Product) {
    if (!confirm(`「${p.name}」を無効化しますか？（履歴は残ります）`)) return;
    await update(p.id, { is_active: false });
  }

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-base font-bold">商品リスト</h2>
        <p className="text-sm text-neutral-500 mt-1">
          生成画面で商品を選ぶと、その商品に絞った台本を作れます。
        </p>
      </div>

      <ErrorBox message={error} />

      <Card className="p-4 space-y-3">
        <h3 className="font-bold text-sm">新しい商品を追加</h3>
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="商品名（例：木の指輪）"
          className={inputClass}
        />
        <select
          value={newCategory}
          onChange={(e) => setNewCategory(e.target.value)}
          className={selectClass}
        >
          <option value="">カテゴリを選ぶ（必須）</option>
          {CATEGORY_OPTIONS.map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <textarea
          value={newDesc}
          onChange={(e) => setNewDesc(e.target.value)}
          placeholder="素材・特徴・訴求ポイント（任意。例：金属アレルギー対応、防水、軽い、ウォールナット材）"
          rows={2}
          className={`${inputClass} resize-y`}
        />
        <input
          value={newMaterial}
          onChange={(e) => setNewMaterial(e.target.value)}
          placeholder="木材（任意。例：カリン/エボニー）"
          className={inputClass}
        />
        <input
          value={newSize}
          onChange={(e) => setNewSize(e.target.value)}
          placeholder="サイズ（任意。例：3〜25号）"
          className={inputClass}
        />
        <input
          value={newPrice}
          onChange={(e) => setNewPrice(e.target.value)}
          inputMode="numeric"
          placeholder="最低価格（税込・円。例：4000）※未入力なら投稿文に金額を書きません"
          className={inputClass}
        />
        <select
          value={newMetal}
          onChange={(e) => setNewMetal(e.target.value)}
          className={selectClass}
        >
          <option value="">金属の分類：未確認（商品固有の断定をさせない）</option>
          {METAL_OPTIONS.filter(([key]) => key !== "unknown").map(([key, m]) => (
            <option key={key} value={key}>
              {m.label}
            </option>
          ))}
        </select>
        <Button onClick={add} disabled={!newName.trim() || !newCategory || adding}>
          {adding ? <Spinner label="追加中…" /> : "追加"}
        </Button>
      </Card>

      {loading ? (
        <Spinner label="読み込み中…" />
      ) : products.length === 0 ? (
        <p className="text-sm text-neutral-500">まだ商品がありません。</p>
      ) : (
        <div className="space-y-3">
          {products.map((p, i) => (
            <ProductRow
              key={p.id}
              p={p}
              isFirst={i === 0}
              isLast={i === products.length - 1}
              onUpdate={update}
              onMove={move}
              onRemove={remove}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ProductRow({
  p,
  isFirst,
  isLast,
  onUpdate,
  onMove,
  onRemove,
}: {
  p: Product;
  isFirst: boolean;
  isLast: boolean;
  onUpdate: (id: string, patch: Partial<Product>) => void;
  onMove: (p: Product, dir: -1 | 1) => void;
  onRemove: (p: Product) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(p.name);
  const [desc, setDesc] = useState(p.description ?? "");
  const [category, setCategory] = useState(p.category ?? "");
  const [material, setMaterial] = useState(p.material ?? "");
  const [size, setSize] = useState(p.size_range ?? "");
  const [price, setPrice] = useState(p.price_from ? String(p.price_from) : "");
  const [metal, setMetal] = useState<string>(
    p.metal_type && p.metal_type !== "unknown" ? p.metal_type : "",
  );

  return (
    <Card className={`p-4 space-y-2 ${!p.is_active ? "opacity-60" : ""}`}>
      {editing ? (
        <div className="space-y-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className={selectClass}
          >
            <option value="">カテゴリ：未設定</option>
            {CATEGORY_OPTIONS.map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="素材・特徴・訴求ポイント"
            rows={2}
            className={`${inputClass} resize-y`}
          />
          <input
            value={material}
            onChange={(e) => setMaterial(e.target.value)}
            placeholder="木材（例：カリン/エボニー）"
            className={inputClass}
          />
          <input
            value={size}
            onChange={(e) => setSize(e.target.value)}
            placeholder="サイズ（例：3〜25号）"
            className={inputClass}
          />
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            inputMode="numeric"
            placeholder="最低価格（税込・円。例：4000）※空なら金額を書きません"
            className={inputClass}
          />
          <select
            value={metal}
            onChange={(e) => setMetal(e.target.value)}
            className={selectClass}
          >
            <option value="">金属の分類：未確認</option>
            {METAL_OPTIONS.filter(([key]) => key !== "unknown").map(
              ([key, m]) => (
                <option key={key} value={key}>
                  {m.label}
                </option>
              ),
            )}
          </select>
          <div className="flex gap-2">
            <Button
              onClick={() => {
                onUpdate(p.id, {
                  name,
                  description: desc,
                  category,
                  material,
                  size_range: size,
                  price_from: price.trim() ? Number(price) : null,
                  metal_type: (metal || "unknown") as MetalType,
                });
                setEditing(false);
              }}
            >
              保存
            </Button>
            <Button variant="ghost" onClick={() => setEditing(false)}>
              キャンセル
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="font-medium flex items-center gap-2">
                {p.name}
                {p.category && (
                  <span className="text-xs bg-neutral-100 text-neutral-500 px-2 py-0.5 rounded-full">
                    {categoryLabel(p.category)}
                  </span>
                )}
                {!p.is_active && (
                  <span className="text-xs bg-neutral-200 text-neutral-500 px-2 py-0.5 rounded-full">
                    無効
                  </span>
                )}
              </div>
              {p.description && (
                <p className="text-sm text-neutral-500 whitespace-pre-wrap">
                  {p.description}
                </p>
              )}
              <p className="text-xs mt-1 space-x-2">
                {p.price_from ? (
                  <span className="text-neutral-500">
                    ¥{p.price_from.toLocaleString("ja-JP")}〜（税込）
                  </span>
                ) : (
                  <span className="text-amber-600">
                    価格未登録（投稿文に金額を書きません）
                  </span>
                )}
                {p.metal_type && p.metal_type !== "unknown" ? (
                  <span className="text-neutral-500">
                    ／{METAL_TYPES[p.metal_type].label}
                  </span>
                ) : (
                  <span className="text-amber-600">／金属の分類が未確認</span>
                )}
                {p.material && (
                  <span className="text-neutral-500">／{p.material}</span>
                )}
                {p.size_range && (
                  <span className="text-neutral-500">／{p.size_range}</span>
                )}
              </p>
            </div>
            <div className="flex flex-col gap-1 shrink-0">
              <button
                onClick={() => onMove(p, -1)}
                disabled={isFirst}
                className="text-xs px-2 py-0.5 rounded bg-neutral-100 disabled:opacity-30"
              >
                ↑
              </button>
              <button
                onClick={() => onMove(p, 1)}
                disabled={isLast}
                className="text-xs px-2 py-0.5 rounded bg-neutral-100 disabled:opacity-30"
              >
                ↓
              </button>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="secondary" onClick={() => setEditing(true)}>
              編集
            </Button>
            {p.is_active ? (
              <Button variant="danger" onClick={() => onRemove(p)}>
                無効化
              </Button>
            ) : (
              <Button
                variant="secondary"
                onClick={() => onUpdate(p.id, { is_active: true })}
              >
                有効化
              </Button>
            )}
          </div>
        </>
      )}
    </Card>
  );
}
