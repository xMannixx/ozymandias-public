import { request } from "@/api/client";
import type { AuthTokenResponse, GoogleAuthUrlResponse, GoogleStatusResponse } from "@/api/types";

export function getGoogleAuthUrl(): Promise<GoogleAuthUrlResponse> {
  return request<GoogleAuthUrlResponse>("/auth/google/url");
}

export function getGoogleStatus(): Promise<GoogleStatusResponse> {
  return request<GoogleStatusResponse>("/auth/google/status");
}

export function disconnectGoogle(): Promise<{ disconnected: boolean }> {
  return request<{ disconnected: boolean }>("/auth/google/disconnect", {
    method: "POST",
  });
}

export function loginWithToken(token: string): Promise<AuthTokenResponse> {
  return request<AuthTokenResponse>("/auth/token", {
    method: "POST",
    body: { token },
  });
}
