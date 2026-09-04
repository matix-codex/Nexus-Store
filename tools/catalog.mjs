import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {validatePackage,validateCatalog,compareVersions} from './package-schema.mjs';
const selected=new Map();
for(const id of await fs.readdir('packages'))for(const filename of await fs.readdir(path.join('packages',id))){
 const relative=`packages/${id}/${filename}`,bytes=await fs.readFile(relative),p=validatePackage(JSON.parse(bytes));
 assert.equal(p.id,id);assert.equal(filename,`${p.version}.nexus.json`);
 const {content,...entry}=p;const item={...entry,path:relative,size:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')};
 if(!selected.has(id)||compareVersions(item.version,selected.get(id).version)>0)selected.set(id,item);
}
const packages=[...selected.values()].sort((a,b)=>a.id.localeCompare(b.id));
if(process.argv.includes('--write'))await fs.writeFile('catalog.json',JSON.stringify({schema:1,generatedAt:new Date().toISOString(),packages},null,2)+'\n');
const catalog=validateCatalog(JSON.parse(await fs.readFile('catalog.json','utf8')));
assert.deepEqual([...catalog.packages].sort((a,b)=>a.id.localeCompare(b.id)),packages);
console.log(`PASS: ${packages.length} independently versioned packages and catalog checksums validated.`);
