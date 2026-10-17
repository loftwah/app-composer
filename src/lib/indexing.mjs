// Search-engine eligibility has one rule and one home: the hostname decides
// whether this deployment is public, and a page may only add an exclusion for a
// state that must never be indexed, such as a catalogue entry that failed to
// load. A page never hands back `false` for a healthy state, because that would
// put a preview worker into search results beside the real site.
export function previewHostname(hostname){return String(hostname??'').includes('workers.dev');}
export function noindexFor(hostname,healthy=true){return !healthy||previewHostname(hostname);}
