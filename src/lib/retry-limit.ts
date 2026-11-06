// One bounded retry policy for Composer's own workflow runs and notification
// delivery. The UI, zod contracts, SQL guards and messages read this value so a
// raised or lowered limit cannot leave a stale copy behind.
export const MAX_ATTEMPTS = 3;
