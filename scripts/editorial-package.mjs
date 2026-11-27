import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { captionProblem, shareCalendarChannel } from '../src/lib/share-calendar.ts';
import { publicPageCanonical } from '../src/lib/public-pages.mjs';

const slug = z.string().regex(/^[a-z0-9](?:[a-z0-9-]{0,70}[a-z0-9])?$/);
const prose = z.string().trim().min(1).max(4000);
const sourceIds = z.array(slug).min(1).max(12);
const https = z.url().refine(value => {
  const url = new URL(value);
  return url.protocol === 'https:' && !url.username && !url.password;
}, 'Use a public HTTPS source link');
const assignment = z.strictObject({
  version: z.literal('composer.editorial-assignment/1'),
  id: slug,
  project: prose,
  audience: prose,
  promise: prose,
  direction: prose,
  article: slug,
  artwork: z.string().regex(/^[a-z0-9-]+\.(?:png|jpe?g|webp)$/),
  alt: prose,
  sources: z.array(z.strictObject({
    id: slug, url: https, observation: prose, basis: z.enum(['source', 'local-check', 'inference']),
  })).min(1).max(20),
  posts: z.array(z.strictObject({
    channel: shareCalendarChannel, purpose: prose, body: prose, sources: sourceIds,
  })).min(1).max(3),
  newsletter: z.strictObject({ subject: prose, body: prose, sources: sourceIds }),
  limits: z.array(prose).max(12),
});

const sha256 = value => createHash('sha256').update(value).digest('hex');
const readRepo = (path, encoding) => readFileSync(new URL('../' + path, import.meta.url), encoding);

function buildPackage(id) {
  const input = assignment.parse(JSON.parse(readRepo(`src/editorial/assignments/${slug.parse(id)}.json`, 'utf8')));
  if (input.id !== id) throw new Error('Assignment ID must match its filename.');
  const ids = new Set(input.sources.map(source => source.id));
  if (ids.size !== input.sources.length) throw new Error('Source IDs must be unique.');
  if (new Set(input.posts.map(post => post.channel)).size !== input.posts.length) {
    throw new Error('Use one draft per destination.');
  }
  for (const draft of [...input.posts, input.newsletter]) {
    if (draft.sources.some(source => !ids.has(source))) throw new Error('Draft cites an unknown source ID.');
  }

  const canonical = publicPageCanonical('/articles/' + input.article).href;
  const articlePath = `src/pages/articles/${input.article}.md`;
  const articleText = readRepo(articlePath, 'utf8');
  const artworkPath = '/articles/' + input.artwork;
  if (!articleText.includes(`cover: "${artworkPath}"`) || !articleText.includes(`coverAlt: "${input.alt}"`)) {
    throw new Error('The selected artwork and alt text must match the article cover.');
  }
  const posts = input.posts.map(post => {
    const caption = `${post.body}\n\n${canonical}`;
    const problem = captionProblem(post.channel, caption);
    if (problem) throw new Error(problem);
    return { ...post, caption };
  });
  return {
    ...input,
    version: 'composer.editorial-package/1',
    article: { canonical, path: articlePath, sha256: sha256(articleText), markdown: articleText },
    artwork: { path: artworkPath, url: new URL(artworkPath, canonical).href, sha256: sha256(readRepo('public' + artworkPath)), alt: input.alt },
    posts,
    newsletter: { ...input.newsletter, text: `${input.newsletter.body}\n\nRead the field note: ${canonical}` },
  };
}

function reviewMarkdown(pack) {
  const drafts = pack.posts.map(post =>
    `### ${post.channel}\n\n${post.purpose}\n\n${post.caption}\n\nEvidence: ${post.sources.join(', ')}`).join('\n\n');
  const sources = pack.sources.map(item =>
    `- **${item.id}** (${item.basis}) — ${item.observation} [Source](${item.url})`).join('\n');
  const body = pack.article.markdown.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '');
  return `# Editorial review · ${pack.project}\n\n${pack.audience}\n\n${pack.promise}\n\n${pack.direction}\n\n[Canonical article](${pack.article.canonical}) · Source SHA-256 \`${pack.article.sha256}\`\n\n[Cover artwork](${pack.artwork.url}) · Asset SHA-256 \`${pack.artwork.sha256}\`\n\n${pack.artwork.alt}\n\n## Evidence\n\n${sources}\n\n## Review limits\n\n${pack.limits.map(limit => '- ' + limit).join('\n')}\n\n## Social drafts\n\n${drafts}\n\n## Newsletter draft\n\n### ${pack.newsletter.subject}\n\n${pack.newsletter.text}\n\nEvidence: ${pack.newsletter.sources.join(', ')}\n\n## Article draft\n\n${body}`;
}

try {
  const [id, format, ...rest] = process.argv.slice(2);
  if (!id || rest.length || (format !== undefined && format !== '--json')) {
    throw new Error('Usage: node scripts/editorial-package.mjs <assignment-id> [--json]');
  }
  const pack = buildPackage(id);
  process.stdout.write(format === '--json' ? JSON.stringify(pack, null, 2) + '\n' : reviewMarkdown(pack));
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Could not export editorial package.');
  process.exitCode = 1;
}
