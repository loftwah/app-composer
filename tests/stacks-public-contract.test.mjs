// The published stack page is the one surface a creator cannot check by
// refreshing the editor, so its contract is pinned here: it must read the
// publication, never the mutable draft row, and its sharing metadata must come
// from the same snapshot.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('..', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');

test('publicStack returns only fields that belong to the publication', () => {
  const source = read('src/lib/stacks.mjs');
  const body = source.slice(source.indexOf('export async function publicStack'));
  // The public read joins the immutable publication by the published revision.
  assert.match(body, /JOIN creator_stack_publications p ON p\.stack_id = s\.id AND p\.revision = s\.published_revision/);
  assert.match(body, /s\.status = 'published' AND s\.published_json IS NOT NULL/);
  assert.match(body, /publishedView\(row\)/);
  // The mutable draft columns must not reach the public shape.
  assert.doesNotMatch(body, /publishedView\(\{[^}]*\bname\b\s*:/, 'the mutable name column is not used');
  const view = source.slice(source.indexOf('const publishedView'), source.indexOf('export async function listStacks'));
  assert.match(view, /name: document\.name/);
  assert.match(view, /description: document\.description/);
  assert.match(view, /theme: document\.theme/);
});

test('the published page renders one shared component and the publication snapshot', () => {
  const page = read('src/pages/s/[slug].astro');
  assert.match(page, /import StackView from '\.\.\/\.\.\/components\/StackView\.tsx'/);
  assert.match(page, /import StackShare from '\.\.\/\.\.\/components\/StackShare\.astro'/);
  assert.match(page, /stack = await publicStack\(runtime\.DB, Astro\.params\.slug \?\? ''\)/);
  assert.match(page, /<StackView document=\{stack\.document\} link titleAs="h1" \/>/);
  assert.match(page, /title=\{stack\.name\}/);
  assert.match(page, /description=\{description\}/);
  // A stack never becomes indexable from a draft or a missing publication.
  assert.match(page, /noindexFor\(Astro\.url\.hostname, Boolean\(stack\)\)/);
  assert.match(page, /Astro\.response\.status = 404/);
  assert.match(page, /Astro\.response\.status = 503/);
  // The draft document must not be referenced by the public page at all.
  assert.doesNotMatch(page, /\.draft\b/);
});

test('preview and public output share the renderer and the theme tokens', () => {
  const view = read('src/components/StackView.tsx');
  assert.match(view, /import \{ STACK_APPS, declaredConfig \} from "\.\.\/lib\/stacks\.mjs"/);
  assert.match(view, /import \{ STACK_THEMES, themeTokens \} from "\.\.\/lib\/stack-theme\.mjs"/);
  assert.doesNotMatch(view, /style=\{/);
  assert.match(view, /import "\.\.\/styles\/stack-view\.css"/);
  const editor = read('src/plugins/stacks-admin.tsx');
  assert.match(editor, /import \{ StackView \} from "\.\.\/components\/StackView"/);
  // Shared app settings are resolved into a preview copy without changing the
  // saved draft. Both copies still use the same published-page renderer.
  assert.match(editor, /<StackView document=\{resourcesReady \? resourcePreview\(document, resources\) : document\} \/>/);
  const tokens = read('src/lib/stack-theme.mjs');
  for (const theme of ['daylight', 'midnight']) assert.match(tokens, new RegExp(theme));
});

test('the share controls use the publication-specific public image and local QR encoder', () => {
  const share = read('public/brand/stack-share.mjs');
  assert.match(share, /import \{ currentShareURL \} from '\.\/page-share-url\.mjs'/);
  assert.match(share, /import \{ qrMatrix \} from '\.\/qr-code\.mjs'/);
  assert.match(share, /fetch\(data\.imagePath/);
  assert.match(share, /credentials: 'omit', redirect: 'error'/);
  const component = read('src/components/StackShare.astro');
  assert.match(component, /data-stack-share-data/);
  assert.match(component, /href=\{imagePath\} download=/);
  assert.match(component, /const payload = stackSharePayload\(/);
  const page = read('src/pages/s/[slug].astro');
  assert.match(page, /shareImage=\{sharing\?\.imageUrl\}/);
  assert.match(page, /shareAlt=\{sharing\?\.imageAlt\}/);
});

test('the editor keeps one save model and does not lose local work', () => {
  const editor = read('src/plugins/stacks-admin.tsx');
  // One save path, one acknowledged revision, one edit generation.
  assert.match(editor, /const writeDraft = async \(\): Promise<Stack>/);
  assert.match(editor, /session\.current\.acknowledge\(checkpoint, stack\.revision, savedDraft\)/);
  assert.match(editor, /setDirty\(session\.current\.dirty\)/);
  // Draft-replacing actions are guarded, including refresh and navigation.
  assert.match(editor, /useNavigationGuard/);
  assert.match(readFileSync(new URL("../src/plugins/stacks/use-navigation-guard.ts", import.meta.url), "utf8"), /enableBeforeUnload/);
  assert.match(editor, /unsaved edits/);
  // Real conflict recovery that keeps the local draft.
  assert.match(editor, /Save mine on top/);
  assert.match(editor, /Keep editing/);
  // Destructive and publication-rollback actions state their scope.
  assert.match(editor, /Neither action restores app records, media or deletions/);
  // Viewers do not receive mutating controls.
  assert.match(editor, /const can = \(role: Role \| undefined, action: string\)/);
  assert.match(editor, /CAPABILITIES/);
});
