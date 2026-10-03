import {readFileSync} from 'node:fs';
export const capturedSchema=JSON.parse(readFileSync(new URL('../fixtures/pre-participant-schema-20261004.json',import.meta.url),'utf8').replace(/^\uFEFF/,''));
const quote=name=>'"'+name.replaceAll('"','""')+'"';
export async function restoreCapturedSchema(db){
 await db.query('create schema private;');
 const enums=new Map();for(const value of capturedSchema.enums){if(!enums.has(value.name))enums.set(value.name,[]);enums.get(value.name).push(value);}
 for(const [name,labels] of enums)await db.query(`create type public.${quote(name)} as enum (${labels.sort((a,b)=>a.order-b.order).map(x=>"'"+x.label.replaceAll("'","''")+"'").join(',')})`);
 const tables=new Map();for(const column of capturedSchema.columns){const name=column.table_schema+'.'+column.table_name;if(!tables.has(name))tables.set(name,[]);tables.get(name).push(column);}
 for(const [name,columns] of tables){
  const defs=columns.map(c=>`${quote(c.column_name)} ${c.data_type==='USER-DEFINED'?'public.'+quote(c.udt_name):c.data_type==='ARRAY'?quote(c.udt_name.slice(1))+'[]':c.data_type}${c.column_name==='id'&&c.data_type==='bigint'&&!c.column_default?' generated always as identity':''}${c.is_nullable==='NO'?' not null':''}${c.column_default?' default '+c.column_default:''}`);
  await db.query(`create table ${name} (${defs.join(',')});alter table ${name} enable row level security;grant all on ${name} to service_role;`);
 }
 for(const c of capturedSchema.constraints)await db.query(`alter table ${quote(c.schema)}.${quote(c.table)} add constraint ${quote(c.name)} ${c.definition}`);
 const constraintIndexes=new Set(capturedSchema.constraints.filter(c=>/^(PRIMARY KEY|UNIQUE)/.test(c.definition)).map(c=>c.name));
 for(const index of capturedSchema.indexes)if(!constraintIndexes.has(index.indexname))await db.query(index.indexdef);
 let pending=[...capturedSchema.functions].sort((a,b)=>a.schema.localeCompare(b.schema));
 while(pending.length){const next=[];let applied=0;for(const f of pending){try{await db.query(f.definition);applied++;}catch(error){next.push({...f,error});}}
  if(!applied)throw new Error('Captured function restoration failed: '+next.map(x=>`${x.name}: ${x.error.message}`).join(';'));pending=next;
 }
 for(const f of capturedSchema.functions){
  await db.query(`revoke all on function ${quote(f.schema)}.${quote(f.name)}(${f.args}) from public;`);
  for(const acl of f.acl??[]){const role=acl.split('=')[0];if(['service_role','authenticated','anon'].includes(role)&&acl.includes('X'))await db.query(`grant execute on function ${quote(f.schema)}.${quote(f.name)}(${f.args}) to ${quote(role)};`);}
 }
 for(const p of capturedSchema.policies){const roles=p.roles.map(quote).join(',');await db.query(`create policy ${quote(p.policyname)} on ${quote(p.schemaname)}.${quote(p.tablename)} as ${p.permissive} for ${p.cmd} to ${roles}${p.qual?' using ('+p.qual+')':''}${p.with_check?' with check ('+p.with_check+')':''};`);}
 for(const trigger of capturedSchema.triggers??[])await db.query(trigger);
}
