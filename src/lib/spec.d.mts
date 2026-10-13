export interface Spec {version:1;preset:string;apps:string[];config:{title:string;intro:string;theme:string;layout:string};privacy:string;cards:{title:string;url:string}[];deployment:{mode:string;hostname:string;approval:string};updates:string;decisions:Record<string,string>}
export interface Question {id:string;title:string;help:string;recommend:string;when?:Record<string,string[]>;options:string[][]}
export const presets:Record<string,{apps:string[];title:string;intro:string}>;
export const questions:Question[];
export function validateSpec(input:unknown):Spec;
export function handoff(spec:Spec):string;
export function pruneAnswers(answers:Record<string,string>):Record<string,string>;
export function visibleQuestions(answers:Record<string,string>):Question[];
export function explorerSpec(answers:Record<string,string>):Spec;
