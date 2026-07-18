"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { EditorTask, EditorTasksResponse } from "@/lib/types";
import { Button, Card, CopyButton, ErrorBox, Spinner } from "@/components/ui";
import { useRole } from "@/components/RoleProvider";

export default function EditorPage() {
  const router = useRouter();
  const guest = useRole() === "guest";
  const [tasks, setTasks] = useState<EditorTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function logout() {
    try {
      await api.del("/api/login");
    } catch {
      /* noop */
    }
    router.replace("/login");
  }

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<EditorTasksResponse>("/api/editor/videos");
      setTasks(data.tasks);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function markDone(task: EditorTask) {
    setTasks((prev) => prev.filter((t) => t.id !== task.id));
    try {
      await api.patch("/api/editor/videos", { id: task.id });
    } catch (e) {
      setError((e as Error).message);
      await load();
    }
  }

  async function saveStorage(task: EditorTask, storageUrl: string) {
    const value = storageUrl.trim() || null;
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, storage_url: value } : t)),
    );
    try {
      await api.patch("/api/editor/videos", {
        id: task.id,
        storage_url: value,
      });
    } catch (e) {
      setError((e as Error).message);
      await load();
    }
  }

  if (loading) return <Spinner label="読み込み中…" />;

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <div className="flex items-start justify-between gap-2">
          <h1 className="text-lg font-bold">動画編集リスト</h1>
          <button
            onClick={logout}
            className="shrink-0 text-xs text-neutral-500 hover:text-neutral-800 border border-neutral-300 rounded-full px-3 py-1"
          >
            ログアウト
          </button>
        </div>
        <p className="text-sm text-neutral-500">
          依頼中の動画です。台本とストーリーを確認し、保存先を入力して、編集し終えたら「編集完了」を押してください。
        </p>
      </div>

      <ErrorBox message={error} />

      {tasks.length === 0 ? (
        <p className="text-sm text-neutral-500">
          依頼中の動画はありません。お疲れさまです！
        </p>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-neutral-600">依頼中：{tasks.length} 件</p>
          {tasks.map((t) => (
            <TaskCard
              key={t.id}
              task={t}
              onDone={markDone}
              onSaveStorage={saveStorage}
              disabled={guest}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ストーリー本文をシーン単位に分割する。
// ストーリーは1行=1シーン（「1. …」「S1（…）…」等）で書かれているため、
// 改行で分割し、空行を除いた各行をシーンとして返す。
// 改行が無ければ全体を1シーンとして返す。
function splitScenes(story: string): string[] {
  return story
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function TaskCard({
  task,
  onDone,
  onSaveStorage,
  disabled = false,
}: {
  task: EditorTask;
  onDone: (task: EditorTask) => void;
  onSaveStorage: (task: EditorTask, storageUrl: string) => void;
  disabled?: boolean;
}) {
  const [storage, setStorage] = useState(task.storage_url ?? "");
  const dirty = storage.trim() !== (task.storage_url ?? "");

  return (
    <Card className="p-4 space-y-3">
      <h2 className="text-base sm:text-[15px] leading-snug">
        <span className="text-neutral-500">タイトル：</span>
        <span className="font-bold">{task.title}</span>
      </h2>

      {task.output_script ? (
        <ContentBlock title="台本" text={task.output_script} large />
      ) : (
        <p className="text-xs text-neutral-400">台本がありません。</p>
      )}

      {task.output_story ? (
        <SceneBlock story={task.output_story} />
      ) : (
        <p className="text-xs text-neutral-400">ストーリーがありません。</p>
      )}

      <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 space-y-2">
        <h3 className="font-bold text-xs text-neutral-600">
          保存先（Google Drive リンク）
        </h3>
        <div className="flex gap-2">
          <input
            type="url"
            value={storage}
            onChange={(e) => setStorage(e.target.value)}
            placeholder="https://drive.google.com/..."
            className="min-w-0 flex-1 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-[15px]"
          />
          <button
            type="button"
            disabled={disabled || !dirty}
            onClick={() => onSaveStorage(task, storage)}
            className="shrink-0 text-sm px-3 py-2 rounded-lg bg-neutral-900 text-white hover:bg-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            保存
          </button>
        </div>
        {task.storage_url && !dirty && (
          <a
            href={task.storage_url}
            target="_blank"
            rel="noreferrer"
            className="inline-block text-xs text-blue-600 hover:text-blue-800 underline break-all"
          >
            保存先を開く
          </a>
        )}
      </div>

      <div className="pt-1 sm:flex sm:justify-end">
        <Button
          variant="primary"
          className="w-full sm:w-auto py-3 sm:py-2 text-base sm:text-sm"
          disabled={disabled}
          onClick={() => {
            if (confirm("この動画の動画生成を「完了」にしますか？")) onDone(task);
          }}
        >
          ✓ 編集完了にする
        </Button>
      </div>
    </Card>
  );
}

function SceneBlock({ story }: { story: string }) {
  const scenes = splitScenes(story);
  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 space-y-2">
      <h3 className="font-bold text-xs text-neutral-600">
        ストーリー（映像構成）
      </h3>
      <ul className="space-y-1.5">
        {scenes.map((scene, i) => (
          <li
            key={i}
            className="flex items-start justify-between gap-2 rounded-md bg-white border border-neutral-200 px-3 py-2"
          >
            <p className="min-w-0 whitespace-pre-wrap text-[15px] leading-relaxed text-neutral-700">
              {scene}
            </p>
            <div className="shrink-0">
              <CopyButton text={scene} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ContentBlock({
  title,
  text,
  large = false,
}: {
  title: string;
  text: string;
  large?: boolean;
}) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-xs text-neutral-600">{title}</h3>
        <CopyButton text={text} />
      </div>
      <p
        className={`whitespace-pre-wrap text-neutral-700 ${
          large
            ? "text-[17px] leading-8 sm:text-base sm:leading-7"
            : "text-[15px] leading-relaxed"
        }`}
      >
        {text}
      </p>
    </div>
  );
}
