"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { isSupportedImage, prepareImage, type PreparedImage } from "@/lib/shoot/image";
import { buildCaption, hashtagsToText, textToHashtags } from "@/lib/shoot/format";
import {
  POST_GOALS,
  POST_THEMES,
  type CaptionResult,
  type PostGoal,
  type PostTheme,
} from "@/lib/shoot/types";
import {
  Button,
  Card,
  CopyButton,
  ErrorBox,
  PageHeader,
  Spinner,
} from "@/components/ui";

const inputClass =
  "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-base";
const labelClass = "block text-sm font-medium mb-1";
const MAX_IMAGES = 6;

export default function CaptionPage() {
  const [images, setImages] = useState<PreparedImage[]>([]);
  const [note, setNote] = useState("");
  const [theme, setTheme] = useState<PostTheme>("product");
  const [goal, setGoal] = useState<PostGoal>("profile");

  const [result, setResult] = useState<CaptionResult | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [caption, setCaption] = useState("");
  const [hashtagsText, setHashtagsText] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    const next: PreparedImage[] = [];
    for (const file of Array.from(files)) {
      if (!isSupportedImage(file)) {
        setError(`${file.name} は対応していない形式です（JPEG/PNG/WebP など）。`);
        continue;
      }
      try {
        next.push(await prepareImage(file));
      } catch (e) {
        setError((e as Error).message);
      }
    }
    setImages((prev) => [...prev, ...next].slice(0, MAX_IMAGES));
  }

  async function generate() {
    if (images.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<CaptionResult & { warnings?: string[] }>(
        "/api/shoot/caption",
        {
          images: images.map((i) => ({ mimeType: i.mimeType, data: i.data })),
          note: note.trim() || undefined,
          theme,
          goal,
        },
      );
      setResult(res);
      setWarnings(res.warnings ?? []);
      setCaption(res.caption);
      setHashtagsText(hashtagsToText(res.hashtags));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="写真から投稿文"
        description="撮り終えた写真から、ブランドルールに沿った投稿文とハッシュタグを作ります。"
      />

      <ErrorBox message={error} />

      <Card className="p-4 space-y-3">
        <div>
          <label className={labelClass}>写真（最大{MAX_IMAGES}枚）</label>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => addFiles(e.target.files)}
            className="text-sm"
          />
        </div>

        {images.length > 0 && (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {images.map((img, i) => (
              <div key={i} className="relative">
                {/* 端末内で圧縮した data URL のプレビュー。next/image は不要 */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.previewUrl}
                  alt={img.name}
                  className="aspect-square w-full rounded-lg object-cover border border-neutral-200"
                />
                <button
                  onClick={() =>
                    setImages((prev) => prev.filter((_, x) => x !== i))
                  }
                  className="absolute right-1 top-1 rounded-full bg-black/60 px-1.5 text-xs text-white"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelClass}>テーマ</label>
            <select
              className={inputClass}
              value={theme}
              onChange={(e) => setTheme(e.target.value as PostTheme)}
            >
              {POST_THEMES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>主目的（CTAが決まります）</label>
            <select
              className={inputClass}
              value={goal}
              onChange={(e) => setGoal(e.target.value as PostGoal)}
            >
              {POST_GOALS.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className={labelClass}>補足メモ（任意・優先して反映されます）</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="例：カリンの指輪。朝の窓際で撮影"
            className={`${inputClass} resize-y`}
          />
        </div>

        <Button onClick={generate} disabled={images.length === 0 || busy}>
          {busy ? <Spinner label="生成中…" /> : "投稿文を生成"}
        </Button>
      </Card>

      {warnings.length > 0 && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm px-3 py-2">
          <p className="font-medium">表現ルールに反する箇所が残っています</p>
          <ul className="mt-1 list-disc pl-5">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {result && (
        <Card className="p-4 space-y-3">
          {result.photo_summary && (
            <div>
              <p className="text-xs font-medium text-neutral-500">
                写真から読み取った要素
              </p>
              <p className="text-sm text-neutral-600">{result.photo_summary}</p>
            </div>
          )}

          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold">投稿文</h2>
            <CopyButton
              text={buildCaption(caption, textToHashtags(hashtagsText))}
              label="投稿文＋タグをコピー"
            />
          </div>
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={12}
            className={`${inputClass} resize-y`}
          />
          <div>
            <label className={labelClass}>ハッシュタグ</label>
            <textarea
              value={hashtagsText}
              onChange={(e) => setHashtagsText(e.target.value)}
              rows={2}
              className={`${inputClass} resize-y`}
            />
            <p className="mt-1 text-xs text-neutral-400">
              3〜5個に絞る運用方針です（現在{" "}
              {textToHashtags(hashtagsText).length} 個）。
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
