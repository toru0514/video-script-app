"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { Button, Card, ErrorBox, Spinner } from "@/components/ui";

export default function LoginPage() {
  return (
    <Suspense fallback={<Spinner label="読み込み中…" />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");

  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // next は同一サイト内パスのみ許可（オープンリダイレクト対策）
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { role } = await api.post<{ role: "admin" | "narrator" }>(
        "/api/login",
        { password },
      );
      const target = safeNext ?? (role === "narrator" ? "/narrator" : "/");
      router.replace(target);
    } catch (e) {
      setError((e as Error).message);
      setLoading(false);
    }
  }

  return (
    <div className="max-w-sm mx-auto mt-12">
      <Card className="p-6 space-y-4">
        <div>
          <h1 className="text-lg font-bold">🎬 動画マネージャー</h1>
          <p className="text-sm text-neutral-500 mt-1">パスワードを入力してください。</p>
        </div>
        <ErrorBox message={error} />
        <form onSubmit={submit} className="space-y-3">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="パスワード"
            autoFocus
            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-base"
          />
          <Button type="submit" className="w-full" disabled={loading || !password}>
            {loading ? "確認中…" : "ログイン"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
