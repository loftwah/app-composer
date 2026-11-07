// Release-health evidence for the shared Needs attention view.
//
// Only a recorded production release receipt that failed, or that performed an
// upload without an independent live read, becomes an item. A recorded receipt
// is evidence, not approval, and this module never reads a Worker or live page.
export interface ReleaseAttentionRow {
  id: string;
  commit_sha: string | null;
  environment: string | null;
  state: string;
  release_performed: number;
  verification_performed: number;
}

// Repeated attempts for the same commit and environment are one problem, while
// the underlying receipt rows remain available in Delivery runs.
export function releaseAttentionKey(row: ReleaseAttentionRow): string {
  return `${row.commit_sha ?? "unknown"}:${row.environment ?? "unknown"}`;
}

export function releaseAttentionCopy(row: ReleaseAttentionRow): {
  title: string;
  summary: string;
  action: string;
} {
  const uploadedWithoutRead =
    row.release_performed === 1 && row.verification_performed === 0;
  return {
    title: "A production release needs attention",
    summary: uploadedWithoutRead
      ? "The recorded release performed an upload but has no independent live read. Inspect the Worker version and live source before calling it accepted."
      : "The recorded release attempt did not complete. Inspect the actual Worker version and live source before any retry; do not repeat an ambiguous upload.",
    action: "Open Delivery runs",
  };
}
