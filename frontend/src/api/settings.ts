import { request } from "@/api/client";
import type { UpdateSettingsRequest, UserSettingsResponse } from "@/api/types";

type KillSwitchRequest = {
  active: boolean;
};

export function getSettings(): Promise<UserSettingsResponse> {
  return request<UserSettingsResponse>("/settings");
}

export function updateSettings(payload: UpdateSettingsRequest): Promise<UserSettingsResponse> {
  return request<UserSettingsResponse>("/settings", {
    method: "PATCH",
    body: payload as Record<string, unknown>,
  });
}

export function toggleKillSwitch(active: boolean): Promise<UserSettingsResponse> {
  const payload: KillSwitchRequest = { active };
  return request<UserSettingsResponse>("/settings/kill-switch", {
    method: "POST",
    body: payload as Record<string, unknown>,
  });
}
