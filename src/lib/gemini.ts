// Gemini API を listing-text-generator と同じ構成で呼び出す。
// SDK: @google/generative-ai / 既定モデル: gemini-2.5-flash
// API Key は GEMINI_API_KEY（サーバー専用）から読み込む。
import { GoogleGenerativeAI } from "@google/generative-ai";

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

function getModelName(): string {
  return process.env.GEMINI_MODEL || DEFAULT_MODEL;
}

export function getModel(temperature?: number) {
  const genAI = new GoogleGenerativeAI(getApiKey());
  return genAI.getGenerativeModel({
    model: getModelName(),
    generationConfig:
      temperature != null ? { temperature } : undefined,
  });
}

/**
 * Gemini にテキストプロンプトを投げ、生成テキストを返す。
 * レート制限(429)などはステータス付きで GeminiError を投げる。
 */
export async function generateText(
  prompt: string,
  opts?: { temperature?: number },
): Promise<string> {
  const model = getModel(opts?.temperature ?? 0.9);

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    if (!text?.trim()) {
      throw new GeminiError(
        "Gemini APIから有効な応答が得られませんでした。テーマや入力を見直してください。",
        502,
      );
    }
    return text.trim();
  } catch (e) {
    if (e instanceof GeminiError) throw e;
    const msg = (e as Error).message || "";
    // SDK はステータスをメッセージに含めることが多い
    if (/\b429\b|rate limit|quota|RESOURCE_EXHAUSTED/i.test(msg)) {
      throw new GeminiError(
        "Gemini APIのレート制限（無料枠）に達しました。しばらく待ってから再試行してください。",
        429,
      );
    }
    if (/SAFETY|blocked/i.test(msg)) {
      throw new GeminiError(
        "生成がブロックされました。テーマや入力内容を見直してください。",
        502,
      );
    }
    throw new GeminiError(`Gemini APIエラー: ${msg.slice(0, 500)}`, 502);
  }
}
