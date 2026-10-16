import { useEffect, useRef, useState } from "react";
import { call } from "./api";
import type { Item } from "./types";
export function PhotoPreview({
  item,
  refresh,
}: {
  item: Item;
  refresh: number;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    setFailed(false);
    void (async () => {
      try {
        const result = await call("guestbook", "preview", { id: item.id });
        const bytes = Uint8Array.from(atob(result.png), (char) =>
          char.charCodeAt(0),
        );
        const bitmap = await createImageBitmap(
          new Blob([bytes], { type: "image/png" }),
        );
        if (active && canvas.current) {
          canvas.current.width = bitmap.width;
          canvas.current.height = bitmap.height;
          canvas.current.getContext("2d")?.drawImage(bitmap, 0, 0);
        }
        bitmap.close();
      } catch {
        if (active) setFailed(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [item.id, item.revision, refresh]);
  return (
    <>
      {failed && (
        <p className="ca-muted">
          Preview unavailable. Refresh to check the source.
        </p>
      )}
      <canvas
        hidden={failed}
        className="ca-photo"
        ref={canvas}
        role="img"
        aria-label={item.caption || "Private contribution preview"}
      />
    </>
  );
}
