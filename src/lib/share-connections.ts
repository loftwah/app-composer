// Shared contract for the owner Share connections page.
// Pure data only: no database, network or credential code. The native page
// validates exactly the status the owner route returns, and the route validates
// the same states it reports. A connection state describes configuration; it is
// never proof that a post was authorised or sent.
import { z } from "zod";
import {
  BLUESKY_HANDLE_MAX,
  blueskyIdentityResultSchema,
} from "./bluesky-account.ts";

export const SHARE_CONNECTION_STATES = [
  "connected",
  "not_configured",
  "invalid_handle",
  "unavailable",
] as const;

export type ShareConnectionState = (typeof SHARE_CONNECTION_STATES)[number];

// `stored` is the owner-managed setting, `environment` is the existing server
// fallback and `none` means neither is present. The page uses this to explain
// why a handle is present before the owner has saved one here.
export const SHARE_CONNECTION_HANDLE_SOURCES = [
  "stored",
  "environment",
  "none",
] as const;

export type ShareConnectionHandleSource =
  (typeof SHARE_CONNECTION_HANDLE_SOURCES)[number];

export const shareConnectionPublishingSchema = z
  .object({
    state: z.enum(SHARE_CONNECTION_STATES),
    handle: z.string().min(3).max(BLUESKY_HANDLE_MAX).nullable(),
    note: z.string().min(1).max(500),
  })
  .strict();

export const shareConnectionStatusSchema = z
  .object({
    ok: z.literal(true),
    handle: z.string().min(3).max(BLUESKY_HANDLE_MAX).nullable(),
    handleSource: z.enum(SHARE_CONNECTION_HANDLE_SOURCES),
    passwordConfigured: z.boolean(),
    identity: blueskyIdentityResultSchema,
    publishing: shareConnectionPublishingSchema,
  })
  .strict();

export type ShareConnectionPublishing = z.infer<
  typeof shareConnectionPublishingSchema
>;
export type ShareConnectionStatus = z.infer<typeof shareConnectionStatusSchema>;
