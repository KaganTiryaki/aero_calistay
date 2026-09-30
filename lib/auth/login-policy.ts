type Membership = { user_id: string; role: string; active: boolean };
export function isSharedAdminAuthorized(userId: string, membership: Membership | null): membership is Membership {
  return membership?.user_id === userId && membership.role === "admin" && membership.active;
}
