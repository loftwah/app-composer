const extensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

async function clipboardPng(file: File): Promise<Blob> {
  if (file.type === "image/png") return file;

  const image = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext("2d");
    if (!context) throw Error("Image conversion is unavailable.");
    context.drawImage(image, 0, 0);
    return await new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(Error("Image conversion failed.")),
        "image/png",
      );
    });
  } finally {
    image.close();
  }
}

export function mountArtworkImageActions(piece: HTMLElement, signal?: AbortSignal) {
  const actions = piece.querySelector<HTMLElement>("[data-gallery-image]");
  const copy = piece.querySelector<HTMLButtonElement>("[data-gallery-copy-image]");
  const share = piece.querySelector<HTMLButtonElement>("[data-gallery-share-image]");
  const status = piece.querySelector<HTMLElement>("[data-gallery-image-status]");
  const url = actions?.dataset.galleryImage;
  const name = actions?.dataset.assetId;
  if (!url || !name || !copy || !share || !status) return;

  const canShareImage = Boolean(typeof navigator.share === "function" && navigator.canShare?.({
    files: [new File([], "artwork.png", { type: "image/png" })],
  }));
  copy.hidden = typeof navigator.clipboard?.write !== "function" || typeof ClipboardItem !== "function";
  share.hidden = !canShareImage;

  let pending: Promise<File> | undefined;
  let ready: File | undefined;
  let busy = false;

  const loadImage = () => {
    pending ??= (async () => {
      const timeout = AbortSignal.timeout(12_000);
      const response = await fetch(url, {
        cache: "no-store",
        credentials: "omit",
        redirect: "error",
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      });
      if (!response.ok) throw Error("The image could not be loaded.");
      const image = await response.blob();
      const extension = extensions[image.type];
      if (!extension || !image.size) throw Error("The image is unavailable.");
      ready = new File([image], `${name}.${extension}`, { type: image.type });
      return ready;
    })().catch((error) => {
      pending = undefined;
      throw error;
    });
    return pending;
  };

  // Native sharing needs the finished File at the moment of the tap.
  if (canShareImage) void loadImage().catch(() => {});

  const run = async (
    button: HTMLButtonElement,
    message: string,
    failure: string,
    action: () => Promise<void>,
  ) => {
    if (busy || signal?.aborted) return;
    busy = true;
    button.setAttribute("aria-busy", "true");
    status.textContent = message;
    try {
      await action();
    } catch (error) {
      status.textContent = error instanceof DOMException && error.name === "AbortError"
        ? ""
        : failure;
    } finally {
      button.removeAttribute("aria-busy");
      busy = false;
    }
  };

  copy.addEventListener("click", () => void run(
    copy,
    "Copying image…",
    canShareImage ? "Couldn’t copy the image. Try Share image or download it." : "Couldn’t copy the image. Use the download button or open Full size.",
    async () => {
      // Give Safari the PNG promise during the tap, before any network or decode wait.
      const png = loadImage().then(clipboardPng);
      void png.catch(() => {}); // The OS can reject the write before it consumes the PNG.
      await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
      status.textContent = "Image copied. Paste it where you want to share it.";
    },
  ));

  share.addEventListener("click", () => void run(
    share,
    ready ? "" : "Getting the image ready…",
    copy.hidden ? "Couldn’t share the image. Use the download button." : "Couldn’t share the image. Try Copy image or download it.",
    async () => {
      if (!ready) {
        await loadImage();
        status.textContent = "Image ready. Tap Share image to open the share sheet.";
        return;
      }
      const data = { files: [ready] };
      if (!navigator.canShare(data)) throw Error("File sharing is unavailable.");
      await navigator.share(data);
    },
  ));
}
