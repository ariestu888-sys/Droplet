import { z } from "zod";
import { OrganizationRoleSchema } from "./schemas";

// Organization members, invitations, and joining.

const InvitableRoleSchema = z
  .enum(["admin", "booster", "member", "subscriber"])
  .meta({ description: "Any role but owner. Only the owner can invite admins." });

export const MemberSchema = z
  .object({
    userId: z.uuid(),
    fullName: z.string().nullable().meta({ example: "Jamie Rivera" }),
    email: z.string().nullable(),
    role: OrganizationRoleSchema,
    joinedAt: z.iso.datetime({ offset: true }),
  })
  .meta({ id: "Member" });

export const MemberListSchema = z.object({ data: z.array(MemberSchema) }).meta({ id: "MemberList" });

export const UpdateMemberRoleSchema = z.object({ role: InvitableRoleSchema }).meta({ id: "UpdateMemberRole" });

export const InvitationSchema = z
  .object({
    id: z.uuid(),
    email: z.string().meta({ example: "jamie@example.com" }),
    role: InvitableRoleSchema,
    createdAt: z.iso.datetime({ offset: true }),
    expiresAt: z.iso.datetime({ offset: true }),
    inviteUrl: z.string().meta({ description: "Link that accepts the invitation. Share it only with the invitee." }),
  })
  .meta({ id: "Invitation" });

export const InvitationListSchema = z
  .object({ data: z.array(InvitationSchema).meta({ description: "Pending invitations, newest first." }) })
  .meta({ id: "InvitationList" });

export const CreateInvitationSchema = z
  .object({
    email: z.email("Enter an email address.").trim().toLowerCase().max(254),
    role: InvitableRoleSchema,
  })
  .meta({ id: "CreateInvitation" });

export const CreateInvitationResultSchema = z
  .object({
    invitation: InvitationSchema,
    emailSent: z.boolean().meta({ description: "False when email isn't configured; share inviteUrl yourself." }),
  })
  .meta({ id: "CreateInvitationResult" });

export const InvitationDetailsSchema = z
  .object({
    organization: z.object({ id: z.uuid(), name: z.string(), slug: z.string(), logoUrl: z.string().nullable() }),
    email: z.string(),
    role: InvitableRoleSchema,
    expiresAt: z.iso.datetime({ offset: true }),
    status: z.enum(["pending", "accepted", "revoked", "expired"]),
  })
  .meta({ id: "InvitationDetails" });

export const AcceptInvitationResultSchema = z.object({ organizationId: z.uuid() }).meta({ id: "AcceptInvitationResult" });

export const SubscribeResultSchema = z
  .object({ role: OrganizationRoleSchema.meta({ description: "Your role afterwards; existing members keep theirs." }) })
  .meta({ id: "SubscribeResult" });

// Join links: shareable links (and QR codes) anyone can use to join.
export const JOIN_LINK_ROLES = ["booster", "member", "subscriber"] as const;

const JoinLinkRoleSchema = z.enum(JOIN_LINK_ROLES).meta({ description: "Join links can grant booster, member or subscriber." });

export const JoinLinkSchema = z
  .object({
    id: z.uuid(),
    role: JoinLinkRoleSchema,
    url: z.string().meta({ description: "The link to share or turn into a QR code." }),
    createdAt: z.iso.datetime({ offset: true }),
  })
  .meta({ id: "JoinLink" });

export const JoinLinkListSchema = z
  .object({ data: z.array(JoinLinkSchema).meta({ description: "Active join links, at most one per role." }) })
  .meta({ id: "JoinLinkList" });

export const CreateJoinLinkSchema = z.object({ role: JoinLinkRoleSchema }).meta({ id: "CreateJoinLink" });

export const JoinLinkDetailsSchema = z
  .object({
    organization: z.object({ id: z.uuid(), name: z.string(), slug: z.string(), logoUrl: z.string().nullable() }),
    role: JoinLinkRoleSchema,
    status: z.enum(["active", "inactive"]),
  })
  .meta({ id: "JoinLinkDetails" });

export type JoinLinkRole = (typeof JOIN_LINK_ROLES)[number];
export type JoinLink = z.infer<typeof JoinLinkSchema>;
export type JoinLinkList = z.infer<typeof JoinLinkListSchema>;
export type CreateJoinLink = z.infer<typeof CreateJoinLinkSchema>;
export type JoinLinkDetails = z.infer<typeof JoinLinkDetailsSchema>;

export type Member = z.infer<typeof MemberSchema>;
export type MemberList = z.infer<typeof MemberListSchema>;
export type InvitableRole = z.infer<typeof InvitableRoleSchema>;
export type UpdateMemberRole = z.infer<typeof UpdateMemberRoleSchema>;
export type Invitation = z.infer<typeof InvitationSchema>;
export type InvitationList = z.infer<typeof InvitationListSchema>;
export type CreateInvitation = z.input<typeof CreateInvitationSchema>;
export type CreateInvitationResult = z.infer<typeof CreateInvitationResultSchema>;
export type InvitationDetails = z.infer<typeof InvitationDetailsSchema>;
export type AcceptInvitationResult = z.infer<typeof AcceptInvitationResultSchema>;
export type SubscribeResult = z.infer<typeof SubscribeResultSchema>;
