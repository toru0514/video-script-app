"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Narrator, Pattern } from "@/lib/types";
import { Button, Card, CopyButton, ErrorBox, Spinner } from "@/components/ui";

export default function PatternsPage() {
  const [narrators, setNarrators] = useState<Narrator[]>([]);
  const [narratorId, setNarratorId] = useState("");
  const [pattern, setPattern] = useState<Pattern | null>(null);
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Narrator[]>("/api/narrators")
      .then((ns) => {
        setNarrators(ns);
        if (ns.length) setNarratorId(ns[0].id);
      })
      .catch((e) => setError(e.message));
  }, []);

  const load = useCallback(async () => {
    if (!narratorId) return;
    setLoading(true);
    setError(null);
    try {
      const p = await api.get<Pattern | null>(
        `/api/patterns?narrator_id=${narratorId}`,
      );
      setPattern(p);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [narratorId]);

  useEffect(() => {
    load();
  }, [load]);

  async function extract() {
    if (!narratorId) return;
    setExtracting(true);
    setError(null);
    try {
      const p = await api.post<Pattern>("/api/patterns/extract", {
        narrator_id: narratorId,
      });
      setPattern(p);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setExtracting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold">型の確認・抽出</h1>
        <p className="text-sm text-neutral-500 mt-1">
          お手本全件から「流れ・雰囲気」の型を抽出します。生成時に使われます。
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">ナレーター</label>
        <select
          value={narratorId}
          onChange={(e) => setNarratorId(e.target.value)}
          className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-base"
        >
          {narrators.map((n) => (
            <option key={n.id} value={n.id}>
              {n.name}
            </option>
          ))}
        </select>
      </div>

      <Button onClick={extract} disabled={!narratorId || extracting} className="w-full">
        {extracting ? (
          <Spinner label="抽出中…（数十秒かかります）" />
        ) : pattern ? (
          "型を再抽出する"
        ) : (
          "型を抽出する"
        )}
      </Button>

      <ErrorBox message={error} />

      {loading ? (
        <Spinner label="読み込み中…" />
      ) : pattern ? (
        <div className="space-y-4">
          <p className="text-xs text-neutral-500">
            {pattern.source_count}本から抽出 ・{" "}
            {new Date(pattern.created_at).toLocaleString("ja-JP")}
          </p>
          <PatternBlock title="タイトルの型" text={pattern.title_pattern} />
          <PatternBlock title="台本の流れ・トーンの型" text={pattern.script_pattern} />
          <PatternBlock title="ストーリー（映像構成）の型" text={pattern.story_pattern} />
        </div>
      ) : (
        <p className="text-sm text-neutral-500">
          まだ型がありません。お手本を登録してから「型を抽出する」を押してください。
        </p>
      )}
    </div>
  );
}

function PatternBlock({ title, text }: { title: string; text: string | null }) {
  return (
    <Card className="p-4 space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-sm">{title}</h2>
        {text && <CopyButton text={text} />}
      </div>
      <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-neutral-700">
        {text || "（未抽出）"}
      </p>
    </Card>
  );
}
