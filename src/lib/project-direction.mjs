import { validateReferenceEvidence } from "./reference-evidence.mjs";

export const projectDirectionVersion = 1;
export const maxProjectReferences = 3;
export const referenceStatuses = ["selected", "exploratory", "rejected"];

function checkFields(value, fields, label) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(label + " must be an object");
  if (Object.keys(value).some((key) => !fields.includes(key)))
    throw new Error("Unknown field in " + label.toLowerCase());
}

function validateReference(value, validText) {
  checkFields(value, ["source", "decision", "status", "usage"], "Reference");
  const source = validText(value.source, 360, "Reference source");
  const decision = validText(value.decision, 240, "Reference decision");
  const usage = validText(value.usage ?? "", 120, "Reference usage notes");
  if (!source || !decision)
    throw new Error(
      "Add a source and a decision for each reference, or remove the unfinished reference",
    );
  if (!referenceStatuses.includes(value.status))
    throw new Error(
      "Choose whether the reference is selected, exploratory or rejected",
    );
  if (/^[a-z][a-z0-9+.-]*:/i.test(source) || source.startsWith("//")) {
    let url;
    try {
      url = new URL(source);
    } catch {
      throw new Error("Use a public HTTPS reference link or a product name");
    }
    if (url.protocol !== "https:" || url.username || url.password)
      throw new Error("Use a public HTTPS reference link or a product name");
  }
  return {
    source,
    decision,
    status: value.status,
    ...(usage ? { usage } : {}),
  };
}

export function validateProjectDirection(value, validText) {
  if (value === undefined) return undefined;
  checkFields(
    value,
    ["version", "voice", "visual", "references", "evidence"],
    "Creative direction",
  );
  if (value.version !== projectDirectionVersion)
    throw new Error(
      "Unsupported creative direction version. Keep the original draft and use a compatible version of Init",
    );
  const voice = validText(value.voice ?? "", 320, "Writing voice");
  const visual = validText(value.visual ?? "", 320, "Visual direction");
  const references = value.references ?? [];
  if (!Array.isArray(references) || references.length > maxProjectReferences)
    throw new Error("Use up to three project references");
  const validatedReferences = references.map((reference) =>
    validateReference(reference, validText),
  );
  const evidence = validateReferenceEvidence(value.evidence, validatedReferences);
  if (!voice && !visual && !references.length) return undefined;
  return {
    version: projectDirectionVersion,
    ...(voice ? { voice } : {}),
    ...(visual ? { visual } : {}),
    references: validatedReferences,
    ...(evidence ? { evidence } : {}),
  };
}
