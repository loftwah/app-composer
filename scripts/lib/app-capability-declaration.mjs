// Validates an optional, app-owned agent capability declaration inside an
// existing mini-app manifest. A declaration describes operations that already
// exist; it never grants permission, executes code or carries a credential.
const operationKeys = [
  "name",
  "description",
  "kind",
  "method",
  "path",
  "availability",
  "requires",
  "confirmation",
  "verified",
];
const declarationKeys = ["version", "ui", "storage", "operations"];
const availability = ["public", "guest-invitation", "owner-scope", "local"];

function fail(message) {
  throw new Error("Capability declaration: " + message);
}

function text(value, max, label) {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.length > max ||
    /[\u0000-\u001f\u007f]/.test(value)
  )
    fail(label + " must be short readable text");
  return value.trim();
}

function exactKeys(value, keys, label) {
  const actual = Object.keys(value).sort().join(",");
  const expected = [...keys].sort().join(",");
  if (actual !== expected) fail(label + " has unsupported fields");
}

function path(value) {
  const result = text(value, 120, "operation path");
  if (
    !/^\/[a-z0-9:/_-]+$/i.test(result) ||
    result.includes("//") ||
    result.includes("..") ||
    result.includes("?") ||
    result.includes("#")
  )
    fail("operation path must be a safe relative path");
  return result;
}

function date(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    fail("operation review must be a date");
  return value;
}

function operation(value, index) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    fail("operation " + index + " must be an object");
  exactKeys(value, operationKeys, "operation " + index);
  if (!/^[a-z][a-z0-9-]{0,40}$/.test(value.name))
    fail("operation name is invalid");
  text(value.description, 240, "operation description");
  if (!["read", "effect"].includes(value.kind))
    fail("operation kind must be read or effect");
  if (!["GET", "POST"].includes(value.method))
    fail("operation method is unsupported");
  path(value.path);
  if (!availability.includes(value.availability))
    fail("operation availability is unsupported");
  if (
    !Array.isArray(value.requires) ||
    value.requires.length > 4 ||
    value.requires.some((item) => !/^[a-z][a-z0-9-]{0,40}$/.test(item))
  )
    fail("operation requirements must be short identifiers");
  date(value.verified);
  if (
    value.kind === "effect" &&
    (!value.confirmation || !value.requires.length)
  )
    fail("effect operation requires confirmation and a stated permit");
  if (value.kind === "read" && value.confirmation)
    fail("read operation cannot require a write confirmation");
  if (value.availability === "public" && value.kind === "effect")
    fail("public effect operation must be scoped");
  return value;
}

/** Validates one optional app-owned declaration. It does not grant anything. */
export function validateAgentCapabilitiesDeclaration(value, appId) {
  const label = appId ? " for " + appId : "";
  if (!value || typeof value !== "object" || Array.isArray(value))
    fail("declaration" + label + " must be an object");
  exactKeys(value, declarationKeys, "declaration");
  if (value.version !== 1) fail("version must be 1");
  if (value.ui !== undefined) {
    const ui = text(value.ui, 2048, "ui");
    if (!ui.startsWith("/") && !ui.startsWith("https://"))
      fail("ui must be a supported link");
  }
  if (
    value.storage !== undefined &&
    !["app-owned", "browser-local", "none"].includes(value.storage)
  )
    fail("storage is unsupported");
  if (!Array.isArray(value.operations) || !value.operations.length)
    fail("operations must be a non-empty array");
  if (value.operations.length > 8) fail("operations must be bounded");
  const names = new Set();
  value.operations.forEach((item, index) => {
    operation(item, index);
    if (names.has(item.name)) fail("operation is repeated: " + item.name);
    names.add(item.name);
  });
  if (
    /(?:"[^"]*(?:secret|password|api[_-]?key|authorization)[^"]*"\s*:)/i.test(
      JSON.stringify(value),
    )
  )
    fail("declaration must not carry credentials");
  return value;
}
