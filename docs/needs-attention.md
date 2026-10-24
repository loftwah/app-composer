# Needs attention (#118)

The native Overview reads a finite set of existing stored problem records for the
selected workspace, server account and environment. It does not send mail,
execute a workflow, run a provider health check or perform recovery.

Supported sources are Internal platform requests in `needs-attention`, real
workflow runs in `needs-attention` (sample runs excluded), and notification
records in blocked, failed, uncertain or interrupted-sending states. Workflow
failures group by recipe and source; notifications group by visitor book, retaining
record counts and first/latest observation times. Each group links to the owning
native screen with workspace and record context. Recovery actions stay there.

Platform and workflow problems are restricted to the latest 50 records visible
in their owning screens. Notification problems are restricted to each visitor
book's latest 30 visible records, up to 100 matches overall. Their real record
anchors are focused after the native screen loads. Every source states this
partial-history window; older retained problems may remain. A full window is labelled;
counts are retained observations, not audience, adoption or a complete problem
total. A database read time is shown as **Records checked**. First/latest dates
come from stored records, never a fabricated provider observation. Refresh does
not recheck the external effect or make an old failure fresh.

Unavailable and restricted sources have null counts. An empty checked source
means no retained matching problems in that source; it never certifies that the
app is healthy. Missing migrations or malformed stored target data fail visibly.
Viewer membership cannot receive Inbox notification signals. Membership is
rechecked after the asynchronous reads; losing private access refuses the whole
snapshot. The client remounts on workspace selection, clears failed snapshots,
and checks the server-confirmed workspace before displaying data.

Only generated labels, counts, dates and supported links leave this endpoint.
It does not echo submitted request plans, brief text, provider payloads or email
destinations. Platform records are filtered by their stored account/environment;
notifications must also match their app resource's exact stored target.

Pending enquiry counts, verified orders, connection expiry, live release health,
usage and recovery/backup coverage remain their existing separate issue owners.
No new table, scheduler, health monitor or dashboard framework is introduced.
Root integration registers `manageOverview` as the existing native plugin's GET
`overviewRead` route and `OverviewPage` as its `/overview` page. Exact record
anchors belong to the corresponding native request/run/notification renderers.

Local fictional fixtures exercise grouping, duplicate histories, exact target and
workspace selection, missing sources, malformed targets, restricted access,
late revocation, finite windows and read-only behaviour. Runtime/rendered native
and production acceptance remain separate release gates.
