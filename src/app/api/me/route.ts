import { ok } from "@/lib/http";
import { getAuth } from "@/lib/auth";

// GET /api/me  → 現在の役割を返す（クライアントの表示切り替え用）
export async function GET() {
  const { role } = await getAuth();
  return ok({ role: role ?? "guest" });
}
