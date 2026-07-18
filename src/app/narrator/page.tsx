"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { Narrator, NarratorTask, NarratorTasksResponse } from "@/lib/types";
import { Button, Card, CopyButton, ErrorBox, Spinner } from "@/components/ui";

export default function NarratorPage() {
  const router = useRouter();
  const [name, setName] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [tasks, setTasks] = useState<NarratorTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // admin 用: ナレーター別フィルター（"" = 全ナレーター横断）
  const [narrators, setNarrators] = useState<Narrator[]>([]);
  const [filterId, setFilterId] = useState("");

  async function logout() {
    try {
      await api.del("/api/login");
    } catch {
      /* noop */
    }
    router.replace("/login");
  }

  async function load(narratorId = filterId) {
    setLoading(true);
    setError(null);
    try {
      // 本人は Cookie で特定される。admin は narrator_id で絞り込み（未指定なら全員横断）。
      const q = narratorId ? `?narrator_id=${narratorId}` : "";
      const data = await api.get<NarratorTasksResponse>(
        `/api/narrator/videos${q}`,
      );
      setIsAdmin(data.role === "admin");
      setName(data.narrator?.name ?? null);
      setTasks(data.tasks);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // admin と判明したら絞り込み用のナレーター一覧を取得（初回のみ）
  useEffect(() => {
    if (isAdmin && narrators.length === 0) {
      api
        .get<Narrator[]>("/api/narrators")
        .then((list) => setNarrators(list ?? []))
        .catch(() => {});
    }
  }, [isAdmin, narrators.length]);

  function onChangeFilter(id: string) {
    setFilterId(id);
    load(id);
  }

  async function markDone(task: NarratorTask) {
    setTasks((prev) => prev.filter((t) => t.id !== task.id));
    try {
      await api.patch("/api/narrator/videos", { id: task.id });
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
          <h1 className="text-lg font-bold">
            {isAdmin
              ? "ナレーション収録リスト（全ナレーター）"
              : `ナレーション収録リスト${name ? `（${name}さん）` : ""}`}
          </h1>
          <LogoutButton onClick={logout} />
        </div>
        {isAdmin ? (
          <>
            <p className="text-sm text-neutral-500">
              全ナレーターの未収録動画です。各ナレーターには、このサイトのURLと
              <Link href="/settings" className="text-blue-600 underline mx-1">
                設定
              </Link>
              で確認できる各自のパスワードを伝えてください。
            </p>
            <div className="flex items-center gap-2 pt-1">
              <label className="text-sm text-neutral-600">ナレーター</label>
              <select
                value={filterId}
                onChange={(e) => onChangeFilter(e.target.value)}
                className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm"
              >
                <option value="">全ナレーター</option>
                {narrators.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name}
                  </option>
                ))}
              </select>
            </div>
          </>
        ) : (
          <p className="text-sm text-neutral-500">
            担当の未収録動画です。台本を確認し、録り終えたら「収録完了」を押してください。
          </p>
        )}
      </div>

      <ErrorBox message={error} />

      {tasks.length === 0 ? (
        <p className="text-sm text-neutral-500">
          未収録の動画はありません。お疲れさまです！
        </p>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-neutral-600">未収録：{tasks.length} 件</p>
          {tasks.map((t) => (
            <TaskCard key={t.id} task={t} onDone={markDone} />
          ))}
        </div>
      )}
    </div>
  );
}

function LogoutButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="shrink-0 text-xs text-neutral-500 hover:text-neutral-800 border border-neutral-300 rounded-full px-3 py-1"
    >
      ログアウト
    </button>
  );
}

function TaskCard({
  task,
  onDone,
}: {
  task: NarratorTask;
  onDone: (task: NarratorTask) => void;
}) {
  const [showStory, setShowStory] = useState(false);

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

      {task.output_story && (
        <div>
          <button
            onClick={() => setShowStory((s) => !s)}
            className="w-full text-left text-sm text-neutral-500 flex items-center gap-1 py-1.5"
          >
            {showStory ? "▼" : "▶"} ストーリー（映像構成・参考）
          </button>
          {showStory && (
            <div className="mt-1">
              <ContentBlock title="ストーリー（映像構成・参考）" text={task.output_story} />
            </div>
          )}
        </div>
      )}

      <div className="pt-1 sm:flex sm:justify-end">
        <Button
          variant="primary"
          className="w-full sm:w-auto py-3 sm:py-2 text-base sm:text-sm"
          onClick={() => {
            if (confirm("この動画を「収録完了」にしますか？")) onDone(task);
          }}
        >
          ✓ 収録完了にする
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
