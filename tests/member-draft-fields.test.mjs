import test from "node:test";
import assert from "node:assert/strict";
import {reconcileFields} from "../src/components/members/draft-fields.ts";

test("card adoption refreshes a pristine image without discarding an unsaved introduction",()=>{
  const baseline={title:"River",intro:"Saved introduction",shareImage:"https://example.test/manual.png"};
  const draft={baseline,value:{...baseline,intro:"My unsaved introduction"},conflicts:[]};
  const saved={...baseline,shareImage:"https://example.test/prepared.png"};
  const result=reconcileFields(draft,saved);
  assert.equal(result.value.shareImage,saved.shareImage);
  assert.equal(result.value.intro,"My unsaved introduction");
  assert.deepEqual(result.conflicts,[]);
});
test("overlapping refreshed link changes require comparison and remain blocked across another refresh",()=>{
  const baseline={title:"First title",url:"https://example.test/first"};
  const saved={title:"Changed elsewhere",url:baseline.url};
  const result=reconcileFields({baseline,value:{...baseline,title:"My retained title"},conflicts:[]},saved);
  assert.deepEqual(result.conflicts,["title"]);
  assert.equal(result.value.title,"My retained title");
  assert.deepEqual(reconcileFields(result,saved).conflicts,["title"]);
  assert.deepEqual(reconcileFields({...result,conflicts:[]},saved).conflicts,[]);
});
test("acknowledged saves become pristine while disjoint newer server fields survive",()=>{
  const baseline={title:"Before",intro:"Before",shareImage:"manual"};
  const saved={title:"After",intro:"Other tab",shareImage:"selected"};
  const result=reconcileFields({baseline,value:{...baseline,title:"After"},conflicts:[]},saved);
  assert.deepEqual(result.value,saved);
  assert.deepEqual(result.conflicts,[]);
});
