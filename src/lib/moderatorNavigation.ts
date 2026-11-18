export type ModeratorTab = "automod" | "admin" | "audit" | "commands";

export const MODERATOR_AUDIT_HREF = "/dashboard/moderator?tab=audit";

export function readModeratorTab(value: string | null): ModeratorTab {
  switch (value) {
    case "admin":
    case "audit":
    case "commands":
      return value;
    default:
      return "automod";
  }
}
