// Gemini API 呼び出し。SDK: @google/genai / 既定モデル: gemini-2.5-flash
// API Key は GEMINI_API_KEY（サーバー専用）から読み込む。
import { GoogleGenAI } from "@google/genai";

const DEFAULT_MODEL = "gemini-2.5-flash";

export class GeminiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "GeminiError";
    this.status = status;
  }
}

function getApiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new GeminiError(
      "GEMINI_API_KEY が未設定です。環境変数を設定してください。",
      500,
    );
  }
  return key;
}

export function getClient(): GoogleGenAI {
  return new GoogleGenAI({ apiKey: getApiKey() });
}

export function getModelName(): string {
  return process.env.GEMINI_MODEL || DEFAULT_MODEL;
}

/**
 * SDK の例外を GeminiError に正規化する。
 * 動画・撮影の両セクションでエラー表示を揃えるため、投げる前に必ずこれを通す。
 */
export function toGeminiError(e: unknown): GeminiError {
  if (e instanceof GeminiError) return e;
  const msg = (e as Error)?.message || "";
  // SDK はステータスをメッセージに含めることが多い
  if (/\b429\b|rate limit|quota|RESOURCE_EXHAUSTED/i.test(msg)) {
    return new GeminiError(
      "Gemini APIのレート制限（無料枠）に達しました。しばらく待ってから再試行してください。",
      429,
    );
  }
  if (/SAFETY|blocked/i.test(msg)) {
    return new GeminiError(
      "生成がブロックされました。テーマや入力内容を見直してください。",
      502,
    );
  }
  return new GeminiError(`Gemini APIエラー: ${msg.slice(0, 500)}`, 502);
}

/**
 * Gemini にテキストプロンプトを投げ、生成テキストを返す。
 * レート制限(429)などはステータス付きで GeminiError を投げる。
 */
export async function generateText(
  prompt: string,
  opts?: { temperature?: number },
): Promise<string> {
  try {
    const res = await getClient().models.generateContent({
      model: getModelName(),
      contents: prompt,
      config: { temperature: opts?.temperature ?? 0.9 },
    });
    const text = res.text ?? "";
    if (!text.trim()) {
      throw new GeminiError(
        "Gemini APIから有効な応答が得られませんでした。テーマや入力を見直してください。",
        502,
      );
    }
    return text.trim();
  } catch (e) {
    throw toGeminiError(e);
  }
}
