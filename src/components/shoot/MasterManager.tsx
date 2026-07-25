"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  Button,
  Card,
  EmptyState,
  ErrorBox,
  Spinner,
} from "@/components/ui";

/** 名前以外に編集できる項目の定義。 */
export interface MasterField {
  key: string;
  label: string;
  placeholder: string;
}

interface Row {
  id: string;
  name: string;
  [key: string]: unknown;
}

const inputClass =
  "w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-base";

/**
 * 背景素材・木材のような「名前＋任意テキスト数個」のマスタを管理する画面。
 * API は /api/shoot/<endpoint>（createMasterRoute で作った共通ハンドラ）。
 */
export function MasterManager({
  endpoint,
  label,
  namePlaceholder,
  fields,
  description,
}: {
  endpoint: string;
  label: string;
  namePlaceholder: string;
  fields: MasterField[];
  description?: string;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState<Record<string, string>>({});

  const url = `/api/shoot/${endpoint}`;

  async function load() {
    setLoading(true);
    try {
      setRows(await api.get<Row[]>(url));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint]);

  async function add() {
    if (!draft.name?.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await api.post(url, draft);
      setDraft({});
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function save(id: string) {
    setError(null);
    try {
      await api.patch(url, { id, ...edit });
      setEditingId(null);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function remove(row: Row) {
    if (!confirm(`「${row.name}」を削除しますか？`)) return;
    setError(null);
    try {
      await api.del(`${url}?id=${row.id}`);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function startEdit(row: Row) {
    setEditingId(row.id);
    setEdit({
      name: row.name,
      ...Object.fromEntries(
        fields.map((f) => [f.key, (row[f.key] as string) ?? ""]),
      ),
    });
  }

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-base font-bold">{label}</h2>
        {description && (
          <p className="text-sm text-neutral-500 mt-1">{description}</p>
        )}
      </div>

      <ErrorBox message={error} />

      <Card className="p-4 space-y-3">
        <h3 className="font-bold text-sm">{label}を追加</h3>
        <input
          value={draft.name ?? ""}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          placeholder={namePlaceholder}
          className={inputClass}
        />
        {fields.map((f) => (
          <input
            key={f.key}
            value={draft[f.key] ?? ""}
            onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
            placeholder={f.placeholder}
            className={inputClass}
          />
        ))}
        <Button onClick={add} disabled={!draft.name?.trim() || saving}>
          {saving ? <Spinner label="追加中…" /> : "追加"}
        </Button>
      </Card>

      {loading ? (
        <Spinner label="読み込み中…" />
      ) : rows.length === 0 ? (
        <EmptyState title={`まだ${label}がありません。`} />
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <Card key={row.id} className="p-4 space-y-2">
              {editingId === row.id ? (
                <div className="space-y-2">
                  <input
                    value={edit.name ?? ""}
                    onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                    className={inputClass}
                  />
                  {fields.map((f) => (
                    <input
                      key={f.key}
                      value={edit[f.key] ?? ""}
                      onChange={(e) =>
                        setEdit({ ...edit, [f.key]: e.target.value })
                      }
                      placeholder={f.placeholder}
                      className={inputClass}
                    />
                  ))}
                  <div className="flex gap-2">
                    <Button onClick={() => save(row.id)}>保存</Button>
                    <Button variant="ghost" onClick={() => setEditingId(null)}>
                      キャンセル
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium">{row.name}</div>
                    {fields.map((f) =>
                      row[f.key] ? (
                        <p
                          key={f.key}
                          className="text-sm text-neutral-500 whitespace-pre-wrap"
                        >
                          {f.label}：{String(row[f.key])}
                        </p>
                      ) : null,
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button variant="secondary" onClick={() => startEdit(row)}>
                      編集
                    </Button>
                    <Button variant="danger" onClick={() => remove(row)}>
                      削除
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
