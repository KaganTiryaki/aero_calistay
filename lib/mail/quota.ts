export function availableApprovalSlots(input: {
  dailySent: number; approvalBudget: number; providerRemaining: number; reserve: number;
}): number {
  const local = input.approvalBudget - input.dailySent;
  const provider = input.providerRemaining - input.reserve;
  return Math.max(0, Math.floor(Math.min(local, provider)));
}
