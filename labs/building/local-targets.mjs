// One source of truth for the building lab's two local targets. The lab only
// talks to explicit https://localhost:<port> Workers. The defaults are the
// original pair, so existing commands keep working.

export const defaultGuestbookUrl = "https://localhost:8788";
export const defaultLinkarooieUrl = "https://localhost:8787";

const localTarget = /^https:\/\/localhost:([1-9][0-9]{0,4})$/;

const portOf = (value, name) => {
  const match = localTarget.exec(value);
  if (!match)
    throw Error(
      name +
        " must be an exact https://localhost:<port> URL, not " +
        JSON.stringify(value) +
        ".",
    );
  const port = Number(match[1]);
  if (port > 65535)
    throw Error(name + " must use a port between 1 and 65535.");
  return port;
};

export const resolveLocalTargets = (env = {}) => {
  const guestbook = env.GUESTBOOK_URL || defaultGuestbookUrl;
  const linkarooie = env.LINKAROOIE_URL || defaultLinkarooieUrl;
  const guestbookPort = portOf(guestbook, "GUESTBOOK_URL");
  const linkarooiePort = portOf(linkarooie, "LINKAROOIE_URL");
  if (guestbookPort === linkarooiePort)
    throw Error("GUESTBOOK_URL and LINKAROOIE_URL must use different ports.");
  return { guestbook, linkarooie, guestbookPort, linkarooiePort };
};
