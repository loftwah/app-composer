import { useEffect, useRef, useState } from "react";
import {
  postcardJourney,
  readPostcardObservation,
  type PostcardObservation,
} from "../../lib/postcard-journey.ts";
import { call } from "./api";

export function PostcardJourney() {
  const [result, setResult] = useState<PostcardObservation | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const generation = useRef(0);
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );

  async function run() {
    const requestGeneration = ++generation.current;
    setChecking(true);
    setError("");
    setResult(null);
    try {
      const response = await call(
        "guestbook",
        "postcard-journey",
        {},
        "creator-hub",
      );
      if (requestGeneration === generation.current)
        setResult(readPostcardObservation(response.observation));
    } catch {
      if (requestGeneration === generation.current)
        setError(
          "Composer could not complete the check. Open the public form or try again.",
        );
    } finally {
      if (requestGeneration === generation.current) setChecking(false);
    }
  }

  return (
    <details className="ca-disclosure">
      <summary>Check the public postcard form</summary>
      <p className="ca-muted">
        Check whether the Creator Hub Guestbook serves the form with its
        required fields. This single request leaves submission, moderation and
        uptime unmeasured.
      </p>
      <button type="button" disabled={checking} onClick={() => void run()}>
        {checking ? "Checking…" : "Run form check"}
      </button>
      <div role="status" aria-live="polite">
        {checking ? <p>Checking the public Guestbook…</p> : null}
        {error ? <p>{error}</p> : null}
        {result ? (
          <>
            <p>
              <strong>{result.label}.</strong> {result.next}
            </p>
            <p className="ca-muted">
              Observed at{" "}
              <time dateTime={result.checkedAt}>
                {new Date(result.checkedAt).toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "medium",
                })}
              </time>{" "}
              (local time).
            </p>
          </>
        ) : null}
      </div>
      <div className="ca-links">
        <a href={postcardJourney.url} target="_blank" rel="noopener noreferrer">
          Open public form ↗
        </a>
        {result ? (
          <a
            download="creator-hub-postcard-form-check.json"
            href={
              "data:application/json," +
              encodeURIComponent(JSON.stringify(result, null, 2))
            }
          >
            Download check result
          </a>
        ) : null}
      </div>
    </details>
  );
}
