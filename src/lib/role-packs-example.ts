import bundle from '../../examples/role-packs/fictional-trail-notes.json';
import type { RoleBundle } from './role-packs.ts';

/** The one fictional bundle every shipped role pack is exercised against. */
export const rolePackExample = bundle as unknown as RoleBundle;
