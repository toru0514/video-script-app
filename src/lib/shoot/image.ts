// クライアント側の画像リサイズ／圧縮。
// iPhone のライブラリや PC のディレクトリから選んだ高解像度画像を、
// アップロード前に縮小・JPEG 圧縮してペイロードを軽くする。

export interface PreparedImage {
  /** Gemini に渡す MIME タイプ（常に image/jpeg に正規化） */
  mimeType: string;
  /** base64 データ本体（data URL の接頭辞は含まない） */
  data: string;
  /** 画面プレビュー用の data URL */
  previewUrl: string;
  /** 元ファイル名（一覧表示・重複判定の目安） */
  name: string;
}

/** 長辺の最大ピクセル。Gemini の画像処理に十分で、かつ送信量を抑える目安。 */
const MAX_EDGE = 1568;
const JPEG_QUALITY = 0.85;

/** 対応拡張子・タイプの簡易判定（HEIC など canvas 変換できない形式を弾く）。 */
export function isSupportedImage(file: File): boolean {
  return /^image\/(jpe?g|png|webp|gif|bmp)$/i.test(file.type);
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  // createImageBitmap は EXIF 回転も吸収できる（対応ブラウザ）。
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      // 一部の Safari 等では option 付きが失敗するのでフォールバックへ。
    }
  }
  return await new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("画像を読み込めませんでした。"));
    };
    img.src = url;
  });
}

/** File を縮小・JPEG 圧縮して base64 とプレビュー URL を返す。 */
export async function prepareImage(file: File): Promise<PreparedImage> {
  const source = await loadBitmap(file);
  const srcW = "width" in source ? source.width : (source as HTMLImageElement).naturalWidth;
  const srcH = "height" in source ? source.height : (source as HTMLImageElement).naturalHeight;

  const scale = Math.min(1, MAX_EDGE / Math.max(srcW, srcH));
  const w = Math.max(1, Math.round(srcW * scale));
  const h = Math.max(1, Math.round(srcH * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("この端末では画像を処理できませんでした。");
  ctx.drawImage(source as CanvasImageSource, 0, 0, w, h);
  if ("close" in source && typeof source.close === "function") source.close();

  const previewUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  const data = previewUrl.split(",")[1] ?? "";
  return { mimeType: "image/jpeg", data, previewUrl, name: file.name };
}
