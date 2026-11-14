/** Explain only what the receipt proves about an unconfirmed release. */
export function unconfirmedReleaseCopy(attempted: boolean): string {
  return attempted
    ? "The release was attempted, but this receipt does not confirm its outcome. Check the live source and Worker version before any retry."
    : "No release was attempted in this run, so there is no release claim to compare.";
}
