"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Narrator, Generation } from "@/lib/types";
import { Card, CopyButton, ErrorBox, Spinner } from "@/components/ui";

export default function HistoryPage() {
  const [narrators, setNarrators] = useState<Narrator[]>([]);
  const [items, setItems] = useState<Generation[]>([]);
  const [favOnly, setFavOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<Narrator[]>("/api/narrators?all=1").then(setNarrators).catch(() => {});
  }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await api.get<Generation[]>(
        `/api/generations${favOnly ? "?favorite=1" : ""}`,
      );
      setItems(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [favOnly]);

  async function toggleFav(g: Generation) {
    await api.patch("/api/generations", {
      id: g.id,
      is_favorite: !g.is_favorite,
    });
    await load();
  }

  async function remove(g: Generation) {
    if (!confirm("この履歴を削除しますか？")) return;
    await api.del(`/api/generations?id=${g.id}`);
    await load();
  }

  const narratorName = (id: string | null) =>
    narrators.find((n) => n.id === id)?.name ?? "（不明）";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">生成履歴</h1>
        <label className="flex items-center gap-2 text-sm text-neutral-600">
          <input
            type="checkbox"
            checked={favOnly}
            onChange={(e) => setFavOnly(e.target.checked)}
          />
          お気に入りのみ
        </label>
      </div>

      <ErrorBox message={error} />

      {loading ? (
        <Spinner label="読み込み中…" />
      ) : items.length === 0 ? (
        <p className="text-sm text-neutral-500">まだ履歴がありません。</p>
      ) : (
        <div className="space-y-3">
          {items.map((g) => (
            <Card key={g.id} className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium">{g.input_theme}</div>
                  <div className="text-xs text-neutral-500">
                    {narratorName(g.narrator_id)} ・{" "}
                    {new Date(g.created_at).toLocaleString("ja-JP")}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => toggleFav(g)}
                    className="text-lg leading-none"
                    title="お気に入り"
                  >
                    {g.is_favorite ? "⭐" : "☆"}
                  </button>
                  <button
                    onClick={() => remove(g)}
                    className="text-xs px-2 py-1 rounded bg-red-50 text-red-600 hover:bg-red-100 self-center"
                  >
                    削除
                  </button>
                </div>
              </div>

              <details className="text-sm">
                <summary className="cursor-pointer select-none text-neutral-500">
                  内容を表示
                </summary>
                <div className="mt-2 space-y-3">
                  <HistoryBlock title="タイトル" text={g.output_titles} />
                  <HistoryBlock title="台本" text={g.output_script} />
                  <HistoryBlock title="ストーリー" text={g.output_story} />
                </div>
              </details>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function HistoryBlock({ title, text }: { title: string; text: string | null }) {
  if (!text) return null;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <div className="text-xs font-bold text-neutral-400">{title}</div>
        <CopyButton text={text} />
      </div>
      <p className="whitespace-pre-wrap text-neutral-700">{text}</p>
    </div>
  );
}
