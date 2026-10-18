// MIT. Hydrate only ready app-owned image records. Imported 1.2 image values
// can retain an empty external-provider ID after their URL is rewritten locally.
// Current owner-edited alt/caption must come from media storage, not a fixture.
import type { ImageValue } from "emdash";
import { getDb } from "emdash/runtime";
export async function ownedImage(
  image: ImageValue | string | null | undefined,
) {
  const fallback = { image, caption: "" };
  if (!image) return fallback;
  const src = typeof image === "string" ? image : image.src;
  const key =
    typeof src === "string"
      ? /^\/_emdash\/api\/media\/file\/([A-Za-z0-9_-]{1,100}\.(?:webp|png|jpe?g|gif|avif))$/.exec(
          src,
        )?.[1]
      : undefined;
  const id =
    typeof image === "object" &&
    (!image.provider || image.provider === "local") &&
    /^[0-9A-HJKMNP-TV-Z]{26}$/.test(image.id)
      ? image.id
      : undefined;
  if (!key && !id) return fallback;
  const db = await getDb();
  const query = db
    .selectFrom("media")
    .select(["id", "storage_key", "alt", "caption", "width", "height"])
    .where("status", "=", "ready")
    .where("mime_type", "like", "image/%");
  const row = await (
    key ? query.where("storage_key", "=", key) : query.where("id", "=", id!)
  ).executeTakeFirst();
  if (!row) return { image: null, caption: "" };
  return {
    image: {
      provider: "local",
      id: row.id,
      meta: { storageKey: row.storage_key },
      alt: row.alt ?? "",
      ...(row.width ? { width: row.width } : {}),
      ...(row.height ? { height: row.height } : {}),
    } satisfies ImageValue,
    caption: row.caption ?? "",
  };
}
