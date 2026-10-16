---
name: Content site
description: An open reading surface for a published collection.
colors:
  dark-background: "#17181b"
  dark-foreground: "#f2f3f5"
  dark-muted: "#afb3bb"
  dark-border: "#464a52"
  dark-surface: "#23252a"
  dark-accent: "#ff9b55"
  light-background: "#faf9f7"
  light-foreground: "#22252b"
  light-muted: "#5c616a"
  light-border: "#b9bec5"
  light-surface: "#efeeea"
  light-accent: "#a63d08"
typography:
  display:
    fontFamily: "Space, system-ui, sans-serif"
    fontSize: "clamp(2.5rem, 6vw, 5rem)"
    lineHeight: 1.12
    letterSpacing: "-0.025em"
  group:
    fontFamily: "Space, system-ui, sans-serif"
    fontSize: "1.25rem"
    lineHeight: 1.12
  body:
    fontFamily: "system-ui, sans-serif"
    fontSize: "17px"
    lineHeight: 1.6
rounded:
  control: "8px"
---

# Content site design

## Overview

Reviewed 14 October 2026 against `src/pages/index.astro` and `src/styles/site.css`, direction contract `content-project-v1`. This independent local content project extends App Composer’s established reading surface: charcoal/ivory, orange actions and focus, self-hosted Space Grotesk headings, native body text and open ruled entries. The collection’s content leads. This is a starting identity that the project can adapt.

The built surface presents a collection name, editing/theme controls, a large collection heading and published entries or a useful empty state. This document records source behaviour; owner passkey setup, authenticated editing/publication and a customer deployment remain separate acceptance gates.

## Colors

Dark presentation pairs charcoal with pale text and warm orange. Light presentation pairs ivory with charcoal text and a darker orange. Muted text identifies labels and footer information; borders separate content; the quiet surface colour belongs to the theme and skip controls. Primary controls use charcoal text in dark mode and white text in light mode.

## Typography

The bundled Space Grotesk face is registered as `Space` and used for the site name and semantic headings. The site name is medium weight (22px). Entry titles scale between 1.75rem and 2.5rem; group headings use 1.15rem. Body copy and controls use the native system sans stack. Headings and values wrap long text; body paragraphs stop at 70ch.

## Layout

The header and footer use wrapping horizontal rows with generous side clearance. The main reading container is centred (1168px maximum including 24px side padding), with substantial space above and below the collection. The collection heading has an 18ch measure. Each entry starts with an open rule and vertical padding (40px), rather than a filled card.

Field rows align labels with values in a one-to-three column relationship, with labels at least 160px wide. At 600px and below they stack with a small gap; the main top padding contracts from 64px to 40px. Header navigation wraps when needed. Keep the same content order across widths.

## Elevation & Depth

There are no shadows or decorative layers. Rules, spacing, typography and the quiet control surface establish hierarchy. The keyboard skip link sits above the page only when focused.

## Shapes

Entries and grouped definition lists remain open and square. Buttons have gently rounded corners using the control radius. Rules are thin (1px); the visible keyboard outline is substantial (3px with 5px clearance).

## Components

The header places the linked collection name before a native navigation group: **Edit content**, then the compact theme control. Editing links lead to `/_emdash/admin`. Primary links and buttons have a 48px minimum height and 12px by 20px padding. The theme button uses the quiet surface and a border. The footer repeats the collection name and **Manage this collection**.

The collection name is also the page’s sole first-level heading. Each entry uses the first unconditional string field as its second-level title, falling back to its ID. Model groups retain their order as third-level headings; matching visible fields appear as labelled definition-list rows, with the title field omitted from the rows. Groups remain visible even when their row list is empty.

The empty state explains draft/publication behaviour and supplies **Open EmDash**. A collection error replaces the entries with an alert. Keep these meaningful states within the same open reading layout.

Native editor integration, reviewed 14 October 2026: the whole-number widget uses the host’s Kumo 2.6.0 input styling, labelled bounds guidance and inline invalid-value feedback, with the field’s minimum, maximum and required attributes. Clearing produces an empty value (`null`); an entered zero remains zero. Public reading styles are scoped under `html.composer-content-site`, preserving this document’s reading surface without styling EmDash administration.

Collection pagination, reviewed 14 October 2026: when needed, matching navigation above and below the entries pairs the current page and muted entry range with native **Previous page** and **Next page** anchors targeting the start of the main content. Unavailable directions are omitted. Controls inherit the quiet bordered surface and 48px minimum height; the row wraps with context above the controls when needed on phones. Keep a single rule at each adjoining section boundary. Navigation works without JavaScript, and invalid or missing pages use the open reading layout with **Back to the first page** recovery.

The initial CSS presentation is dark. With JavaScript, the initial choice follows the system’s light preference unless a valid saved `content-site-theme` overrides it. The button switches and attempts to save the choice; denied storage leaves switching usable for the current page. Theme changes affect presentation only. The stylesheet respects reduced-motion preferences and all interactive elements retain visible keyboard focus.

## Do's and Don'ts

- **Do** preserve semantic headings, useful labels, content order, long-text wrapping and the open ruled layout.
- **Do** inspect phone and desktop composition and both themes when changing the surface.
- **Do** keep publication and authentication claims tied to their actual evidence.
- **Don't** add generic decoration, fabricated activity or a Composer runtime dependency to this reading surface.

Calendar dates, reviewed 14 October 2026: top-level date fields use a labelled Kumo native date input in administration, bounded to years 0001–9999, with day-only guidance; clearing an optional date leaves it empty. The public reader presents the same day with a written month in a semantic time element, without timezone conversion. Dates inherit the existing typography, theme tokens and open ruled field rows, including label/value stacking at 600px and below. Init configures their optional starting value through its existing native disclosure and date control.


Individual entry pages, reviewed 15 October 2026: published collection titles are underlined native links to stable content-ID addresses. A detail page inherits the shared header, footer, typography, theme and open labelled field rows. A quiet bordered 48px-high Back to collection link precedes its sole h1; model group headings become h2 at1.25rem. The same visible fields and safe formatting serve both pages. Missing entries and unavailable content use the existing open recovery treatment and never render hidden entry titles. Navigation, skip links and theme work across pages at phone/tablet/desktop widths, with a JavaScript-free reading path. No imagery or visual world is replaced.


Collection filter, reviewed 15 October 2026: one native labelled select derives from the first unconditional choice field. Its 48px control and action sit below the collection heading, inheriting the charcoal/ivory surfaces, orange action, visible focus and open reading layout. Phone layouts give the select a full row; the form and recovery links work without JavaScript. A quiet sentence names the active choice, while pagination shows positions within that filtered result, never an invented total. No-result and invalid-filter states keep a route back.

The select keeps native keyboard and picker behaviour, with a scoped custom painted shell and an 18px, 2px-stroke chevron matching the existing line-icon language. This prevents WebKit’s compact menulist appearance from reducing its rendered touch target below 48px. It does not style the EmDash admin.

Public text links have no underline, including hover. Weight, accent colour and content context keep destinations recognisable, with visible keyboard focus. Theme utilities use the shared current-mode icon and stable accessible pressed state.
