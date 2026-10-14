import type { ApiError, Health, Profile, UpdateProfile } from "./schemas";

// A small typed client for the Droplet API, usable from the website (server
// or browser) and from the mobile app.

export class DropletApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "DropletApiError";
  }
}

export type DropletApiOptions = {
  baseUrl: string;
  /** Returns the signed-in user's Supabase access token, if any. */
  getAccessToken?: () => Promise<string | null | undefined> | string | null | undefined;
  fetch?: typeof fetch;
};

export function createDropletApi({ baseUrl, getAccessToken, fetch: fetchImpl = fetch }: DropletApiOptions) {
  const root = baseUrl.replace(/\/+$/, "");

  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = { Accept: "application/json" };
    const token = await getAccessToken?.();
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers["Content-Type"] = "application/json";

    const res = await fetchImpl(`${root}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const data = (await res.json().catch(() => null)) as T | ApiError | null;
    if (!res.ok) {
      const err = (data as ApiError | null)?.error;
      throw new DropletApiError(res.status, err?.code ?? "http_error", err?.message ?? res.statusText);
    }
    return data as T;
  }

  return {
    health: () => request<Health>("GET", "/v1/health"),
    me: {
      get: () => request<Profile>("GET", "/v1/me"),
      update: (input: UpdateProfile) => request<Profile>("PATCH", "/v1/me", input),
    },
  };
}

export type DropletApi = ReturnType<typeof createDropletApi>;
