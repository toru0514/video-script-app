"use client";

import { MasterManager } from "@/components/shoot/MasterManager";

export default function BackgroundsPage() {
  return (
    <MasterManager
      endpoint="backgrounds"
      label="背景素材"
      namePlaceholder="名前（例：リネンの布）"
      description="撮影プランで商品と組み合わせる背景素材です。雰囲気メモは生成プロンプトに渡されます。"
      fields={[
        { key: "tag", label: "タグ", placeholder: "タグ（任意。例：布）" },
        {
          key: "mood",
          label: "雰囲気",
          placeholder: "雰囲気（任意。例：やわらかい・ナチュラル）",
        },
        {
          key: "description",
          label: "メモ",
          placeholder: "メモ（任意。質感・色・使いどころ）",
        },
      ]}
    />
  );
}
