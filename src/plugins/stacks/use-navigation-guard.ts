import { useBlocker } from "@tanstack/react-router";

// Native plugins share EmDash's router context. Its supported blocker covers
// sidebar links and browser Back/Forward, plus full-document beforeunload.
export function useNavigationGuard({
  changed,
  pending,
  onPending,
}: {
  changed: boolean;
  pending: boolean;
  onPending: () => void;
}) {
  useBlocker({
    disabled: !changed && !pending,
    enableBeforeUnload: changed || pending,
    shouldBlockFn: () => {
      if (pending) {
        onPending();
        return true;
      }
      return (
        changed &&
        !window.confirm("Leave this page and discard its unsaved entries?")
      );
    },
  });
}
