"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import type { VideoDetail, Video } from "@/lib/types";
import { Button, Card, CopyButton, ErrorBox, Spinner } from "@/components/ui";
import { StatusSelect } from "@/components/StatusSelect";
import {
  NARRATION_OPTIONS,
  VIDEO_OPTIONS,
  PUBLISH_OPTIONS,
} from "@/lib/videoStatus";

export default function VideoDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const [video, setVideo] = useState<VideoDetail | null>(null);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const v = await api.get<VideoDetail>(`/api/videos?id=${id}`);
      setVideo(v);
      setNote(v.note ?? "");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (id) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function patch(p: Partial<Video>) {
    if (!video) return;
    setVideo({ ...video, ...p });
    try {
      await api.patch("/api/videos", { id: video.id, ...p });
    } catch (e) {
      setError((e as Error).message);
      await load();
    }
  }

  async function remove() {
    if (!video) return;
    if (!confirm("この動画を削除しますか？")) return;
    try {
      await api.del(`/api/videos?id=${video.id}`);
      router.push("/");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (loading) return <Spinner label="読み込み中…" />;
  if (!video)
    return (
      <div className="space-y-3">
        <ErrorBox message={error ?? "動画が見つかりません"} />
        <Link href="/" className="text-blue-600 underline text-sm">
          ← 動画リストへ
        </Link>
      </div>
    );

  const titleCandidates = (video.generation?.output_titles ?? "")
    .split("\n")
    .map((t) => t.trim())
    .filter(Boolean);

  return (
    <div className="space-y-5">
      <Link href="/" className="text-blue-600 underline text-sm">
        ← 動画リストへ
      </Link>

      <h1 className="text-lg font-bold">{video.title}</h1>

      <ErrorBox message={error} />

      <Card className="p-4 grid grid-cols-3 gap-2">
        <StatusSelect label="ナレーション" value={video.narration_status} options={NARRATION_OPTIONS} onChange={(val) => patch({ narration_status: val })} />
        <StatusSelect label="動画生成" value={video.video_status} options={VIDEO_OPTIONS} onChange={(val) => patch({ video_status: val })} />
        <StatusSelect label="公開" value={video.publish_status} options={PUBLISH_OPTIONS} onChange={(val) => patch({ publish_status: val })} />
      </Card>

      {titleCandidates.length > 0 ? (
        <Card className="p-4 space-y-2">
          <h2 className="font-bold text-sm">採用タイトル</h2>
          <ul className="space-y-1">
            {titleCandidates.map((t, i) => (
              <li key={i}>
                <label className="flex items-start gap-2 text-[15px] cursor-pointer">
                  <input
                    type="radio"
                    name="title"
                    className="mt-1.5"
                    checked={video.title === t}
                    onChange={() => patch({ title: t })}
                  />
                  <span>{t}</span>
                </label>
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <Card className="p-4 space-y-2">
          <h2 className="font-bold text-sm">タイトル</h2>
          <input
            value={video.title}
            onChange={(e) => setVideo({ ...video, title: e.target.value })}
            onBlur={() => video.title.trim() && patch({ title: video.title.trim() })}
            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-base"
          />
          <p className="text-xs text-neutral-400">
            生成元が削除されているため候補はありません。手動で編集できます。
          </p>
        </Card>
      )}

      {video.generation?.output_script && (
        <DetailBlock title="台本" text={video.generation.output_script} />
      )}
      {video.generation?.output_story && (
        <DetailBlock title="ストーリー（Flow用）" text={video.generation.output_story} />
      )}

      <Card className="p-4 space-y-2">
        <h2 className="font-bold text-sm">メモ</h2>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => patch({ note: note.trim() || null })}
          rows={3}
          placeholder="制作メモ・依頼先など"
          className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-base resize-y"
        />
      </Card>

      <Button variant="danger" onClick={remove} className="w-full">
        この動画を削除
      </Button>
    </div>
  );
}

function DetailBlock({ title, text }: { title: string; text: string }) {
  return (
    <Card className="p-4 space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-sm">{title}</h2>
        <CopyButton text={text} />
      </div>
      <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-neutral-700">
        {text}
      </p>
    </Card>
  );
}
