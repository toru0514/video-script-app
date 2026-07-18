"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { EditorTask, EditorTasksResponse } from "@/lib/types";
import { Button, Card, CopyButton, ErrorBox, Spinner } from "@/components/ui";
import { useRole } from "@/components/RoleProvider";

export default function EditorPage() {
  const guest = useRole() === "guest";
  const [tasks, setTasks] = useState<EditorTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  if (loading) return <Spinner label="読み込み中…" />;

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-lg font-bold">動画編集リスト</h1>
        <p className="text-sm text-neutral-500">
          動画生成が未完了の動画です。台本とストーリーを確認し、編集し終えたら「編集完了」を押してください。
        </p>
      </div>

      <ErrorBox message={error} />

      {tasks.length === 0 ? (
        <p className="text-sm text-neutral-500">
          編集待ちの動画はありません。お疲れさまです！
        </p>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-neutral-600">編集待ち：{tasks.length} 件</p>
          {tasks.map((t) => (
            <TaskCard key={t.id} task={t} onDone={markDone} disabled={guest} />
          ))}
        </div>
      )}
    </div>
  );
}

function TaskCard({
  task,
  onDone,
  disabled = false,
}: {
  task: EditorTask;
  onDone: (task: EditorTask) => void;
  disabled?: boolean;
}) {
  return (
    <Card className="p-4 space-y-3">
      <h2 className="font-bold text-base sm:text-[15px] leading-snug">
        {task.title}
      </h2>

      {task.output_script ? (
        <ContentBlock title="台本" text={task.output_script} large />
      ) : (
        <p className="text-xs text-neutral-400">台本がありません。</p>
      )}

      {task.output_story ? (
        <ContentBlock title="ストーリー（映像構成）" text={task.output_story} />
      ) : (
        <p className="text-xs text-neutral-400">ストーリーがありません。</p>
      )}

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
