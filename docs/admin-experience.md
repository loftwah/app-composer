# Your app, your admin

Reviewed 22 October 2026. The public explanation is [composer.loftwah.com/manage](https://composer.loftwah.com/manage). This note records what the owner experience actually uses and what remains separate.

## The answer to an ordinary request

A club asks for “news, a photo wall, links and an enquiry form”, plus a way to approve photos, edit the welcome, see link use and keep the app current. App Composer does not turn that sentence into an arbitrary application or a second generic dashboard. It maps the request to reviewed pieces:

- a saved stack with a public address and an immutable published revision;
- Here / there for moderated photo contributions;
- Linkarooie for links and curated source contributions;
- Init and the content-model editor for the brief and field shape;
- EmDash and the native Composer plugins for owner administration;
- the app's own D1/R2 records and owner API as the authority for app data.

News pages, arbitrary D1 tables, plugin ports and organisation-wide publishing remain implementation work, not hidden toggles. The public page says so.

## Owner surfaces

| Surface | Current job | Authority |
| --- | --- | --- |
| Creator stacks | Save, preview, publish, unpublish, archive, duplicate, roll back a publication and export configuration. | Invited EmDash role plus workspace membership and role. |
| Private enquiries | Read retained briefs, mark reviewed/rejected, delete, export and count by published page. | Owner or editor for private reads and review; owner only to open/close a form. |
| Workspace outcomes | Read recorded app opens and verified moderation transitions with definitions and caps. | Workspace read capability. |
| Workspace maintenance | Check a saved app connection and prepare an approved-content file. | Owner or editor; viewers see metadata only. |
| Workspace access | Prepare pending editor/viewer invitations with expiry and revoke them. | Workspace owner. |
| App-owned studios | Here / there and Linkarooie owner routes for photos, links and settings. | The app's existing owner authentication. |

Every Composer route rechecks the current role after remote waits and immediately before dispatch. A request body cannot select another workspace, resource or publication. The app rechecks the source, account, environment, target and resource before its write. An operation dispatched before a later access change may still commit; this is not a distributed transaction.

## Page-level enquiry counts

The Inbox calls the app's existing private export, validates the resource/source and each item's provenance, then counts by exact publication scope. It returns counts and dates, not brief text, contact fields or visitor identity. The summary covers up to the 200 items Composer accepts from the export and says when that limit is reached. “Reviewed” is an owner decision, not a sale, contact, reply or conversion. Bodies expire after 30 days; minimal receipts remain for 35. Notifications and email delivery are not implemented.

The page is built from the app's own records. Composer does not create a parallel enquiry database.

## Publication binding

A Composer enquiry form belongs to one immutable publication: stack, revision, instance and configuration. Publishing another revision does not open it. Closing, archiving, deleting or replacing the publication denies the Composer form route but does not change a separately enabled standalone form. A slug reassignment cannot reuse an earlier publication's delivery authority.

## What remains open

- Fresh-person signup, workspace creation and customer deployment without an operator.
- Real invitation delivery and independent new-person Access admission.
- Notifications, replies and email delivery for enquiries.
- Full app content/media export and isolated recovery. Configuration export is not a backup.
- Arbitrary WordPress/Drupal/plugin migration parity.
- Physical-device, screen-reader and external-platform unfurl acceptance.
- Automatic code changes from a prompt without review, tests and an authorised deployment.

The [release evidence](https://github.com/loftwah/app-composer/issues/11) records source, Worker identities and verified boundaries. The [public page](https://composer.loftwah.com/manage) carries the product explanation and links to the live fictional stacks.
