import {
  decisionChoiceTitle,
  decisionImageUrl,
  decisionReactionLabels,
  type Decision,
  type DecisionImage,
  type DecisionResponse,
} from "../lib/portfolio-decision-contract";

export function DecisionMedia({
  id,
  links,
  image,
}: {
  id: string;
  links?: string[];
  image?: DecisionImage | null;
}) {
  if (!image && !links?.length) return null;
  return (
    <ul className="decision-media-links" aria-label="Saved media">
      {image && (
        <li>
          <a
            href={decisionImageUrl(id, image.revision)}
            target="_blank"
            rel="noreferrer"
          >
            {image.name}
          </a>
        </li>
      )}
      {links?.map((url, index) => (
        <li key={`${url}-${index}`}>
          <a href={url} target="_blank" rel="noreferrer">
            {url}
          </a>
        </li>
      ))}
    </ul>
  );
}

export function DecisionResponseContent({
  decision,
  response,
}: {
  decision: Decision;
  response: DecisionResponse;
}) {
  return (
    <>
      {response.reaction && <p>{decisionReactionLabels[response.reaction]}</p>}
      {response.selected.length > 0 && (
        <p>
          {response.selected
            .map((id) => decisionChoiceTitle(decision, id))
            .join(" · ")}
        </p>
      )}
      {response.note && (
        <p className="decision-feedback-note">{response.note}</p>
      )}
      <DecisionMedia
        id={decision.id}
        links={response.media}
        image={response.image}
      />
    </>
  );
}
