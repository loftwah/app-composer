import {
  contributionInput,
  contributionReceipt,
  contributionStatus,
} from "../../lib/member-contribution-contract.ts";

export type ContributionAttempt = {
  resource: string;
  input: ReturnType<typeof contributionInput.parse>;
};
export function beginContribution(
  resource: string,
  input: Record<string, unknown>,
): ContributionAttempt {
  return {
    resource,
    input: contributionInput.parse({
      ...input,
      operationId: crypto.randomUUID(),
    }),
  };
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
