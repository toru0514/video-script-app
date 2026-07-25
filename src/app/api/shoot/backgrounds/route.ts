import { T } from "@/lib/supabase";
import { createMasterRoute } from "@/lib/shoot/masterRoute";

export const { GET, POST, PATCH, DELETE } = createMasterRoute({
  table: T.backgrounds,
  optionalFields: ["tag", "mood", "description"],
  label: "背景素材",
});
