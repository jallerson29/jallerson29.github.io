const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { test } = require('node:test');
function fixture(file = 'cultural-projects.js') {
  const writes = [], cards = [], elements = new Map();
  const element = id => { if (!elements.has(id)) elements.set(id, { value: '', textContent: '', dataset: {}, hidden: false, disabled: false }); return elements.get(id); };
  const document = {
    getElementById: element,
    querySelectorAll: selector => selector === '[data-cultural-section]' || selector === '[data-grant-section-card]' ? cards : [],
    querySelector: () => null,
  };
  const supabase = { from(table) { return {
    insert(value) { writes.push({table,op:'insert',value}); return Promise.resolve({error:null}); },
    update(value) { writes.push({table,op:'update',value}); return { eq(){return this}, select(){return this}, single(){return Promise.resolve({data:{id:'s1'},error:null})} }; },
  }; } };
  const context = vm.createContext({document, supabase, console, Intl, Map, Set, CSS:{escape:s=>s}, window:{setTimeout(){},confirm:()=>true}});
  let source = readFileSync(resolve(__dirname, '../admin',file), 'utf8').replace(/^import[^\n]+\n/, '');
  source = source.slice(0, source.indexOf(file === 'grants.js' ? 'initializeGrants().catch' : 'init().catch'));
  vm.runInContext(source, context);
  const run = js => vm.runInContext(js, context);
  if(file==='cultural-projects.js') run(`state.canEdit=true;state.currentProject={id:'p1'};state.session={user:{id:'u1'}};loadProjects=async()=>{};loadWorkspace=async()=>{captureDrafts()};renderWorkspace=()=>{};`);
  return {run,writes,cards,element,context};
}
function card(id, content, status='rascunho', grant=false) {
  const fields = {
    content:{value:content}, status:{value:status}, title:{value:'Equipe'},limit:{value:''},required:{checked:false},
    button:{dataset:{},textContent:'Salvar seção',disabled:false},
  };
  return {dataset: grant?{grantSectionCard:id}:{culturalSection:id},fields,querySelector(selector){
    if(selector.includes('content')) return fields.content;
    if(selector.includes('status')) return fields.status;
    if(selector.includes('title')) return fields.title;
    if(selector.includes('limit')) return fields.limit;
    if(selector.includes('required')) return fields.required;
    if(selector.includes('save')) return fields.button;
    return {textContent:''};
  }};
}
test('drafts survive rerender and remain isolated per project',()=>{
  const f=fixture();f.run(`state.sections=[{id:'s1',content:'Salvo',status:'rascunho'}]`);
  f.cards.push(card('s1','Edição ainda não salva'));f.run('captureDrafts();renderSections()');
  assert.match(f.element('cultural-section-list').innerHTML,/Edição ainda não salva/);
  f.run(`state.currentProject={id:'p2'}`);
  assert.equal(f.run(`state.drafts.get(draftKey('s1'))`),undefined);
  assert.equal(f.run(`state.drafts.get('p1:s1').content`),'Edição ainda não salva');
});
test('saving one section preserves other drafts and A definir status',async()=>{
  const f=fixture();f.run(`state.sections=[{id:'s1',content:'Equipe',status:'a_definir'},{id:'s2',content:'Original',status:'rascunho'}]`);
  f.cards.push(card('s1','Equipe: A definir.','a_definir'),card('s2','Orçamento em edição'));
  f.context.testCard=f.cards[0];await f.run(`saveSection('s1',testCard)`);
  assert.equal(f.writes[0].value.status,'a_definir');
  assert.equal(f.run(`state.drafts.get('p1:s2').content`),'Orçamento em edição');
  assert.equal(f.run(`state.drafts.has('p1:s1')`),false);
});
test('typing during a save keeps newer edits dirty',async()=>{
  const f=fixture();f.run(`state.sections=[{id:'s1',content:'Original',status:'rascunho'}]`);
  f.cards.push(card('s1','Versão enviada'));f.context.testCard=f.cards[0];
  const pending=f.run(`saveSection('s1',testCard)`);f.cards[0].fields.content.value='Mais uma alteração';await pending;
  assert.equal(f.writes[0].value.content,'Versão enviada');
  assert.equal(f.run(`state.drafts.get('p1:s1').content`),'Mais uma alteração');
});
test('assistant proposes multiple destinations without writing project sections',async()=>{
  const f=fixture();f.run(`state.sections=[{id:'s1',section_key:'infraestrutura',title:'Infraestrutura'},{id:'s2',section_key:'orcamento',title:'Orçamento'}];state.messages=[{id:'m1',role:'user',content:'Palco com custo a definir'}]`);
  await f.run(`askAssistant({messageId:'m1'})`);
  assert.equal(f.writes.length,1);assert.equal(f.writes[0].table,'cultural_project_messages');
  assert.deepEqual(Array.from(f.writes[0].value.metadata.proposal.section_ids),['s1','s2']);
});
test('repeated proposals and review results do not produce new assistant messages',async()=>{
  const f=fixture();f.run(`state.sections=[];state.messages=[{id:'m1',role:'user',content:'Palco a definir'},{role:'assistant',metadata:{proposal:{text:'PALCO A DEFINIR!'}}}]`);
  await f.run(`askAssistant({messageId:'m1'})`);assert.equal(f.writes.length,0);
  f.run(`state.mode='revisar';state.messages=[{id:'m2',role:'user',content:'Revisar'},{role:'assistant',mode:'revisar',content:'Nenhuma seção vazia. A revisão de coerência deve ser feita pela equipe.'}]`);
  await f.run(`askAssistant({messageId:'m2'})`);assert.equal(f.writes.length,0);
});
test('assistant recognizes existing text with case/accent/punctuation differences',async()=>{
  const f=fixture();f.run(`state.sections=[{id:'s1',content:'Programação gratuita!'}];state.messages=[{id:'m1',role:'user',content:'programacao gratuita'}]`);
  await f.run(`askAssistant({messageId:'m1'})`);
  assert.equal(f.writes[0].value.metadata.proposal,undefined);
});
test('read-only user cannot save a section or request a template',async()=>{
  const f=fixture();f.run(`state.canEdit=false`);f.context.testCard=card('s1','x');
  await f.run(`saveSection('s1',testCard);suggestDraft('s1',testCard)`);assert.equal(f.writes.length,0);
});
test('a version is blocked while sections are unsaved',async()=>{
  const f=fixture();f.run(`state.sections=[{id:'s1',content:'Salvo',status:'rascunho'}]`);f.cards.push(card('s1','Não salvo'));
  await f.run('saveVersion()');assert.equal(f.writes.length,0);
});
test('ready indicator excludes enrolled and running projects',()=>{
  const f=fixture();f.run(`state.projects=[{status:'pronto'},{status:'inscrito'},{status:'execucao'}];renderProjectStats()`);
  assert.equal(f.element('cultural-stat-ready').textContent,1);
});
test('grant editor retains imported text across rerenders',()=>{
  const f=fixture('grants.js');f.run(`grantsState.canEdit=true;grantsState.editingApplicationId='a1';grantsState.sections=[{id:'s1',application_id:'a1',title:'Equipe',content:'Original',status:'rascunho',required:false,character_limit:null}];updateSectionCounters=()=>{}`);
  f.cards.push(card('s1','Texto importado', 'rascunho',true));f.run('captureGrantDrafts();renderSectionEditor()');
  assert.match(f.element('grant-section-list').innerHTML,/Texto importado/);
});
