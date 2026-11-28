import { adminDecisions } from "../lib/portfolio-decision-contract";
import {
  socialLabels,
  socialStatuses,
  type ResearchReply,
} from "../lib/decision-research-contract";

const levelLabels = { good: "Use now", fix: "Fix next", moonshot: "Moonshot" };

export function DecisionIntelligencePanel({
  result,
  onGo,
}: {
  result: Extract<ResearchReply, { view: "intel" }>;
  onGo: (id: string) => void;
}) {
  const { snapshot, findings, pins, evidence } = result;
  return (
    <>
      <p>See what to use, what to fix and where to try something bigger.</p>
      <section aria-labelledby="intel-share">
        <h3 id="intel-share">Share social review</h3>
        <p>
          {snapshot.artwork.toLocaleString()} artwork records in the{" "}
          <time dateTime={snapshot.evaluatedAt}>
            {new Date(snapshot.evaluatedAt).toLocaleDateString("en-AU", {
              dateStyle: "medium",
            })}
          </time>{" "}
          snapshot. Clef assessed thumbnails for visual fit. Check the original,
          permissions and final export before publishing.
        </p>
        <ul
          className="decision-intel-totals"
          aria-label="Artwork review results"
        >
          {socialStatuses.map((status) => (
            <li
              key={status}
              data-level={
                status === "promising"
                  ? "good"
                  : status === "revise"
                    ? "fix"
                    : undefined
              }
            >
              <a href={`${adminDecisions}?view=share&social=${status}`}>
                <strong>{snapshot.counts[status].toLocaleString()}</strong>{" "}
                {socialLabels[status]}
              </a>
            </li>
          ))}
        </ul>
        <p>
          <a href={`${adminDecisions}?view=share&kind=film`}>
            {snapshot.films} film entries
          </a>
          {snapshot.filmReviewed > 0 && (
            <> · {snapshot.filmUnique} distinct openings reviewed</>
          )}
          {" · "}
          <a href="/share/intelligence.csv">Public CSV</a>
          {" · "}
          <a href={evidence} target="_blank" rel="noreferrer">
            Method and evidence
          </a>
        </p>
      </section>
      <section aria-labelledby="intel-next">
        <h3 id="intel-next">Where to act</h3>
        <ul className="decision-research-list">
          {findings.map((finding) => (
            <li key={finding.title}>
              <span className="decision-intel-level" data-level={finding.level}>
                {levelLabels[finding.level]}
              </span>
              <h4>{finding.title}</h4>
              <p>{finding.text}</p>
              <a
                href={
                  finding.href.startsWith("?")
                    ? adminDecisions + finding.href
                    : finding.href
                }
              >
                {finding.label}
              </a>
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="intel-pins">
        <h3 id="intel-pins">Rules pinboard</h3>
        <p>
          Open the source for the current rule. Leave feedback here and it stays
          with the decision.
        </p>
        <ul className="decision-research-list">
          {pins.map((pin) => (
            <li key={pin.id}>
              <div className="decision-research-row">
                <div>
                  <h4>{pin.title}</h4>
                  <p>{pin.text}</p>
                  <a href={pin.source} target="_blank" rel="noreferrer">
                    Read source
                  </a>
                </div>
                <button
                  type="button"
                  onClick={() => onGo(pin.id)}
                  aria-label={`Feedback on ${pin.title}`}
                >
                  {pin.answered ? "View feedback" : "Leave feedback"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
