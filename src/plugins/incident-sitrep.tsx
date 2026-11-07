import type { IncidentSitrep as Sitrep } from "../lib/incident-contract";

export function IncidentSitrep({ incident, level = 3 }: { incident: Sitrep; level?: 2 | 3 }) {
  const Heading = `h${level}` as "h2" | "h3";
  const Subheading = `h${level + 1}` as "h3" | "h4";
  return (
    <section className="incident-sitrep" aria-label="Situation report">
      <div className="incident-mode">
        <strong>
          {incident.mode === "replay" ? "SIMULATED REPLAY" : "ISOLATED LAB"}
        </strong>
        <span>{incident.id}</span>
      </div>
      <Heading>Situation report</Heading>
      <p className="incident-impact">{incident.impact}</p>
      <dl className="ap-facts">
        <dt>Service / owner</dt>
        <dd>
          {incident.service} · {incident.owner}
        </dd>
        <dt>First / last seen</dt>
        <dd>
          {incident.firstSeen} / {incident.lastSeen}
        </dd>
        <dt>Reported recovery</dt>
        <dd>
          {incident.recovery === "unverified"
            ? "Unverified — incident remains open"
            : incident.recovery === "blocked"
              ? "Blocked — safe investigation can continue"
              : "Reported verified in isolated lab — inspect cited evidence"}
        </dd>
        <dt>Owner notice</dt>
        <dd>
          {incident.notification === "not-configured"
            ? "Not configured — no email sent"
            : incident.notification === "not-sent"
              ? "Not sent"
              : "Provider evidence required"}
        </dd>
        <dt>PagerDuty</dt>
        <dd>Not connected</dd>
      </dl>
      <Subheading>Observed</Subheading>
      <ul>
        {incident.observations.map((item, index) => (
          <li key={index}>
            {item.text} <small>Evidence: {item.evidence}</small>
          </li>
        ))}
      </ul>
      <Subheading>Hypotheses to test</Subheading>
      <ol>
        {incident.hypotheses.map((item, index) => (
          <li key={index}>
            <strong>{item.confidence}:</strong> {item.explanation}
            <p>Next check: {item.nextCheck}</p>
          </li>
        ))}
      </ol>
      <Subheading>Steps already taken</Subheading>
      {incident.stepsTaken.length ? (
        <ul>
          {incident.stepsTaken.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      ) : (
        <p>No response action recorded.</p>
      )}
      <Subheading>Unknowns and blockers</Subheading>
      <ul>
        {incident.unknowns.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>
      <p>
        <strong>Next update:</strong> {incident.nextUpdate}
      </p>
    </section>
  );
}
