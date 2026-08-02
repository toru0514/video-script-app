"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { categoryLabel } from "@/lib/brand";
import {
  buildCaption,
  buildCarouselText,
  buildReelText,
  formatDate,
  hashtagsToText,
  textToHashtags,
} from "@/lib/shoot/format";
import { findPlannedPost } from "@/lib/shoot/postPlan";
import {
  SHOOT_PLAN_KEYS,
  SHOOT_PLAN_LABELS,
  formatLabel,
  goalLabel,
  themeLabel,
  type Background,
} from "@/lib/shoot/types";
import type { DraftWithProduct } from "@/lib/shoot/data";
import {
  Button,
  Card,
  CopyButton,
  ErrorBox,
  Spinner,
} from "@/components/ui";

const inputClass =
  "w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-base";

export default function DraftDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const [draft, setDraft] = useState<DraftWithProduct | null>(null);
  const [backgrounds, setBackgrounds] = useState<Background[]>([]);
  const [caption, setCaption] = useState("");
  const [hashtagsText, setHashtagsText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const d = await api.get<DraftWithProduct>(
          `/api/shoot/drafts?id=${id}`,
        );
        setDraft(d);
        setCaption(d.caption ?? "");
        setHashtagsText(hashtagsToText(d.hashtags ?? []));

        // 背景素材名を出すため、全件から選択分だけを選択順で拾う
        if (d.background_ids?.length) {
          const all = await api.get<Background[]>("/api/shoot/backgrounds");
          const map = new Map(all.map((b) => [b.id, b]));
          setBackgrounds(
            d.background_ids.map((x) => map.get(x)).filter(Boolean) as Background[],
          );
        }
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const copyText = useMemo(
    () => buildCaption(caption, textToHashtags(hashtagsText)),
    [caption, hashtagsText],
  );

  async function save() {
    if (!draft) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await api.patch("/api/shoot/drafts", {
        id: draft.id,
        caption,
        hashtags: textToHashtags(hashtagsText),
      });
      setDirty(false);
      setMessage("保存しました。");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus() {
    if (!draft) return;
    const next = draft.status === "posted" ? "draft" : "posted";
    setError(null);
    try {
      await api.patch("/api/shoot/drafts", { id: draft.id, status: next });
      // 投稿済みにしたらその下書きでの作業は終わりなので一覧へ戻る。
      // 未投稿に戻す場合は編集を続けることが多いので留まる。
      if (next === "posted") {
        router.push("/shoot/drafts");
        return;
      }
      setDraft({ ...draft, status: next });
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function remove() {
    if (!draft) return;
    if (!confirm("この下書きを削除しますか？（元に戻せません）")) return;
    try {
      await api.del(`/api/shoot/drafts?id=${draft.id}`);
      router.push("/shoot/drafts");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (loading) return <Spinner label="読み込み中…" />;
  if (!draft) {
    return (
      <>
        <ErrorBox message={error ?? "下書きが見つかりません。"} />
        <div className="mt-3">
          <Link href="/shoot/drafts" className="text-sm text-blue-600">
            ← 下書き一覧へ
          </Link>
        </div>
      </>
    );
  }

  const plan = draft.shoot_plan;
  const planned = findPlannedPost(draft.plan_ref);
  const designTags = [
    themeLabel(draft.theme),
    goalLabel(draft.goal),
    formatLabel(draft.format),
  ].filter(Boolean);

  return (
    <div className="space-y-4">
      <Link href="/shoot/drafts" className="text-sm text-blue-600">
        ← 下書き一覧へ
      </Link>

      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-xl font-bold">
            {draft.product?.name ?? "（商品なし）"}
          </h1>
          <p className="text-sm text-neutral-500">
            {[
              categoryLabel(draft.product?.category),
              draft.material?.name,
              formatDate(draft.created_at),
            ]
              .filter(Boolean)
              .join(" / ")}
          </p>
          {designTags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {designTags.map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-600"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
        <Button variant="secondary" onClick={toggleStatus}>
          {draft.status === "posted" ? "未投稿に戻す" : "投稿済みにする"}
        </Button>
      </div>

      <ErrorBox message={error} />
      {message && (
        <div className="rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm px-3 py-2">
          {message}
        </div>
      )}

      {planned && (
        <Card className="p-4">
          <h2 className="text-sm font-bold mb-1">投稿計画の枠</h2>
          <p className="text-sm text-neutral-600">{planned.label}</p>
          <p className="text-xs text-neutral-400 mt-1">KPI: {planned.kpi}</p>
        </Card>
      )}

      {plan && (
        <Card className="p-4 space-y-2">
          <h2 className="text-sm font-bold">撮影プラン</h2>
          {SHOOT_PLAN_KEYS.map((k) =>
            plan[k] ? (
              <div key={k}>
                <p className="text-xs font-medium text-neutral-500">
                  {SHOOT_PLAN_LABELS[k]}
                </p>
                <p className="text-sm whitespace-pre-wrap">{plan[k]}</p>
              </div>
            ) : null,
          )}
        </Card>
      )}

      {backgrounds.length > 0 && (
        <Card className="p-4">
          <h2 className="text-sm font-bold mb-1">背景素材</h2>
          <p className="text-sm text-neutral-600">
            {backgrounds.map((b) => b.name).join(" / ")}
          </p>
        </Card>
      )}

      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold">投稿文</h2>
          <CopyButton text={copyText} label="投稿文＋タグをコピー" />
        </div>
        <textarea
          value={caption}
          onChange={(e) => {
            setCaption(e.target.value);
            setDirty(true);
          }}
          rows={12}
          className={`${inputClass} resize-y`}
        />
        <div>
          <label className="block text-sm font-medium mb-1">ハッシュタグ</label>
          <textarea
            value={hashtagsText}
            onChange={(e) => {
              setHashtagsText(e.target.value);
              setDirty(true);
            }}
            rows={2}
            placeholder="#cloud9woodwork #木の指輪"
            className={`${inputClass} resize-y`}
          />
          <p className="mt-1 text-xs text-neutral-400">
            3〜5個に絞る運用方針です（現在 {textToHashtags(hashtagsText).length} 個）。
          </p>
        </div>
        <Button onClick={save} disabled={!dirty || saving}>
          {saving ? <Spinner label="保存中…" /> : "保存"}
        </Button>
      </Card>

      {draft.carousel && draft.carousel.length > 0 && (
        <Card className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold">カルーセル構成</h2>
            <CopyButton text={buildCarouselText(draft.carousel)} />
          </div>
          <ol className="space-y-2">
            {draft.carousel.map((s, i) => (
              <li key={i} className="text-sm">
                <span className="text-neutral-400">{i + 1}枚目</span>
                <p className="font-medium">{s.text}</p>
                <p className="text-neutral-500">{s.visual}</p>
              </li>
            ))}
          </ol>
        </Card>
      )}

      {draft.reel && (
        <Card className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold">リール台本</h2>
            <CopyButton text={buildReelText(draft.reel)} />
          </div>
          <p className="text-sm whitespace-pre-wrap">
            {buildReelText(draft.reel)}
          </p>
        </Card>
      )}

      <div className="pt-2">
        <Button variant="danger" onClick={remove}>
          この下書きを削除
        </Button>
      </div>
    </div>
  );
}
