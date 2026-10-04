import test from 'node:test';
import assert from 'node:assert/strict';
import {component} from '../helpers/client-component.mjs';
test('panel navigation marks only the current section',()=>{
 const c=component('../../components/operations/PanelNav.tsx','PanelNav',{moduleStubs:{'next/navigation':{usePathname:()=>'/panel/odemeler'},'@/lib/content':{operations:{nav:[{href:'/panel/basvurular',label:'Başvurular'},{href:'/panel/odemeler',label:'Dekontlar'}]}}}});
 const links=c.nodes(c.render(),'a');assert.equal(links.filter(n=>n.props['aria-current']==='page').length,1);assert.equal(links.find(n=>n.props['aria-current']==='page').props.href,'/panel/odemeler');
});
test('reversed participant login URL redirects to the canonical route',()=>{
 let target;const c=component('../../app/(operations)/giris/katilimci/page.tsx','default',{moduleStubs:{'next/navigation':{redirect:url=>{target=url;return null;}}}});c.render();assert.equal(target,'/katilimci/giris');
});
test('discipline notes can be selected directly without pointer movement',()=>{
 const c=component('../../components/ui/DisciplineWheel.tsx','DisciplineWheel',{moduleStubs:{'@/lib/content':{disciplines:[{name:'Sanat',note:'Sanat notu'},{name:'Tarih',note:'Tarih notu'}]}}});
 const buttons=c.nodes(c.render(),'button');assert.equal(buttons.length,2);buttons[1].props.onClick();
 assert.equal(c.nodes(c.render(),'button')[1].props['aria-pressed'],true);assert.ok(c.nodes(c.render(),'p').some(n=>n.props.children==='Tarih notu'));
});
