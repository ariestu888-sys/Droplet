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
import type {
  CreateSponsor,
  EventSplashPage,
  Sponsor,
  SponsorList,
  SplashColors,
  SplashContent,
  SplashPage,
  UpdateSplash,
} from "./splash";
import type {
  AcceptInvitationResult,
  CreateInvitation,
  CreateInvitationResult,
  InvitationDetails,
  InvitationList,
  CreateJoinLink,
  JoinLink,
  JoinLinkDetails,
  JoinLinkList,
  MemberList,
  SubscribeResult,
  UpdateMemberRole,
} from "./members";

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
    members: {
      /** Members with names, emails and roles (organizers only). */
      list: (organizationId: string) =>
        request<MemberList>("GET", `/v1/organizations/${encodeURIComponent(organizationId)}/members`),
      setRole: (organizationId: string, userId: string, input: UpdateMemberRole) =>
        request<null>(
          "PATCH",
          `/v1/organizations/${encodeURIComponent(organizationId)}/members/${encodeURIComponent(userId)}`,
          input,
        ),
      remove: (organizationId: string, userId: string) =>
        request<null>(
          "DELETE",
          `/v1/organizations/${encodeURIComponent(organizationId)}/members/${encodeURIComponent(userId)}`,
        ),
      /** Leave an organization (anyone but the owner). */
      leave: (organizationId: string) =>
        request<null>("POST", `/v1/organizations/${encodeURIComponent(organizationId)}/leave`),
      /** Subscribe to an organization's updates; existing members keep their role. */
      subscribe: (organizationId: string) =>
        request<SubscribeResult>("POST", `/v1/organizations/${encodeURIComponent(organizationId)}/subscribe`),
    },
    invitations: {
      /** Pending invitations (organizers only). */
      list: (organizationId: string) =>
        request<InvitationList>("GET", `/v1/organizations/${encodeURIComponent(organizationId)}/invitations`),
      create: (organizationId: string, input: CreateInvitation) =>
        request<CreateInvitationResult>(
          "POST",
          `/v1/organizations/${encodeURIComponent(organizationId)}/invitations`,
          input,
        ),
      revoke: (invitationId: string) => request<null>("DELETE", `/v1/invitations/${encodeURIComponent(invitationId)}`),
      /** What an invite link shows. No sign-in needed. */
      getPublic: (token: string) =>
        request<InvitationDetails>("GET", `/v1/public/invitations/${encodeURIComponent(token)}`),
      accept: (token: string) =>
        request<AcceptInvitationResult>("POST", `/v1/invitations/${encodeURIComponent(token)}/accept`),
    },
    joinLinks: {
      /** Active join links, at most one per role (organizers). */
      list: (organizationId: string) =>
        request<JoinLinkList>("GET", `/v1/organizations/${encodeURIComponent(organizationId)}/join-links`),
      /** Creates the link for a role, replacing any active one. */
      create: (organizationId: string, input: CreateJoinLink) =>
        request<JoinLink>("POST", `/v1/organizations/${encodeURIComponent(organizationId)}/join-links`, input),
      revoke: (linkId: string) => request<null>("DELETE", `/v1/join-links/${encodeURIComponent(linkId)}`),
      /** What a join link shows. No sign-in needed. */
      getPublic: (token: string) =>
        request<JoinLinkDetails>("GET", `/v1/public/join-links/${encodeURIComponent(token)}`),
      accept: (token: string) =>
        request<AcceptInvitationResult>("POST", `/v1/join-links/${encodeURIComponent(token)}/accept`),
    },
    splash: {
      /** An organization's public splash page. No sign-in needed. */
      getPublic: (slug: string) =>
        request<SplashPage>("GET", `/v1/public/organizations/${encodeURIComponent(slug)}/splash`),
      get: (organizationId: string) =>
        request<SplashContent>("GET", `/v1/organizations/${encodeURIComponent(organizationId)}/splash`),
      update: (organizationId: string, input: UpdateSplash) =>
        request<SplashContent>("PUT", `/v1/organizations/${encodeURIComponent(organizationId)}/splash`, input),
      /** Splash page colors for the organization and its events (owner only). */
      updateColors: (organizationId: string, input: SplashColors) =>
        request<SplashColors>("PUT", `/v1/organizations/${encodeURIComponent(organizationId)}/splash/colors`, input),
      /** A public event's splash page. No sign-in needed. */
      getPublicEvent: (organizationSlug: string, eventId: string) =>
        request<EventSplashPage>(
          "GET",
          `/v1/public/organizations/${encodeURIComponent(organizationSlug)}/events/${encodeURIComponent(eventId)}/splash`,
        ),
      getEvent: (eventId: string) =>
        request<SplashContent>("GET", `/v1/events/${encodeURIComponent(eventId)}/splash`),
      updateEvent: (eventId: string, input: UpdateSplash) =>
        request<SplashContent>("PUT", `/v1/events/${encodeURIComponent(eventId)}/splash`, input),
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
