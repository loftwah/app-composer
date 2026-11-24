type ClipboardFeedback = { copied: () => void; denied: () => void };

export function currentClipboard() {
  let revision = 0;
  return {
    invalidate() { revision += 1; },
    async write(text: string, { copied, denied }: ClipboardFeedback) {
      const request = ++revision;
      let report: () => void;
      try {
        await navigator.clipboard.writeText(text);
        report = copied;
      } catch {
        report = denied;
      }
      if (request === revision) report();
    },
  };
}
