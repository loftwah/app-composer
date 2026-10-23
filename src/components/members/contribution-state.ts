import {
  contributionInput,
  contributionReceipt,
  contributionStatus,
} from "../../lib/member-contribution-contract.ts";

export type ContributionAttempt = {
  readonly resource: string;
  readonly input: Readonly<ReturnType<typeof contributionInput.parse>>;
};
export function beginContribution(
  resource: string,
  input: Record<string, unknown>,
): ContributionAttempt {
  return Object.freeze({
    resource,
    input: Object.freeze(
      contributionInput.parse({
        ...input,
        operationId: crypto.randomUUID(),
      }),
    ),
  });
}
export function confirmContribution(
  attempt: ContributionAttempt,
  value: unknown,
) {
  const receipt = contributionReceipt.parse(value);
  if (
    receipt.resource !== attempt.resource ||
    receipt.operationId !== attempt.input.operationId
  )
    throw Error(
      "The receipt belongs to another submission. Keep the original operation and check its status.",
    );
  return receipt;
}
export function observeContribution(
  attempt: ContributionAttempt,
  value: unknown,
) {
  const result = contributionStatus.parse(value);
  if (
    result.resource !== attempt.resource ||
    result.operationId !== attempt.input.operationId
  )
    throw Error(
      "The status belongs to another submission. Keep the original operation and check again.",
    );
  if (result.receipt) confirmContribution(attempt, result.receipt);
  return result;
}

export async function contributionRecovery(
  attempt: ContributionAttempt,
  value: unknown,
) {
  const observed = observeContribution(attempt, value);
  if (observed.outcome === "not-recorded") return "retry" as const;
  if (
    observed.outcome !== "pending" ||
    !observed.resumablePending ||
    !observed.identity
  )
    return undefined;
  const { operationId, caption, author, consent, png } = attempt.input;
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(
      JSON.stringify({ operationId, caption, author, consent, png }),
    ),
  );
  const digest = Array.from(new Uint8Array(hash), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  if (observed.identity.bodyDigest !== digest)
    throw Error(
      "The original receipt does not match the retained postcard data. Keep the operation identity; no resume was sent.",
    );
  return "resume" as const;
}

// Called only by the explicit recovery button; always sends the original input.
export async function recoverContribution(
  attempt: ContributionAttempt,
  value: unknown,
  dispatch: (input: ContributionAttempt["input"]) => Promise<unknown>,
) {
  if (!(await contributionRecovery(attempt, value)))
    throw Error(
      "The original submission is not eligible to resume. Check its current receipt; no submission was sent.",
    );
  return confirmContribution(attempt, await dispatch(attempt.input));
}
