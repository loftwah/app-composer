import type {ContentModel} from './index.mjs';
export const contentPatternSummaries:ReadonlyArray<Readonly<{id:string;label:string;description:string;tip:string}>>;
export function contentPattern(id:string):ContentModel;
export function contentPatternSample(id:string):Record<string,unknown>;
