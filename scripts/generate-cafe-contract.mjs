import {readFile,writeFile} from 'node:fs/promises';
import ts from 'typescript';
// Workspace package runtime exports must reference JavaScript for Node/Vercel tracing.
const source=await readFile('packages/contracts/src/cafe-options.ts','utf8');
const {outputText}=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}});
await writeFile('packages/contracts/src/cafe-options.js','// Generated from cafe-options.ts by npm run contracts:generate. Do not edit.\n'+outputText);
