const payloadElement = document.querySelector<HTMLScriptElement>("[data-report-payload]");
const nativeButton = document.querySelector<HTMLButtonElement>("[data-report-native]");
const copyButton = document.querySelector<HTMLButtonElement>("[data-report-copy]");
const statusNode = document.querySelector<HTMLElement>("[data-report-status]");
const fallback = document.querySelector<HTMLElement>("[data-report-fallback]");
const input = fallback?.querySelector<HTMLInputElement>("input");
if (payloadElement && statusNode) {
  let payload: { url: string; title: string; text: string };
  try {
    payload = JSON.parse(payloadElement.textContent ?? "");
    if (!payload.url || !payload.title || !payload.text) throw new Error();
  } catch {
    statusNode.textContent = "The share details are unavailable. The report is still readable.";
    payload = { url: location.href, title: document.title, text: document.title };
  }
  const show = (message: string) => {
    statusNode.textContent = message;
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(payload.url);
      show("Report link copied. The frozen values stay with that address.");
    } catch {
      if (fallback && input) {
        fallback.hidden = false;
        input.focus();
        input.select();
        show("Copy is unavailable here. Select the report address and copy it manually.");
      } else show("Copy is unavailable here. Use the address bar to copy the report link.");
    }
  };
  if (typeof navigator.share === "function") {
    nativeButton?.removeAttribute("hidden");
    nativeButton?.addEventListener("click", async () => {
      try {
        await navigator.share({ title: payload.title, text: payload.text, url: payload.url });
        show("Shared. The report and its frozen values remain at this address.");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError")
          show("Share cancelled. The report is still here.");
        else show("The device could not share this report. Copy the link instead.");
      }
    });
  }
  copyButton?.addEventListener("click", () => void copy());
  if (fallback) fallback.hidden = true;
}
