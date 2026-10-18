// Narrow type boundary for the existing identity-bound mutation helper. MIT.
export interface DirectoryIdentity {
  dev: number;
  ino: number;
}
export declare function childDirectory(
  parent: string,
  identity: DirectoryIdentity,
  name: string,
  exclusive?: boolean,
): DirectoryIdentity;
export declare function mutate(
  directory: string,
  identity: DirectoryIdentity,
  operation: {
    operation: "files";
    files: { name: string; text: string; encoding: "base64" }[];
  },
): Record<string, never>;
