// Both image producers use the same resvg WASM singleton in a Worker isolate.
// Keep one promise across stack and analytics requests, including simultaneous
// first renders. Each producer supplies the same bundled module initializer.
let ready: Promise<void> | undefined;
export function shareImageReady(
  initialize: () => Promise<void>,
): Promise<void> {
  ready ??= Promise.resolve().then(initialize);
  return ready;
}
