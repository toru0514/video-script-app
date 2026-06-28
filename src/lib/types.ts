export type Narrator = {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
};

export type Script = {
  id: string;
  narrator_id: string;
  title: string;
  script: string;
  story: string;
  theme: string | null;
  note: string | null;
  created_at: string;
};

export type Product = {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
};

export type Pattern = {
  id: string;
  narrator_id: string;
  title_pattern: string | null;
  script_pattern: string | null;
  story_pattern: string | null;
  source_count: number;
  created_at: string;
};

export type Generation = {
  id: string;
  narrator_id: string | null;
  product_id: string | null;
  input_theme: string | null;
  output_titles: string | null;
  output_script: string | null;
  output_story: string | null;
  is_favorite: boolean;
  created_at: string;
};

export type GenerateResult = {
  titles: string[];
  script: string;
  story: string;
};

export type NarrationStatus = "not_requested" | "recording" | "done";
export type VideoStatus = "not_requested" | "rendering" | "done";
export type PublishStatus = "unpublished" | "published";

export type Video = {
  id: string;
  generation_id: string | null;
  script_id: string | null;
  narrator_id: string | null;
  product_id: string | null;
  title: string;
  narration_status: NarrationStatus;
  video_status: VideoStatus;
  publish_status: PublishStatus;
  note: string | null;
  created_at: string;
  updated_at: string;
};

export type VideoDetail = Video & {
  generation: {
    output_titles: string | null;
    output_script: string | null;
    output_story: string | null;
  } | null;
};
