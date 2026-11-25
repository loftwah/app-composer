// Progressive enhancement for the shareable insight. The server-rendered card,
// caption, address and download remain complete without this file; copy and
// native share are added only when the browser supports them.
const root = document.querySelector<HTMLElement>("[data-insight-share]");

if (root) {
  const payloadElement = root.querySelector<HTMLScriptElement>(
    "[data-insight-payload]",
  );
  const statusNode = root.querySelector<HTMLElement>("[data-insight-status]");
  const caption = root.querySelector<HTMLTextAreaElement>(
    "[data-insight-caption]",
  );
  const url = root.querySelector<HTMLInputElement>("[data-insight-url]");
  const show = (message: string) => {
    if (statusNode) statusNode.textContent = message;
  };
  let payload: { url: string; title: string; text: string } | undefined;
  try {
    const parsed = JSON.parse(payloadElement?.textContent ?? "");
    if (
      typeof parsed?.url === "string" &&
      typeof parsed?.title === "string" &&
      typeof parsed?.text === "string"
    )
      payload = parsed;
  } catch {
    payload = undefined;
  }
  if (!payload)
    show("The share details are unavailable. The page still reads.");

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      show(
        `${label} copied.`,
      );
      return;
    } catch {
      /* Fall through to the visible, selectable field. */
    }
    const field = label === "Caption" ? caption : url;
    if (field) {
      field.focus();
      field.select();
      show(`Copy is unavailable here. ${label} is selected; copy it manually.`);
    } else
      show(
        `Copy is unavailable here. Select the ${label.toLowerCase()} manually.`,
      );
  };

  for (const button of root.querySelectorAll<HTMLButtonElement>(
    "[data-insight-copy]",
  )) {
    const target =
      button.dataset.insightCopy === "caption" ? "Caption" : "Link";
    button.hidden = false;
    button.addEventListener("click", () => {
      if (target === "Caption") {
        if (payload) void copy(payload.text, "Caption");
      } else if (url) void copy(url.value, "Link");
      else if (payload) void copy(payload.url, "Link");
    });
  }

  if (payload && typeof navigator.share === "function") {
    const native = root.querySelector<HTMLButtonElement>(
      "[data-insight-native]",
    );
    if (native) {
      native.hidden = false;
      native.addEventListener("click", async () => {
        try {
          await navigator.share({
            title: payload!.title,
            text: payload!.text,
            url: payload!.url,
          });
          show(
            "Opened your device’s share menu.",
          );
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError")
            show("Share cancelled. The insight is still here.");
          else show("This device could not share it. Copy the link instead.");
        }
      });
    }
  }
}

export {};
