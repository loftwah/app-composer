// Narrow type boundary for the existing bounded filesystem helper. MIT.
import type { Buffer } from "node:buffer";
export type SelectedFile =
  | { state: "present"; sha256: string; data: Buffer }
  | { state: "absent" | "denied" | "refused" | "oversize" | "changed" };
export declare function selectedFile(
  root: string,
  name: string,
  limit?: number,
  options?: { allowHardlinks?: boolean },
): SelectedFile;
