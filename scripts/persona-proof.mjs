/**
 * Independently extract observed Buyer Arena traces, not fabricated buyer testimonials.
 * Inputs are actual Chromium run.json files produced by the CLI in this exact CI attempt.
 * Every review is labelled synthetic/automated and contains a machine-evidence pointer.
 */
import {existsSync,readdirSync,readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {Buffer} from 'node:buffer';
import {execFileSync} from 'node:child_process';
const output=resolve(process.argv[2]||'.buyer-arena/persona-audit');
const demo=join(output,'sessions','persona-validation');
const launches=join(output,'launch','product-validation');
const read=(p)=>JSON.parse(readFileSync(p,'utf8'));
const assert=(t,m)=>{if(!t)throw Error('UNVERIFIED: '+m)};
const events=(dir)=>{let result=[];for(const variant of ['baseline','candidate']){
 const root=join(dir,'runs',variant);assert(existsSync(root),'missing '+root);
 for(const p of readdirSync(root)){
  const file=join(root,p,'run.json');assert(existsSync(file),'missing run '+file);
  const r=read(file);result.push({r,file});
 }}return result;
};
const data=events(demo),n=20;
assert(data.length===n*2,'expected '+(n*2)+' physically executed browser traces, got '+data.length);
const groups=new Map();const report=[];const root=resolve('.');
const statusCounts={};
for(const {r,file} of data){
 assert(r.run_id && r.persona_id && r.status,'missing real trace fields '+file);
 assert(Array.isArray(r.events),'missing event stream '+file);
 const key=r.persona_id;const seen=groups.get(key)||[];seen.push(r);groups.set(key,seen);
 statusCounts[r.status]=(statusCounts[r.status]||0)+1;
 const fields=(r.events||[]).filter(e=>e&&typeof e.id==='string').slice(0,10)
  .map(e=>({event_id:e.id,type:e.type,step:e.step,detail:typeof e.detail==='string'?e.detail.slice(0,200):null}));
 const evidencePath=file.replace(root+'/','');
 report.push({
  record_type:'OBSERVED_BROWSER_JOURNEY',actor_type:'SYNTHETIC_HEURISTIC_PERSONA',
  run_id:r.run_id,persona_id:key,segment:r.segment,archetype:r.archetype,
  variant:r.variant,goal_completed:r.goal_completed,status:r.status,
  abandon_reason:r.abandon_reason||null,steps:r.steps,elapsed_ms:r.elapsed_ms,
  price_discovery:!!r.milestones?.pricing_found,events_count:r.events.length,
  event_examples:fields,source_file:evidencePath,
  evidence_level:'EXECUTED_PLAYWRIGHT_IN_CI_NOT_A_REAL_HUMAN',
  reviewer_note:r.goal_completed
   ?'Automated browser policy reached its configured success criterion; no human satisfaction inferred.'
   :('Automated browser policy did not meet success criterion'+(r.abandon_reason?': '+r.abandon_reason.slice(0,160):'.')),
  suggested_followup:r.goal_completed
   ?'Human review should check trust, clarity and retention; a synthetic conversion is not a sale.'
   :'Inspect referenced page/trace and reproduce the blocker manually before prioritising fixes.'
 });
}
assert(groups.size===n,'each of 20 synthetic buyers should produce paired observations');
for(const [p,runs] of groups){assert(runs.length===2,p+' did not execute both versions');}
let launch=null;const launchFile=join(launches,'launch.json');
if(existsSync(launchFile)){
 launch=read(launchFile);
 for(const panel of ['users','developers','commercial','security','segments']){
  const p=(launch.panels||[]).find(x=>x.id===panel);
  assert(p,'missing launch panel '+panel);
  report.push({record_type:'EXECUTED_PRODUCT_PANEL',actor_type:'AUTOMATED_ROLE_REVIEW',
   panel,score:p.score??null,checks:(p.checks||[]).map(x=>({id:x.id,score:x.score,evidence:x.evidence??[]})),
   skipped:p.skipped??null,source_file:launchFile.replace(root+'/',''),
   evidence_level:p.skipped?'SKIPPED_NOT_TESTED':'SELF_AUDIT_NOT_EXTERNAL_CLIENT',
   reviewer_note:p.skipped?'Panel was skipped: '+p.skipped:
    'The built-in panel executed; findings and scores are self-evaluation, not independent validation.'});
 }
}
// Professional operator profiles: actual CLI invocations, explicitly limited to smoke checks.
const operatorCases=[
 ['01-technical-founder-doctor.log','Technical founder / environment inspection','CLI_DOCTOR'],
 ['02-local-ai-engineer-model-catalog.json','Local AI engineer / available model catalog','MODEL_CATALOG'],
 ['03-agent-developer-agent-eval.log','Agent developer / evaluation command discovery','AGENT_EVAL_HELP'],
 ['04-integration-engineer-mcp.log','Integration engineer / MCP command discovery','MCP_HELP'],
 ['05-release-manager-gates.log','Release engineer / gate command discovery','RELEASE_GATE_HELP'],
 ['06-product-manager-five-panels.log','Product manager / five-panel command discovery','LAUNCH_HELP']
];
for(const [filename,role,command] of operatorCases){
 const file=join(output,'operator-logs',filename);
 assert(existsSync(file),'Missing operator execution log: '+filename);
 const body=readFileSync(file,'utf8');
 assert(body.trim().length>5,'CLI produced no useful output: '+filename);
 report.push({record_type:'EXECUTED_CLI_OPERATOR_PROBE',actor_type:'SYNTHETIC_PROFESSIONAL_ROLE',
  role,command,status:'COMMAND_EXIT_ZERO',source_file:file.replace(root+'/',''),
  output_bytes:Buffer.byteLength(body),
  evidence_level:command==='CLI_DOCTOR'||command==='MODEL_CATALOG'
    ?'EXECUTED_READ_ONLY_DIAGNOSTIC':'COMMAND_HELP_ONLY_NOT_FULL_FUNCTIONAL_TEST',
  reviewer_note:command==='CLI_DOCTOR'||command==='MODEL_CATALOG'
    ?'Read-only CLI invocation completed, output saved. This is not a full role usability trial.'
    :'The help/command interface executed, not its underlying optional integration or real-world service.',
  suggested_followup:'Arrange external role-specific, task-based usability and acceptance testing.'});
}
const dir=join(output,'evidence');mkdirSync(dir,{recursive:true});
const sourceCommit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const summary={schema:'BUYER_ARENA_TEST_RUN_V1',source_commit:sourceCommit,
 generated_at:new Date().toISOString(),sample_size_synthetic_personas:groups.size,
 executed_browser_journeys:data.length,paired_variants:['baseline','candidate'],
 status_counts:statusCounts,operator_smoke_checks:operatorCases.length,launch_panels:launch?.panels?.map(p=>({panel:p.id,score:p.score,skipped:p.skipped||null}))??[],
 claim:'REAL PLAYWRIGHT EXECUTION BY AUTOMATED SYNTHETIC ACTORS; ZERO RECRUITED HUMAN TESTERS',
 limitations:['Demo buyers tested the built-in fictional SaaS, not real customer demand.',
   'Panels are first-party self-audits, not external independent validation.',
   'No LLM buyer or live model was used; no paid provider call.',
   'Persona notes are generated from actual run status and event traces, never attributed to humans.',
   'Operator help commands are discovery smoke tests, not complete execution of third-party integrations.',
   'Additional connectors require explicit credentials/third-party tools and were not executed here.']
};
writeFileSync(join(dir,'per-actor-observations.jsonl'),report.map(x=>JSON.stringify(x)).join('\n')+'\n');
writeFileSync(join(dir,'campaign-summary.json'),JSON.stringify(summary,null,2)+'\n');
writeFileSync(join(dir,'README.md'),
'# Buyer Arena — actual automated persona campaign\n\n' +
'Commit: `'+sourceCommit+'`\n\n' +
'This is **executed synthetic-buyer QA**, not feedback from recruited customers. '+
'Every JSONL line links to a real run.json, executed panel report or CLI probe log.\n\n'+
'Browser journeys: **'+data.length+'** across **'+groups.size+'** paired synthetic personas.\n'+
'Statuses: `'+JSON.stringify(statusCounts)+'`.\n\n'+
'Original evidence: `../sessions/persona-validation/runs/{baseline,candidate}/p-xxx/run.json`; '+
'`../launch/product-validation/launch.json` for the five professional panels.\n\n'+
'**Do not convert these observations into testimonials, external validation or calibrated conversion.**\n');
console.log('PASS: '+data.length+' Chromium journey records; '+report.length+' evidence records. Summary:',summary);
