import type { IncidentSitrep as Sitrep } from "../lib/incident-contract";

export function IncidentSitrep({ incident }: { incident: Sitrep }) {
  return (
    <section className="incident-sitrep" aria-label="Situation report">
      <div className="incident-mode">
        <strong>
          {incident.mode === "replay" ? "SIMULATED REPLAY" : "ISOLATED LAB"}
        </strong>
        <span>{incident.id}</span>
      </div>
      <h3>Situation report</h3>
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
      <h4>Observed</h4>
      <ul>
        {incident.observations.map((item, index) => (
          <li key={index}>
            {item.text} <small>Evidence: {item.evidence}</small>
          </li>
        ))}
      </ul>
      <h4>Hypotheses to test</h4>
      <ol>
        {incident.hypotheses.map((item, index) => (
          <li key={index}>
            <strong>{item.confidence}:</strong> {item.explanation}
            <p>Next check: {item.nextCheck}</p>
          </li>
        ))}
      </ol>
      <h4>Steps already taken</h4>
      {incident.stepsTaken.length ? (
        <ul>
          {incident.stepsTaken.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      ) : (
        <p>No response action recorded.</p>
      )}
      <h4>Unknowns and blockers</h4>
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
