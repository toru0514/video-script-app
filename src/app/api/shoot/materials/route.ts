import { T } from "@/lib/supabase";
import { createMasterRoute } from "@/lib/shoot/masterRoute";

export const { GET, POST, PATCH, DELETE } = createMasterRoute({
  table: T.materials,
  optionalFields: ["description"],
  label: "木材",
});
