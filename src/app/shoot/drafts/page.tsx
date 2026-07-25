"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/shoot/format";
import {
  formatLabel,
  goalLabel,
  themeLabel,
  type DraftStatus,
} from "@/lib/shoot/types";
import type { DraftWithProduct } from "@/lib/shoot/data";
import { EmptyState, ErrorBox, PageHeader, Spinner } from "@/components/ui";

function StatusBadge({ status }: { status: DraftStatus }) {
  const posted = status === "posted";
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
        posted
          ? "bg-green-100 text-green-700"
          : "bg-neutral-100 text-neutral-500"
      }`}
    >
      {posted ? "投稿済み" : "未投稿"}
    </span>
  );
}

function DraftCard({ draft }: { draft: DraftWithProduct }) {
  const preview = (draft.caption ?? "").slice(0, 60);
  const tags = [
    themeLabel(draft.theme),
    goalLabel(draft.goal),
    formatLabel(draft.format),
  ].filter(Boolean);

  return (
    <Link
      href={`/shoot/drafts/${draft.id}`}
      className="block rounded-xl border border-neutral-200 bg-white p-4 transition-colors hover:border-neutral-400"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-sm font-medium">
          {draft.product?.name ?? "（商品なし）"}
        </p>
        <StatusBadge status={draft.status} />
      </div>
      <p className="mt-1 line-clamp-2 text-sm text-neutral-500">
        {preview || "（投稿文なし）"}
        {preview.length >= 60 ? "…" : ""}
      </p>
      {tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {tags.map((t) => (
            <span
              key={t}
              className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-600"
            >
              {t}
            </span>
          ))}
        </div>
      )}
      <p className="mt-2 text-xs text-neutral-400">
        {formatDate(draft.created_at)}
      </p>
    </Link>
  );
}

export default function DraftsPage() {
  const [drafts, setDrafts] = useState<DraftWithProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<DraftWithProduct[]>("/api/shoot/drafts")
      .then(setDrafts)
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  const unposted = drafts.filter((d) => d.status !== "posted");
  const posted = drafts.filter((d) => d.status === "posted");

  return (
    <div className="space-y-5">
      <PageHeader
        title="下書き"
        description="撮影プランから生成した投稿を、未投稿・投稿済みで分けて管理します。"
      />

      <ErrorBox message={error} />

      {loading ? (
        <Spinner label="読み込み中…" />
      ) : drafts.length === 0 ? (
        <EmptyState
          title="まだ下書きがありません。"
          description="撮影プランを生成すると、ここに未投稿として追加されます。"
        />
      ) : (
        <>
          <section>
            <h2 className="text-sm font-bold mb-2">未投稿（{unposted.length}）</h2>
            {unposted.length === 0 ? (
              <p className="text-sm text-neutral-400">未投稿はありません。</p>
            ) : (
              <div className="space-y-2">
                {unposted.map((d) => (
                  <DraftCard key={d.id} draft={d} />
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="text-sm font-bold mb-2">投稿済み（{posted.length}）</h2>
            {posted.length === 0 ? (
              <p className="text-sm text-neutral-400">投稿済みはありません。</p>
            ) : (
              <div className="space-y-2">
                {posted.map((d) => (
                  <DraftCard key={d.id} draft={d} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
