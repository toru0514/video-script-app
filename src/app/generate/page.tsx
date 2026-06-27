"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { Narrator, Product, GenerateResult } from "@/lib/types";
import { Button, Card, CopyButton, ErrorBox, Spinner } from "@/components/ui";

type GenResponse = GenerateResult & {
  raw: string;
  generation_id: string | null;
  used_pattern: boolean;
  video_id: string | null;
};

export default function GeneratePage() {
  const [narrators, setNarrators] = useState<Narrator[]>([]);
  const [narratorId, setNarratorId] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState("");
  const [mode, setMode] = useState<"input" | "suggest">("input");
  const [theme, setTheme] = useState("");

  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggesting, setSuggesting] = useState(false);

  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<GenResponse | null>(null);
  const [chosenTitle, setChosenTitle] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Narrator[]>("/api/narrators")
      .then((ns) => {
        setNarrators(ns);
        if (ns.length) setNarratorId(ns[0].id);
      })
      .catch((e) => setError(e.message));
    api
      .get<Product[]>("/api/products")
      .then(setProducts)
      .catch(() => {});
  }, []);

  const selected = narrators.find((n) => n.id === narratorId);
  const selectedProduct = products.find((p) => p.id === productId);

  async function suggestThemes() {
    setError(null);
    setSuggesting(true);
    setSuggestions([]);
    try {
      const r = await api.post<{ themes: string[] }>("/api/themes/suggest", {
        narrator_id: narratorId,
        product_id: productId || undefined,
      });
      setSuggestions(r.themes);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSuggesting(false);
    }
  }

  async function generate() {
    if (!narratorId || (!theme.trim() && !productId)) return;
    setError(null);
    setGenerating(true);
    setResult(null);
    try {
      const r = await api.post<GenResponse>("/api/generate", {
        narrator_id: narratorId,
        theme: theme.trim(),
        product_id: productId || undefined,
      });
      setResult(r);
      setChosenTitle(r.titles[0] ?? null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  async function chooseTitle(t: string) {
    setChosenTitle(t);
    if (result?.video_id) {
      try {
        await api.patch("/api/videos", { id: result.video_id, title: t });
      } catch {
        /* 採用の保存失敗は致命的でないため握りつぶす */
      }
    }
  }

  return (
    <div className="space-y-5">
      <h1 className="text-lg font-bold">台本を生成</h1>

      {narrators.length === 0 && (
        <Card className="p-4 text-sm text-neutral-600">
          ナレーターがいません。
          <Link href="/settings" className="text-blue-600 underline ml-1">
            設定
          </Link>
          から追加し、
          <Link href="/scripts" className="text-blue-600 underline mx-1">
            お手本
          </Link>
          を登録してください。
        </Card>
      )}

      {/* ナレーター選択 */}
      <div className="space-y-2">
        <label className="text-sm font-medium">ナレーター</label>
        <select
          value={narratorId}
          onChange={(e) => {
            setNarratorId(e.target.value);
            setSuggestions([]);
            setResult(null);
          }}
          className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-base"
        >
          {narrators.map((n) => (
            <option key={n.id} value={n.id}>
              {n.name}
            </option>
          ))}
        </select>
        {selected?.description && (
          <p className="text-xs text-neutral-500">{selected.description}</p>
        )}
      </div>

      {/* 商品選択 */}
      <div className="space-y-2">
        <label className="text-sm font-medium">
          商品{" "}
          <span className="text-neutral-400 font-normal">（任意・選ぶとその商品に絞って生成）</span>
        </label>
        <select
          value={productId}
          onChange={(e) => {
            setProductId(e.target.value);
            setSuggestions([]);
          }}
          className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-base"
        >
          <option value="">指定なし（自由なテーマ）</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        {selectedProduct?.description && (
          <p className="text-xs text-neutral-500 whitespace-pre-wrap">
            {selectedProduct.description}
          </p>
        )}
        {products.length === 0 && (
          <p className="text-xs text-neutral-400">
            商品は
            <Link href="/settings" className="underline mx-1">
              設定
            </Link>
            で登録できます。
          </p>
        )}
      </div>

      {/* テーマの決め方 */}
      <div className="space-y-2">
        <label className="text-sm font-medium">
          テーマ・切り口
          {productId && (
            <span className="text-neutral-400 font-normal">
              {" "}（商品選択中は任意。空なら商品全体の紹介に）
            </span>
          )}
        </label>
        <div className="flex gap-2">
          <button
            onClick={() => setMode("input")}
            className={`flex-1 py-2 rounded-lg text-sm font-medium border ${
              mode === "input"
                ? "bg-neutral-900 text-white border-neutral-900"
                : "bg-white text-neutral-600 border-neutral-300"
            }`}
          >
            自分で入力
          </button>
          <button
            onClick={() => setMode("suggest")}
            className={`flex-1 py-2 rounded-lg text-sm font-medium border ${
              mode === "suggest"
                ? "bg-neutral-900 text-white border-neutral-900"
                : "bg-white text-neutral-600 border-neutral-300"
            }`}
          >
            提案してもらう
          </button>
        </div>

        {mode === "suggest" && (
          <div className="space-y-2">
            <Button
              variant="secondary"
              onClick={suggestThemes}
              disabled={!narratorId || suggesting}
              className="w-full"
            >
              {suggesting ? <Spinner label="提案中…" /> : "テーマ候補を出す"}
            </Button>
            {suggestions.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => setTheme(s)}
                    className={`px-3 py-1.5 rounded-full text-sm border ${
                      theme === s
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white border-neutral-300 hover:bg-neutral-50"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <textarea
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
          placeholder="例：知らないと損する電子レンジの裏ワザ"
          rows={2}
          className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-base resize-y"
        />
      </div>

      <Button
        onClick={generate}
        disabled={!narratorId || (!theme.trim() && !productId) || generating}
        className="w-full py-3 text-base"
      >
        {generating ? <Spinner label="生成中…" /> : "✨ 生成する"}
      </Button>

      <ErrorBox message={error} />

      {/* 結果 */}
      {result && (
        <div className="space-y-4">
          {result.video_id ? (
            <Card className="p-3 text-sm bg-green-50 border-green-200">
              「未着手」の動画として追加しました。
              <Link href="/" className="text-blue-600 underline ml-1">
                動画リストで見る
              </Link>
            </Card>
          ) : (
            <p className="text-xs text-amber-600">
              ※ 動画リストへの追加に失敗しました（生成結果は保持されています）。
            </p>
          )}

          {!result.used_pattern && (
            <p className="text-xs text-amber-600">
              ※ 型が未抽出のため過去データ全件から生成しました。
              <Link href="/patterns" className="underline ml-1">
                型を抽出
              </Link>
              するとトークン節約＆一貫性が上がります。
            </p>
          )}

          <ResultBlock title="タイトル（採用を選択）" copyText={result.titles.join("\n")}>
            <ul className="space-y-1">
              {result.titles.map((t, i) => (
                <li key={i}>
                  <label className="flex items-start gap-2 text-[15px] cursor-pointer">
                    <input
                      type="radio"
                      name="chosen-title"
                      className="mt-1.5"
                      checked={chosenTitle === t}
                      onChange={() => chooseTitle(t)}
                    />
                    <span>{t}</span>
                  </label>
                </li>
              ))}
            </ul>
          </ResultBlock>

          <ResultBlock title="台本" copyText={result.script}>
            <p className="whitespace-pre-wrap text-[15px] leading-relaxed">
              {result.script}
            </p>
          </ResultBlock>

          <ResultBlock title="ストーリー（Flow用）" copyText={result.story}>
            <p className="whitespace-pre-wrap text-[15px] leading-relaxed">
              {result.story}
            </p>
          </ResultBlock>
        </div>
      )}
    </div>
  );
}

function ResultBlock({
  title,
  copyText,
  children,
}: {
  title: string;
  copyText: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-4 space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-sm">{title}</h2>
        <CopyButton text={copyText} />
      </div>
      <div>{children}</div>
    </Card>
  );
}
