import type { IsoDateTime, UserId } from "./common";

export interface BlogEmailPreference {
  readonly user_id: UserId;
  readonly blog_announcements_enabled: boolean;
  readonly updated_at: IsoDateTime;
}

export interface BlogEmailPreferenceBody {
  readonly blog_announcements_enabled: boolean;
}
