export type Narrator = {
  id: string;
  name: string;
  description: string | null;
  password: string | null;
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
  output_post_x: string | null;
  output_post_tiktok: string | null;
  output_post_instagram: string | null;
  is_favorite: boolean;
  created_at: string;
};

// SNS投稿用の文章（各プラットフォーム向け）
export type SnsPosts = {
  x: string;
  tiktok: string;
  instagram: string;
};

export type GenerateResult = {
  titles: string[];
  script: string;
  story: string;
  sns: SnsPosts;
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
    output_post_x: string | null;
    output_post_tiktok: string | null;
    output_post_instagram: string | null;
  } | null;
};

// ナレーター向けページで表示する 1 件分（未収録動画＋台本/ストーリー）
export type NarratorTask = {
  id: string;
  title: string;
  narration_status: NarrationStatus;
  created_at: string;
  output_titles: string | null;
  output_script: string | null;
  output_story: string | null;
};

export type NarratorTasksResponse = {
  role?: "admin" | "narrator";
  narrator: { id: string; name: string } | null;
  tasks: NarratorTask[];
};

// 動画編集者向けページで表示する 1 件分（動画生成が未完了＋台本/ストーリー）
export type EditorTask = {
  id: string;
  title: string;
  video_status: VideoStatus;
  created_at: string;
  output_titles: string | null;
  output_script: string | null;
  output_story: string | null;
};

export type EditorTasksResponse = {
  tasks: EditorTask[];
};
