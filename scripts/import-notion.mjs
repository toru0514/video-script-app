// Notionから抽出したお手本データ(supabase/notion-import.json)を vsg_scripts に投入する。
// 使い方: node scripts/import-notion.mjs
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

// .env.local を素朴にパース
const env = {};
for (const line of readFileSync(join(root, ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^"(.*)"$/, "$1");
}

const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(url, key, { auth: { persistSession: false } });

const NARRATORS = {
  awai: "3c878042-47d1-4c64-95e7-b52e6de33c8f",
  simi: "0e2936b4-015a-430f-99bc-87fd6e48aa8b",
};

const records = JSON.parse(
  readFileSync(join(root, "supabase/notion-import.json"), "utf8"),
);

const rows = records.map((r) => {
  const narrator_id = NARRATORS[r.narrator];
  if (!narrator_id) throw new Error(`unknown narrator: ${r.narrator}`);
  return {
    narrator_id,
    title: r.title,
    script: r.script,
    story: r.story ?? "",
    theme: r.theme || null,
    note: r.note || null,
  };
});

const { data, error } = await sb.from("vsg_scripts").insert(rows).select("id");
if (error) {
  console.error("INSERT ERROR:", error.message);
  process.exit(1);
}
console.log(`inserted ${data.length} rows`);
const counts = {};
for (const r of records) counts[r.narrator] = (counts[r.narrator] || 0) + 1;
console.log("by narrator:", counts);
