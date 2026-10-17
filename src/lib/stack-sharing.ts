// Publication presentation only. Callers obtain this value through publicStack,
// which joins the active immutable publication and enforces current visibility.
// A renderer change that changes pixels must advance this version as well.
export const STACK_CARD_VERSION = 'v1';
export const STACK_CARD_WIDTH = 1200;
export const STACK_CARD_HEIGHT = 630;
export const STACK_ORIGIN = 'https://composer.loftwah.com';

export interface PublishedStackShare {
  id: string;
  slug: string;
  revision: number;
  name: string;
  description: string;
  theme: string;
  document: {
    name: string;
    description?: string;
    theme?: string;
    instances: {label: string; visible?: boolean}[];
  };
}

export interface StackShareDetails {
  url: string;
  title: string;
  description: string;
  apps: string[];
  imageIdentity: string;
  imagePath: string;
  imageUrl: string;
  imageAlt: string;
}

export function publicStackDescription(stack: PublishedStackShare): string {
  const apps = stack.document.instances.filter(instance => instance.visible !== false).map(instance => instance.label);
  return stack.description || `A published App Composer stack: ${apps.join(', ') || 'no visible apps yet'}.`;
}

export async function stackShareDetails(stack: PublishedStackShare): Promise<StackShareDetails> {
  const apps = stack.document.instances.filter(instance => instance.visible !== false).map(instance => instance.label);
  // Bind the URL to the exact persisted document, stack identity and revision.
  // Recreated slugs and later publications cannot reuse an earlier image URL.
  const identity = JSON.stringify([stack.id, stack.slug, stack.revision, stack.document]);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(identity));
  const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  const imageIdentity = `${STACK_CARD_VERSION}-r${stack.revision}-${hash}`;
  const imagePath = `/s/${stack.slug}/share/${imageIdentity}.png`;
  return {
    url: `${STACK_ORIGIN}/s/${stack.slug}`,
    title: stack.name,
    description: publicStackDescription(stack),
    apps,
    imageIdentity,
    imagePath,
    imageUrl: `${STACK_ORIGIN}${imagePath}`,
    imageAlt: `${stack.name}. ${apps.length ? `Published apps: ${apps.join(', ')}.` : 'No visible apps.'} App Composer stack, published revision ${stack.revision}.`,
  };
}

export function isStackImageIdentity(identity: string): boolean {
  return /^v1-r[1-9][0-9]{0,14}-[a-f0-9]{64}$/.test(identity);
}
