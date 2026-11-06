import test from 'node:test';
import assert from 'node:assert/strict';
import {stateOwnershipViolations} from '../scripts/state-ownership.mjs';

test('a data call needs a stale-response guard', () => {
  const violations = stateOwnershipViolations([
    {path: 'src/plugins/unsafe-page.tsx', source: `import {useState,useEffect} from 'react';
export function Page(){const [value,setValue]=useState();useEffect(()=>{void (async()=>{const raw=await apiFetch('/private');setValue(raw);})();},[]);return null;}`},
    {path: 'src/plugins/guarded-page.tsx', source: `import {useState,useEffect,useRef} from 'react';
export function Page(){const [value,setValue]=useState();const generation=useRef(0);useEffect(()=>{const epoch=++generation.current;void (async()=>{const raw=await apiFetch('/private');if(epoch===generation.current)setValue(raw);})();},[]);return null;}`},
    {path: 'src/components/plain-form.tsx', source: `import {useState} from 'react';
export function Form(){const [text,setText]=useState('');return <input value={text} onChange={event=>setText(event.target.value)}/>;}`},
  ]);
  assert.deepEqual(violations, ['src/plugins/unsafe-page.tsx']);
});
