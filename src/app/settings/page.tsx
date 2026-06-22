"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Narrator } from "@/lib/types";
import { Button, Card, ErrorBox, Spinner } from "@/components/ui";

export default function SettingsPage() {
  const [narrators, setNarrators] = useState<Narrator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [adding, setAdding] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const ns = await api.get<Narrator[]>("/api/narrators?all=1");
      setNarrators(ns);
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
      await api.post("/api/narrators", {
        name: newName.trim(),
        description: newDesc.trim() || undefined,
      });
      setNewName("");
      setNewDesc("");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAdding(false);
    }
  }

  async function update(id: string, patch: Partial<Narrator>) {
    setError(null);
    try {
      await api.patch("/api/narrators", { id, ...patch });
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function move(n: Narrator, dir: -1 | 1) {
    const sorted = [...narrators].sort((a, b) => a.sort_order - b.sort_order);
    const idx = sorted.findIndex((x) => x.id === n.id);
    const swap = sorted[idx + dir];
    if (!swap) return;
    await api.patch("/api/narrators", { id: n.id, sort_order: swap.sort_order });
    await api.patch("/api/narrators", { id: swap.id, sort_order: n.sort_order });
    await load();
  }

  async function remove(n: Narrator) {
    if (
      !confirm(
        `「${n.name}」を無効化しますか？（お手本・履歴は残ります。完全削除ではありません）`,
      )
    )
      return;
    await update(n.id, { is_active: false });
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold">ナレーター設定</h1>
        <p className="text-sm text-neutral-500 mt-1">
          ナレーターを追加・編集・並び替え・無効化できます。
        </p>
      </div>

      <ErrorBox message={error} />

      {/* 追加フォーム */}
      <Card className="p-4 space-y-3">
        <h2 className="font-bold text-sm">新しいナレーターを追加</h2>
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="表示名（例：ゆっくり霊夢）"
          className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-base"
        />
        <input
          value={newDesc}
          onChange={(e) => setNewDesc(e.target.value)}
          placeholder="雰囲気メモ（任意）"
          className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-base"
        />
        <Button onClick={add} disabled={!newName.trim() || adding}>
          {adding ? <Spinner label="追加中…" /> : "追加"}
        </Button>
      </Card>

      {loading ? (
        <Spinner label="読み込み中…" />
      ) : (
        <div className="space-y-3">
          {narrators.map((n, i) => (
            <NarratorRow
              key={n.id}
              n={n}
              isFirst={i === 0}
              isLast={i === narrators.length - 1}
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

function NarratorRow({
  n,
  isFirst,
  isLast,
  onUpdate,
  onMove,
  onRemove,
}: {
  n: Narrator;
  isFirst: boolean;
  isLast: boolean;
  onUpdate: (id: string, patch: Partial<Narrator>) => void;
  onMove: (n: Narrator, dir: -1 | 1) => void;
  onRemove: (n: Narrator) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(n.name);
  const [desc, setDesc] = useState(n.description ?? "");

  return (
    <Card className={`p-4 space-y-2 ${!n.is_active ? "opacity-60" : ""}`}>
      {editing ? (
        <div className="space-y-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-base"
          />
          <input
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="雰囲気メモ"
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-base"
          />
          <div className="flex gap-2">
            <Button
              onClick={() => {
                onUpdate(n.id, { name, description: desc });
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
                {n.name}
                {!n.is_active && (
                  <span className="text-xs bg-neutral-200 text-neutral-500 px-2 py-0.5 rounded-full">
                    無効
                  </span>
                )}
              </div>
              {n.description && (
                <p className="text-sm text-neutral-500">{n.description}</p>
              )}
            </div>
            <div className="flex flex-col gap-1 shrink-0">
              <button
                onClick={() => onMove(n, -1)}
                disabled={isFirst}
                className="text-xs px-2 py-0.5 rounded bg-neutral-100 disabled:opacity-30"
              >
                ↑
              </button>
              <button
                onClick={() => onMove(n, 1)}
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
            {n.is_active ? (
              <Button variant="danger" onClick={() => onRemove(n)}>
                無効化
              </Button>
            ) : (
              <Button
                variant="secondary"
                onClick={() => onUpdate(n.id, { is_active: true })}
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
