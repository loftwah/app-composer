// Versioned static mini-app configuration. It contains no document data or authority.
export function validatePaperworkConfig(value) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    value.version !== 1 ||
    Object.keys(value).some(
      (key) => !["version", "title", "intro", "theme"].includes(key),
    )
  )
    throw Error("Unsupported Paperwork configuration.");
  if (
    typeof value.title !== "string" ||
    !value.title.trim() ||
    value.title.length > 80 ||
    typeof value.intro !== "string" ||
    value.intro.length > 240 ||
    /[\x00-\x1f\x7f]/.test(value.title + value.intro) ||
    !["daylight", "midnight"].includes(value.theme)
  )
    throw Error(
      "Use a title up to 80 characters, an introduction up to 240 and a supported theme.",
    );
  return {
    version: 1,
    title: value.title.trim(),
    intro: value.intro,
    theme: value.theme,
  };
}
