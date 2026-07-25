"use client";

import { MasterManager } from "@/components/shoot/MasterManager";

export default function MaterialsPage() {
  return (
    <MasterManager
      endpoint="materials"
      label="木材"
      namePlaceholder="名前（例：カリン Karin）"
      description="商品に使う木材です。特徴メモは撮影プラン・投稿文の生成に使われます。"
      fields={[
        {
          key: "description",
          label: "特徴",
          placeholder: "特徴（任意。色味・木目・質感）",
        },
      ]}
    />
  );
}
