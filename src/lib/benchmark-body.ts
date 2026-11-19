// Bounded streaming JSON body reader shared by the private benchmark APIs.
//
// No Request.text(): the reader is cancelled as soon as the hard byte ceiling
// is passed, and invalid UTF-8 is refused rather than decoded into replacement
// characters. Callers name their own messages so their public errors stay
// specific to the report or suite they accept.

export type BenchmarkBodyRead =
  | { ok: true; value: unknown }
  | { ok: false; status: number; error: string };

export type BenchmarkBodyMessages = {
  tooLarge: string;
  missing: string;
  unreadable: string;
  invalid: string;
};

export async function readBoundedJsonBody(
  request: Request,
  maxBytes: number,
  messages: BenchmarkBodyMessages,
): Promise<BenchmarkBodyRead> {
  const declared = request.headers.get("content-length");
  if (declared !== null) {
    const length = Number(declared);
    if (Number.isFinite(length) && length > maxBytes)
      return { ok: false, status: 413, error: messages.tooLarge };
  }
  const reader = request.body?.getReader();
  if (!reader) return { ok: false, status: 400, error: messages.missing };
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > maxBytes) {
        void reader.cancel().catch(() => {});
        return { ok: false, status: 413, error: messages.tooLarge };
      }
      chunks.push(part.value);
    }
  } catch {
    void reader.cancel().catch(() => {});
    return { ok: false, status: 400, error: messages.unreadable };
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    return { ok: false, status: 400, error: messages.invalid };
  }
  return { ok: true, value };
}
