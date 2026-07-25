"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { categoryLabel } from "@/lib/brand";
import type { Product } from "@/lib/types";
import {
  POST_FORMATS,
  POST_GOALS,
  POST_THEMES,
  type Background,
  type GenerateResult,
  type Material,
  type PostFormat,
  type PostGoal,
  type PostTheme,
} from "@/lib/shoot/types";
import {
  MONTH1_POSTS,
  PINNED_POSTS,
  findPlannedPost,
} from "@/lib/shoot/postPlan";
import {
  Button,
  Card,
  EmptyState,
  ErrorBox,
  PageHeader,
  SelectableCard,
  Spinner,
} from "@/components/ui";

const inputClass =
  "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-base";
const labelClass = "block text-sm font-medium mb-1";

/** ステップ見出しの丸番号。 */
function StepBadge({ n }: { n: number }) {
  return (
    <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-neutral-900 text-xs text-white">
      {n}
    </span>
  );
}

export default function PlannerPage() {
  const router = useRouter();

  const [products, setProducts] = useState<Product[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [backgrounds, setBackgrounds] = useState<Background[]>([]);
  const [loading, setLoading] = useState(true);

  const [productId, setProductId] = useState<string | null>(null);
  const [materialId, setMaterialId] = useState<string | null>(null);
  const [bgIds, setBgIds] = useState<string[]>([]);

  const [planRef, setPlanRef] = useState("");
  const [theme, setTheme] = useState<PostTheme>("product");
  const [goal, setGoal] = useState<PostGoal>("profile");
  const [format, setFormat] = useState<PostFormat>("feed");

  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [ps, ms, bs] = await Promise.all([
          api.get<Product[]>("/api/products"),
          api.get<Material[]>("/api/shoot/materials"),
          api.get<Background[]>("/api/shoot/backgrounds"),
        ]);
        setProducts(ps);
        setMaterials(ms);
        setBackgrounds(bs);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /** 投稿計画の枠を選んだら、テーマ・目的・形式を計画書の値に合わせる。 */
  function selectPlan(ref: string) {
    setPlanRef(ref);
    const planned = findPlannedPost(ref);
    if (!planned) return;
    setTheme(planned.theme);
    setGoal(planned.goal);
    setFormat(planned.format);
  }

  function toggleBg(id: string) {
    setBgIds((prev) =>
      prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id],
    );
  }

  async function generate() {
    if (!productId) return;
    setGenerating(true);
    setError(null);
    try {
      const gen = await api.post<GenerateResult & { warnings?: string[] }>(
        "/api/shoot/plan",
        {
          productId,
          materialId,
          backgroundIds: bgIds,
          theme,
          goal,
          format,
          planRef: planRef || null,
        },
      );

      // 書き直しても表現ルール違反が残った場合は、保存前に知らせる。
      if (gen.warnings && gen.warnings.length > 0) {
        const proceed = confirm(
          `表現ルールに反する箇所が残っています。\n\n${gen.warnings.join(
            "\n",
          )}\n\nこのまま下書きとして保存し、手で直しますか？`,
        );
        if (!proceed) {
          setGenerating(false);
          return;
        }
      }

      // 生成のたびに未投稿として一覧へ追加する
      const saved = await api.post<{ id: string }>("/api/shoot/drafts", {
        product_id: productId,
        material_id: materialId,
        background_ids: bgIds,
        shoot_plan: {
          composition: gen.composition,
          lighting: gen.lighting,
          props_arrangement: gen.props_arrangement,
          mood: gen.mood,
          tips: gen.tips,
        },
        caption: gen.caption,
        hashtags: gen.hashtags,
        theme,
        goal,
        format,
        hook: gen.hook,
        cta: gen.cta,
        carousel: gen.carousel,
        reel: gen.reel,
        plan_ref: planRef || null,
      });
      router.push(`/shoot/drafts/${saved.id}`);
    } catch (e) {
      setError((e as Error).message);
      setGenerating(false);
    }
  }

  if (loading) return <Spinner label="読み込み中…" />;

  if (products.length === 0) {
    return (
      <>
        <PageHeader title="撮影プラン" />
        <ErrorBox message={error} />
        <EmptyState
          title="先に商品を登録してください"
          description="撮影プランを生成するには、商品マスタに商品が1つ以上必要です。"
        />
        <div className="mt-4">
          <Link href="/settings">
            <Button>設定へ</Button>
          </Link>
        </div>
      </>
    );
  }

  const themeHint = POST_THEMES.find((t) => t.value === theme)?.hint;
  const goalHint = POST_GOALS.find((g) => g.value === goal)?.hint;
  const formatHint = POST_FORMATS.find((f) => f.value === format)?.hint;

  return (
    <div className="space-y-6">
      <PageHeader
        title="撮影プラン"
        description="商品と背景素材の組み合わせから、構図・ライティングと投稿文を作ります。"
      />

      <ErrorBox message={error} />

      {/* STEP 1 投稿設計 */}
      <section>
        <h2 className="mb-2 text-sm font-bold">
          <StepBadge n={1} />
          何の投稿かを決める
        </h2>
        <Card className="p-4 space-y-4">
          <div>
            <label className={labelClass}>投稿計画の枠から選ぶ（任意）</label>
            <select
              className={inputClass}
              value={planRef}
              onChange={(e) => selectPlan(e.target.value)}
            >
              <option value="">計画によらず作る</option>
              <optgroup label="固定投稿">
                {PINNED_POSTS.map((p) => (
                  <option key={p.ref} value={p.ref}>
                    {p.label}
                  </option>
                ))}
              </optgroup>
              <optgroup label="1ヶ月目">
                {MONTH1_POSTS.map((p) => (
                  <option key={p.ref} value={p.ref}>
                    {p.date?.slice(5)} {p.label}
                  </option>
                ))}
              </optgroup>
            </select>
            <p className="mt-1 text-xs text-neutral-400">
              選ぶとテーマ・目的・形式が計画書の設定に合わせて入り、フック案も生成に使われます。
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
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
              <p className="mt-1 text-xs text-neutral-400">{themeHint}</p>
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
              <p className="mt-1 text-xs text-neutral-400">{goalHint}</p>
            </div>

            <div>
              <label className={labelClass}>形式</label>
              <select
                className={inputClass}
                value={format}
                onChange={(e) => setFormat(e.target.value as PostFormat)}
              >
                {POST_FORMATS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-neutral-400">{formatHint}</p>
            </div>
          </div>
        </Card>
      </section>

      {/* STEP 2 商品 */}
      <section>
        <h2 className="mb-2 text-sm font-bold">
          <StepBadge n={2} />
          商品を選ぶ
        </h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {products.map((p) => (
            <SelectableCard
              key={p.id}
              name={p.name}
              subtitle={categoryLabel(p.category)}
              selected={productId === p.id}
              onClick={() => setProductId(p.id)}
            />
          ))}
        </div>
      </section>

      {/* STEP 3 木材 */}
      <section>
        <h2 className="mb-2 text-sm font-bold">
          <StepBadge n={3} />
          木材を選ぶ（任意）
        </h2>
        {materials.length === 0 ? (
          <p className="text-sm text-neutral-400">
            木材は未登録です。
            <Link
              href="/settings/materials"
              className="ml-1 text-blue-600 hover:underline"
            >
              登録する
            </Link>
            （なしでも生成できます）
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {materials.map((m) => (
              <SelectableCard
                key={m.id}
                name={m.name}
                subtitle={m.description ? m.description.slice(0, 20) : null}
                selected={materialId === m.id}
                onClick={() =>
                  setMaterialId((cur) => (cur === m.id ? null : m.id))
                }
              />
            ))}
          </div>
        )}
      </section>

      {/* STEP 4 背景素材 */}
      <section>
        <h2 className="mb-2 text-sm font-bold">
          <StepBadge n={4} />
          背景素材を選ぶ（任意・複数可）
        </h2>
        {backgrounds.length === 0 ? (
          <p className="text-sm text-neutral-400">
            背景素材は未登録です。
            <Link
              href="/settings/backgrounds"
              className="ml-1 text-blue-600 hover:underline"
            >
              登録する
            </Link>
            （なしでも生成できます）
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {backgrounds.map((b) => {
              const idx = bgIds.indexOf(b.id);
              return (
                <SelectableCard
                  key={b.id}
                  name={b.name}
                  subtitle={b.tag}
                  selected={idx !== -1}
                  badge={idx !== -1 ? String(idx + 1) : null}
                  onClick={() => toggleBg(b.id)}
                />
              );
            })}
          </div>
        )}
      </section>

      <section className="border-t border-neutral-200 pt-5">
        <div className="flex items-center gap-3">
          <Button onClick={generate} disabled={!productId || generating}>
            {generating ? <Spinner label="生成中…" /> : "プランを生成"}
          </Button>
          {!productId && (
            <span className="text-sm text-neutral-400">
              商品を選択してください
            </span>
          )}
        </div>
        <p className="mt-2 text-xs text-neutral-400">
          生成すると未投稿として下書きに追加され、投稿文を編集できます。
        </p>
      </section>
    </div>
  );
}
