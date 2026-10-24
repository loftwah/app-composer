import type { EmailMessage } from "emdash/plugin";
export function deliverResend(
  message: EmailMessage,
  runtime: {
    RESEND_API_KEY?: unknown;
    RESEND_FROM_ADDRESS?: unknown;
    RESEND_ALLOWED_RECIPIENTS?: unknown;
  },
  send?: typeof fetch,
  options?: { idempotencyKey?: string },
): Promise<{ accepted: true; id: string | null }>;
