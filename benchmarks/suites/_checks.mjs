// Shared helper for the suites. Not a suite itself: the runner skips files whose
// names start with "_".
//
// A failed assertion becomes one `fail` check with its reason, so a suite keeps
// reporting the other claims it can still prove.
/**
 * @param {string} id
 * @param {string} name
 * @param {() => string | void} body
 */
export function check(id, name, body) {
  try {
    const detail = body();
    return {
      id,
      name,
      status: "pass",
      detail: typeof detail === "string" && detail ? detail : "Held.",
    };
  } catch (error) {
    return {
      id,
      name,
      status: "fail",
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}
