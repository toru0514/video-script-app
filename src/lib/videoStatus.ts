import type {
  NarrationStatus,
  VideoStatus,
  PublishStatus,
  Video,
} from "./types";

export const NARRATION_OPTIONS: { value: NarrationStatus; label: string }[] = [
  { value: "not_requested", label: "未依頼" },
  { value: "recording", label: "録り待ち" },
  { value: "done", label: "完了" },
];

export const VIDEO_OPTIONS: { value: VideoStatus; label: string }[] = [
  { value: "not_requested", label: "未依頼" },
  { value: "rendering", label: "待ち" },
  { value: "done", label: "完了" },
];

export const PUBLISH_OPTIONS: { value: PublishStatus; label: string }[] = [
  { value: "unpublished", label: "未公開" },
  { value: "published", label: "公開済み" },
];

export const NARRATION_VALUES = NARRATION_OPTIONS.map((o) => o.value);
export const VIDEO_VALUES = VIDEO_OPTIONS.map((o) => o.value);
export const PUBLISH_VALUES = PUBLISH_OPTIONS.map((o) => o.value);

type StatusFields = Pick<
  Video,
  "narration_status" | "video_status" | "publish_status"
>;

export function isUntouched(v: StatusFields): boolean {
  return (
    v.narration_status === "not_requested" &&
    v.video_status === "not_requested" &&
    v.publish_status === "unpublished"
  );
}
