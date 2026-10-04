import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const exports = {};
const source = ts.transpileModule(readFileSync(new URL('../../lib/operations/action-feedback.ts', import.meta.url), 'utf8'), {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
vm.runInNewContext(`(function(exports){${source}})`)(exports);
test('refresh failure leaves the successful action intact',()=>{
 const result={kind:'success',title:'Saved',description:'Pending'};
 assert.match(exports.refreshFailureAfterAction(result),/^İşlem tamamlandı;/);
 assert.equal(result.kind,'success');
});
test('uncertain action is not announced as complete',()=>{
 assert.doesNotMatch(exports.refreshFailureAfterAction({kind:'uncertain'}),/İşlem tamamlandı/);
});
