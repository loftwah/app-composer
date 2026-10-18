import { useEffect } from "react";

// EmDash's native sidebar uses client navigation, so beforeunload alone does
// not protect a plugin form. Guard its same-window links before the router sees
// the click, while keeping new tabs and downloads available.
export function useNavigationGuard({
  changed,
  pending,
  onPending,
}: {
  changed: boolean;
  pending: boolean;
  onPending: () => void;
}) {
  useEffect(() => {
    if (!changed && !pending) return;
    let approved = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const leave = (event: BeforeUnloadEvent) => {
      if (!approved) event.preventDefault();
    };
    const navigate = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const target = event.target;
      const anchor =
        target instanceof Element ? target.closest("a[href]") : null;
      if (
        !(anchor instanceof HTMLAnchorElement) ||
        anchor.download ||
        (anchor.target && anchor.target !== "_self")
      )
        return;
      const destination = new URL(anchor.href, window.location.href);
      if (
        destination.href === window.location.href ||
        (destination.origin === window.location.origin &&
          destination.pathname === window.location.pathname &&
          destination.search === window.location.search &&
          destination.hash)
      )
        return;
      if (
        pending ||
        !window.confirm("Leave this page and discard its unsaved entries?")
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (pending) onPending();
        return;
      }
      // A confirmed ordinary link can also trigger beforeunload. Do not ask
      // twice; restore protection if the navigation does not actually happen.
      approved = true;
      timer = setTimeout(() => {
        approved = false;
      }, 1000);
    };
    window.addEventListener("beforeunload", leave);
    document.addEventListener("click", navigate, true);
    return () => {
      window.removeEventListener("beforeunload", leave);
      document.removeEventListener("click", navigate, true);
      clearTimeout(timer);
    };
  }, [changed, pending, onPending]);
}
