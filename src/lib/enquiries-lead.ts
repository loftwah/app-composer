export type EnquiriesLeadRole = "owner" | "editor" | "viewer";

export type EnquiriesLeadBook = { id: string; label: string };

/** Only the fields already rendered by the existing inbox list. Brief body and
 * visitor contact fields are deliberately absent, so the lead cannot copy them
 * into a URL, notice or evidence. */
export type EnquiriesLeadItem = {
  id: string;
  title: string;
  status: "pending" | "reviewed" | "rejected";
  createdAt: string;
};

export type EnquiriesLeadInbox = {
  resourceId: string;
  status: string;
  page: number;
  items: EnquiriesLeadItem[];
};

export type EnquiriesLeadInput = {
  ready: boolean;
  role?: EnquiriesLeadRole;
  workspaceName?: string;
  environment?: string;
  account?: string;
  readyBooks: EnquiriesLeadBook[];
  selectedBook?: EnquiriesLeadBook;
  status: string;
  inbox?: EnquiriesLeadInbox;
  /** The pending view for the selected book and page has finished loading. */
  inboxReady?: boolean;
  pendingCount?: number;
  summaryReady?: boolean;
};

export type EnquiriesLead =
  | { kind: "loading" }
  | { kind: "read-only" }
  | { kind: "setup" }
  | { kind: "brief"; book: EnquiriesLeadBook; item: EnquiriesLeadItem }
  | { kind: "pending-elsewhere"; book: EnquiriesLeadBook; count: number }
  | { kind: "no-pending"; book: EnquiriesLeadBook; summaryKnown: boolean }
  | { kind: "book"; book: EnquiriesLeadBook };

export function enquiriesLead(
  input: EnquiriesLeadInput,
): EnquiriesLead {
  if (!input.ready) return { kind: "loading" };
  if (input.role === "viewer") return { kind: "read-only" };
  const book = input.selectedBook ?? input.readyBooks[0];
  if (!book) return { kind: "setup" };

  const inbox =
    input.inbox &&
    input.inbox.resourceId === book.id &&
    input.inbox.status === input.status &&
    input.inbox.page === 1
      ? input.inbox
      : undefined;

  // Do not describe outstanding pending briefs as "outside this view" while
  // the selected pending view is still loading.
  if (input.status === "pending" && !input.inboxReady && !inbox)
    return { kind: "book", book };

  if (input.status === "pending" && inbox) {
    const latest = inbox.items.find((item) => item.status === "pending");
    if (latest)
      return {
        kind: "brief",
        book,
        item: {
          id: latest.id,
          title: latest.title,
          status: latest.status,
          createdAt: latest.createdAt,
        },
      };
    if (!input.pendingCount)
      return { kind: "no-pending", book, summaryKnown: false };
  }

  if ((input.pendingCount ?? 0) > 0)
    return {
      kind: "pending-elsewhere",
      book,
      count: input.pendingCount ?? 0,
    };

  if (input.summaryReady)
    return { kind: "no-pending", book, summaryKnown: true };

  return { kind: "book", book };
}
