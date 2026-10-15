import type {
  ApiError,
  CreateOrganization,
  Health,
  Organization,
  OrganizationList,
  OrganizationTypeList,
  Profile,
  UpdateOrganization,
  UpdateProfile,
} from "./schemas";
import type { CreateEvent, DropletEvent, EventList, EventTypeList } from "./events";
import type { CreateSponsor, Sponsor, SponsorList, UpdateSplash, SplashContent, SplashPage } from "./splash";

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

    // FormData (file uploads) sets its own multipart Content-Type.
    const isForm = typeof FormData !== "undefined" && body instanceof FormData;
    if (body !== undefined && !isForm) headers["Content-Type"] = "application/json";

    const res = await fetchImpl(`${root}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
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
    organizations: {
      list: () => request<OrganizationList>("GET", "/v1/organizations"),
      get: (id: string) => request<Organization>("GET", `/v1/organizations/${encodeURIComponent(id)}`),
      create: (input: CreateOrganization) => request<Organization>("POST", "/v1/organizations", input),
      update: (id: string, input: UpdateOrganization) =>
        request<Organization>("PATCH", `/v1/organizations/${encodeURIComponent(id)}`, input),
      removeLogo: (id: string) => request<Organization>("DELETE", `/v1/organizations/${encodeURIComponent(id)}/logo`),
      /** Upload or replace the logo: a PNG, JPEG or WebP image up to 2 MB. */
      uploadLogo: (id: string, file: Blob, filename = "logo") => {
        const form = new FormData();
        form.append("file", file, filename);
        return request<Organization>("PUT", `/v1/organizations/${encodeURIComponent(id)}/logo`, form);
      },
    },
    organizationTypes: {
      list: () => request<OrganizationTypeList>("GET", "/v1/organization-types"),
    },
    events: {
      /** An organization's events, soonest first. */
      listForOrganization: (organizationId: string) =>
        request<EventList>("GET", `/v1/organizations/${encodeURIComponent(organizationId)}/events`),
      create: (organizationId: string, input: CreateEvent) =>
        request<DropletEvent>("POST", `/v1/organizations/${encodeURIComponent(organizationId)}/events`, input),
      get: (id: string) => request<DropletEvent>("GET", `/v1/events/${encodeURIComponent(id)}`),
      /** Replaces the event's details; optional fields left out are cleared. */
      update: (id: string, input: CreateEvent) =>
        request<DropletEvent>("PUT", `/v1/events/${encodeURIComponent(id)}`, input),
      delete: (id: string) => request<null>("DELETE", `/v1/events/${encodeURIComponent(id)}`),
    },
    eventTypes: {
      list: () => request<EventTypeList>("GET", "/v1/event-types"),
    },
    splash: {
      /** An organization's public splash page. No sign-in needed. */
      getPublic: (slug: string) =>
        request<SplashPage>("GET", `/v1/public/organizations/${encodeURIComponent(slug)}/splash`),
      get: (organizationId: string) =>
        request<SplashContent>("GET", `/v1/organizations/${encodeURIComponent(organizationId)}/splash`),
      update: (organizationId: string, input: UpdateSplash) =>
        request<SplashContent>("PUT", `/v1/organizations/${encodeURIComponent(organizationId)}/splash`, input),
    },
    sponsors: {
      list: (organizationId: string) =>
        request<SponsorList>("GET", `/v1/organizations/${encodeURIComponent(organizationId)}/sponsors`),
      create: (organizationId: string, input: CreateSponsor) =>
        request<Sponsor>("POST", `/v1/organizations/${encodeURIComponent(organizationId)}/sponsors`, input),
      delete: (id: string) => request<null>("DELETE", `/v1/sponsors/${encodeURIComponent(id)}`),
      /** Upload or replace the sponsor's logo: a PNG, JPEG or WebP image up to 2 MB. */
      uploadLogo: (id: string, file: Blob, filename = "logo") => {
        const form = new FormData();
        form.append("file", file, filename);
        return request<Sponsor>("PUT", `/v1/sponsors/${encodeURIComponent(id)}/logo`, form);
      },
    },
  };
}

export type DropletApi = ReturnType<typeof createDropletApi>;
