export const projectStatusLabels = {
  active: "進行中",
  paused: "休止中",
  completed: "完了",
  archived: "アーカイブ"
} as const;
export type ProjectStatus = keyof typeof projectStatusLabels;
export function projectStatusLabel(status?: string) {
  return status && status in projectStatusLabels ? projectStatusLabels[status as ProjectStatus] : "";
}
