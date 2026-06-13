import { forceLogout, getToken } from "@/store/auth";

export class ApiError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

type JsonBody = Record<string, unknown> | unknown[];
type RequestBody = JsonBody | FormData | undefined;

const baseUrl = (import.meta.env.VITE_API_URL ?? "").trim();

export const authRedirect = {
  toLogin: (): void => {
    window.location.assign("/login");
  },
};

function buildUrl(path: string): string {
  if (!baseUrl) {
    return path;
  }

  const normalizedBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

function formatValidationDetail(detail: unknown): string | null {
  if (!Array.isArray(detail) || detail.length === 0) {
    return null;
  }

  const formattedMessages = detail
    .map((entry) => {
      if (typeof entry !== "object" || entry === null) {
        return null;
      }
      const message = "msg" in entry ? (entry as { msg?: unknown }).msg : null;
      if (typeof message !== "string" || !message.trim()) {
        return null;
      }
      const location = "loc" in entry ? (entry as { loc?: unknown }).loc : null;
      if (!Array.isArray(location) || location.length === 0) {
        return message;
      }
      const joinedLocation = location
        .map((segment) => String(segment))
        .join(".");
      return `${joinedLocation}: ${message}`;
    })
    .filter((message): message is string => Boolean(message));

  if (formattedMessages.length === 0) {
    return null;
  }
  return formattedMessages.join(" | ");
}

function getErrorMessage(payload: unknown, defaultMessage: string): string {
  if (typeof payload !== "object" || payload === null || !("detail" in payload)) {
    return defaultMessage;
  }
  const detail = (payload as { detail?: unknown }).detail;
  if (typeof detail === "string" && detail.trim()) {
    return detail;
  }
  if (typeof detail === "object" && detail !== null && "message" in detail) {
    const message = (detail as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }
  const formattedValidation = formatValidationDetail(detail);
  if (formattedValidation) {
    return formattedValidation;
  }
  return defaultMessage;
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return response.json();
  }
  return response.text();
}

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: RequestBody;
};

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  const token = getToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(buildUrl(path), {
    ...options,
    headers,
    body:
      options.body === undefined
        ? undefined
        : options.body instanceof FormData
          ? options.body
          : JSON.stringify(options.body),
  });

  const payload = await parseResponseBody(response);

  if (!response.ok) {
    if (response.status === 401) {
      forceLogout();
      if (window.location.pathname !== "/login") {
        authRedirect.toLogin();
      }
      throw new ApiError("Unauthorized", 401, payload);
    }

    if (response.status === 413) {
      throw new ApiError(
        "Datei zu gross fuer den Upload (Server-Limit). Bitte kleinere Datei waehlen.",
        413,
        payload,
      );
    }

    const defaultMessage = response.status >= 500 ? "Server-Fehler" : "Request failed";
    const message = getErrorMessage(payload, defaultMessage);
    throw new ApiError(message, response.status, payload);
  }

  return payload as T;
}
