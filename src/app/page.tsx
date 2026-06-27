"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { Narrator, Product, Video } from "@/lib/types";
import { Card, ErrorBox, Spinner } from "@/components/ui";
import { StatusSelect } from "@/components/StatusSelect";
import {
  NARRATION_OPTIONS,
  VIDEO_OPTIONS,
  PUBLISH_OPTIONS,
  isUntouched,
} from "@/lib/videoStatus";

export default function VideosPage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [narrators, setNarrators] = useState<Narrator[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [showPublished, setShowPublished] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await api.get<Video[]>("/api/videos");
      setVideos(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    api.get<Narrator[]>("/api/narrators?all=1").then(setNarrators).catch(() => {});
    api.get<Product[]>("/api/products?all=1").then(setProducts).catch(() => {});
  }, []);

  async function updateStatus(v: Video, patch: Partial<Video>) {
    setVideos((prev) =>
      prev.map((x) => (x.id === v.id ? { ...x, ...patch } : x)),
    );
    try {
      await api.patch("/api/videos", { id: v.id, ...patch });
    } catch (e) {
      setError((e as Error).message);
      await load();
    }
  }

  const narratorName = (id: string | null) =>
    narrators.find((n) => n.id === id)?.name ?? null;
  const productName = (id: string | null) =>
    products.find((p) => p.id === id)?.name ?? null;

  const active = videos.filter((v) => v.publish_status !== "published");
  const published = videos.filter((v) => v.publish_status === "published");

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">動画</h1>
        <Link
          href="/generate"
          className="text-sm px-3 py-1.5 rounded-full bg-neutral-900 text-white"
        >
          ＋ 生成して追加
        </Link>
      </div>

      <ErrorBox message={error} />

      {loading ? (
        <Spinner label="読み込み中…" />
      ) : videos.length === 0 ? (
        <p className="text-sm text-neutral-500">
          まだ動画がありません。
          <Link href="/generate" className="text-blue-600 underline ml-1">
            生成
          </Link>
          すると未着手の動画として追加されます。
        </p>
      ) : (
        <>
          <div className="space-y-3">
            {active.length === 0 ? (
              <p className="text-sm text-neutral-500">進行中の動画はありません。</p>
            ) : (
              active.map((v) => (
                <VideoCard
                  key={v.id}
                  v={v}
                  narratorName={narratorName(v.narrator_id)}
                  productName={productName(v.product_id)}
                  onChange={updateStatus}
                />
              ))
            )}
          </div>

          {published.length > 0 && (
            <div className="pt-2">
              <button
                onClick={() => setShowPublished((s) => !s)}
                className="text-sm text-neutral-500 flex items-center gap-1"
              >
                {showPublished ? "▼" : "▶"} 公開済み（{published.length}）
              </button>
              {showPublished && (
                <div className="space-y-3 mt-3 opacity-80">
                  {published.map((v) => (
                    <VideoCard
                      key={v.id}
                      v={v}
                      narratorName={narratorName(v.narrator_id)}
                      productName={productName(v.product_id)}
                      onChange={updateStatus}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function VideoCard({
  v,
  narratorName,
  productName,
  onChange,
}: {
  v: Video;
  narratorName: string | null;
  productName: string | null;
  onChange: (v: Video, patch: Partial<Video>) => void;
}) {
  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link href={`/videos/${v.id}`} className="font-medium hover:underline">
            {v.title}
          </Link>
          <div className="text-xs text-neutral-500">
            {[narratorName, productName].filter(Boolean).join(" ・ ")}
            {(narratorName || productName) && " ・ "}
            {new Date(v.created_at).toLocaleDateString("ja-JP")}
          </div>
        </div>
        {isUntouched(v) && (
          <span className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-neutral-200 text-neutral-600">
            未着手
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <StatusSelect
          label="ナレーション"
          value={v.narration_status}
          options={NARRATION_OPTIONS}
          onChange={(val) => onChange(v, { narration_status: val })}
        />
        <StatusSelect
          label="動画生成"
          value={v.video_status}
          options={VIDEO_OPTIONS}
          onChange={(val) => onChange(v, { video_status: val })}
        />
        <StatusSelect
          label="公開"
          value={v.publish_status}
          options={PUBLISH_OPTIONS}
          onChange={(val) => onChange(v, { publish_status: val })}
        />
      </div>
    </Card>
  );
}
