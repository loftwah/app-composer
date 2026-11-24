// One device draft for Top Nine: the portable draft file plus up to nine local
// cover blobs, kept in a single origin-local IndexedDB record. The bytes never
// leave the browser — nothing here fetches a URL or uploads anything; the
// module only stores and returns what the caller already holds.
//
// A read has three outcomes: undefined means no record exists, so the caller
// may restore a legacy localStorage draft; null is an explicit Clear tombstone
// that stops localStorage ever coming back; a draft is the stored value. Every
// read and write resolves only after its transaction completes, a blocked or
// failed open rejects, and each connection is closed when its one transaction
// finishes.

import { draftFileLimit } from "../lib/share-experience-draft.ts";
import type { CoverFit } from "../lib/top-nine-cover.ts";

export interface DeviceCover {
  blob: Blob;
  fit: CoverFit;
}

export interface DeviceDraft {
  file: string;
  covers: (DeviceCover | null)[];
}

const dbName = "composer-top-nine-device-draft";
const dbVersion = 1;
const storeName = "drafts";
const currentKey = "current";
const recordVersion = 1;
const nineCovers = 9;
/** One cover is a single 720×720 PNG; nine of them share the same 20 MB
 * ceiling the cover picker already uses, with room to spare per file. */
const coverBlobLimit = 3 * 1024 * 1024;
const coversTotalLimit = 20 * 1024 * 1024;

interface StoredCover {
  bytes: ArrayBuffer;
  fit: CoverFit;
}

interface StoredDraft {
  file: string;
  covers: (StoredCover | null)[];
}

interface DraftRecord {
  version: number;
  draft: StoredDraft;
}

/** Safari can reject Blob values in IndexedDB. A bounded ArrayBuffer keeps
 * each PNG's exact bytes without relying on the browser's backing file store. */
function validateDraft(value: unknown): StoredDraft {
  const bad = (why: string) => { throw new TypeError(`Top Nine device draft: ${why}`); };
  if (!value || typeof value !== "object") return bad("not an object");
  const draft = value as Partial<StoredDraft>;
  if (typeof draft.file !== "string" || draft.file.length > draftFileLimit
    || new TextEncoder().encode(draft.file).byteLength > draftFileLimit) return bad("file is too large");
  if (!Array.isArray(draft.covers) || draft.covers.length !== nineCovers) return bad("wrong number of cover slots");
  let total = 0;
  for (const cover of draft.covers) {
    if (cover === null) continue;
    if (!cover || (cover.fit !== "cover" && cover.fit !== "contain")
      || !(cover.bytes instanceof ArrayBuffer) || !cover.bytes.byteLength
      || cover.bytes.byteLength > coverBlobLimit) return bad("invalid cover");
    total += cover.bytes.byteLength;
  }
  if (total > coversTotalLimit) return bad("covers are too large together");
  return { file: draft.file, covers: draft.covers };
}

function openDraftDb(storage: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = storage.open(dbName, dbVersion);
    let blocked = false;
    request.onupgradeneeded = () => {
      if (blocked) {
        request.transaction?.abort();
        return;
      }
      const db = request.result;
      if (!db.objectStoreNames.contains(storeName)) db.createObjectStore(storeName);
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      if (blocked) db.close();
      else resolve(db);
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => {
      blocked = true;
      reject(new DOMException("Top Nine device draft open blocked", "InvalidStateError"));
    };
  });
}

/** One request inside one transaction: the promise settles only on
 * transaction completion, so a failed write can never read back as saved. */
function transact<T>(
  db: IDBDatabase,
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    tx.onabort = () => reject(tx.error ?? new DOMException("Draft transaction aborted", "AbortError"));
    try {
      const request = work(tx.objectStore(storeName));
      tx.oncomplete = () => resolve(request.result);
    } catch (error) {
      tx.abort();
      reject(error);
    }
  });
}

/** undefined: no record, so legacy localStorage may be restored. null: the
 * explicit tombstone left by Clear. Otherwise the stored draft, revalidated
 * against the same bounds a write enforces. */
export async function readDeviceDraft(storage: IDBFactory): Promise<DeviceDraft | null | undefined> {
  const db = await openDraftDb(storage);
  try {
    const record = await transact(db, "readonly", (store) => store.get(currentKey));
    if (record === undefined) return undefined;
    if (record === null) return null;
    if (typeof record !== "object" || (record as DraftRecord).version !== recordVersion) {
      throw new TypeError("Top Nine device draft: record is unreadable");
    }
    const saved = validateDraft((record as DraftRecord).draft);
    return {
      file: saved.file,
      covers: saved.covers.map((cover) => cover
        ? { blob: new Blob([cover.bytes], { type: "image/png" }), fit: cover.fit }
        : null),
    };
  } finally {
    db.close();
  }
}

/** Saves the whole draft as one record in one transaction — the file string
 * and every blob land together or not at all. Pass null to write the Clear
 * tombstone. An invalid draft, a failed or blocked transaction rejects. */
export async function writeDeviceDraft(storage: IDBFactory, draft: DeviceDraft | null): Promise<void> {
  let record: DraftRecord | null = null;
  if (draft) {
    const covers = await Promise.all(draft.covers.map(async (cover) => {
      if (!cover) return null;
      if (cover.blob.type !== "image/png" || cover.blob.size > coverBlobLimit) {
        throw new TypeError("Top Nine device draft: invalid PNG");
      }
      return { bytes: await cover.blob.arrayBuffer(), fit: cover.fit };
    }));
    record = { version: recordVersion, draft: validateDraft({ file: draft.file, covers }) };
  }
  const db = await openDraftDb(storage);
  try {
    await transact(db, "readwrite", (store) => store.put(record, currentKey));
  } finally {
    db.close();
  }
}
