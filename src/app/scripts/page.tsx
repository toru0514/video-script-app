"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Narrator, Script } from "@/lib/types";
import { Button, Card, ErrorBox, Spinner } from "@/components/ui";

const empty = { title: "", script: "", story: "", theme: "", note: "" };

export default function ScriptsPage() {
  const [narrators, setNarrators] = useState<Narrator[]>([]);
  const [narratorId, setNarratorId] = useState("");
  const [scripts, setScripts] = useState<Script[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({ ...empty });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get<Narrator[]>("/api/narrators")
      .then((ns) => {
        setNarrators(ns);
        if (ns.length) setNarratorId(ns[0].id);
      })
      .catch((e) => setError(e.message));
  }, []);

  const loadScripts = useCallback(async () => {
    if (!narratorId) return;
    setLoading(true);
    try {
      const data = await api.get<Script[]>(
        `/api/scripts?narrator_id=${narratorId}`,
      );
      setScripts(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [narratorId]);

  useEffect(() => {
    loadScripts();
  }, [loadScripts]);

  function resetForm() {
    setForm({ ...empty });
    setEditingId(null);
  }

  async function save() {
    if (!form.title.trim() || !form.script.trim() || !form.story.trim()) {
      setError("タイトル・台本・ストーリーは必須です");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        await api.patch("/api/scripts", { id: editingId, ...form });
      } else {
        await api.post("/api/scripts", { narrator_id: narratorId, ...form });
      }
      resetForm();
      await loadScripts();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function edit(s: Script) {
    setEditingId(s.id);
    setForm({
      title: s.title,
      script: s.script,
      story: s.story,
      theme: s.theme ?? "",
      note: s.note ?? "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function remove(s: Script) {
    if (!confirm(`「${s.title}」を削除しますか？`)) return;
    try {
      await api.del(`/api/scripts?id=${s.id}`);
      await loadScripts();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold">お手本管理</h1>
        <p className="text-sm text-neutral-500 mt-1">
          過去動画のタイトル・台本・ストーリーを登録します。
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">ナレーター</label>
        <select
          value={narratorId}
          onChange={(e) => {
            setNarratorId(e.target.value);
            resetForm();
          }}
          className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-base"
        >
          {narrators.map((n) => (
            <option key={n.id} value={n.id}>
              {n.name}
            </option>
          ))}
        </select>
      </div>

      <ErrorBox message={error} />

      {/* 入力フォーム */}
      <Card className="p-4 space-y-3">
        <h2 className="font-bold text-sm">
          {editingId ? "お手本を編集" : "お手本を追加"}
        </h2>
        <Field label="タイトル *">
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-base"
          />
        </Field>
        <Field label="台本 *">
          <textarea
            value={form.script}
            onChange={(e) => setForm({ ...form, script: e.target.value })}
            rows={5}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-base resize-y"
          />
        </Field>
        <Field label="ストーリー（映像構成）*">
          <textarea
            value={form.story}
            onChange={(e) => setForm({ ...form, story: e.target.value })}
            rows={4}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-base resize-y"
          />
        </Field>
        <Field label="テーマ（任意）">
          <input
            value={form.theme}
            onChange={(e) => setForm({ ...form, theme: e.target.value })}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-base"
          />
        </Field>
        <Field label="メモ（任意）">
          <input
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-base"
          />
        </Field>
        <div className="flex gap-2">
          <Button onClick={save} disabled={saving || !narratorId}>
            {saving ? <Spinner label="保存中…" /> : editingId ? "更新" : "追加"}
          </Button>
          {editingId && (
            <Button variant="ghost" onClick={resetForm}>
              キャンセル
            </Button>
          )}
        </div>
      </Card>

      {/* 一覧 */}
      <div className="space-y-3">
        <h2 className="font-bold text-sm">
          登録済み（{scripts.length}本）
        </h2>
        {loading ? (
          <Spinner label="読み込み中…" />
        ) : scripts.length === 0 ? (
          <p className="text-sm text-neutral-500">まだ登録がありません。</p>
        ) : (
          scripts.map((s) => (
            <Card key={s.id} className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-medium">{s.title}</h3>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => edit(s)}
                    className="text-xs px-2 py-1 rounded bg-neutral-100 hover:bg-neutral-200"
                  >
                    編集
                  </button>
                  <button
                    onClick={() => remove(s)}
                    className="text-xs px-2 py-1 rounded bg-red-50 text-red-600 hover:bg-red-100"
                  >
                    削除
                  </button>
                </div>
              </div>
              {s.theme && (
                <span className="inline-block text-xs bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-full">
                  {s.theme}
                </span>
              )}
              <details className="text-sm text-neutral-600">
                <summary className="cursor-pointer select-none text-neutral-500">
                  内容を表示
                </summary>
                <div className="mt-2 space-y-2">
                  <div>
                    <div className="text-xs font-bold text-neutral-400">台本</div>
                    <p className="whitespace-pre-wrap">{s.script}</p>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-neutral-400">
                      ストーリー
                    </div>
                    <p className="whitespace-pre-wrap">{s.story}</p>
                  </div>
                </div>
              </details>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium">{label}</label>
      {children}
    </div>
  );
}
