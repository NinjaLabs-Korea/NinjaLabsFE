// Single source for the member (team) roles. The order is the display order (member filter chips, the admin role picker),
// and the lower-cased label is the message key (`members.roles.<role>`; `admin.users.roles.<Label>` keeps the label). The BE
// codes (CORE, DEV ...) and their mapping live in `api/codecs.ts MEMBER_ROLE_LABELS`.

export const MEMBER_ROLES = ["Core", "Dev", "Design", "Ops"] as const;

export type MemberRole = (typeof MEMBER_ROLES)[number];
