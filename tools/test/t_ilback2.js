// Back-from-injury card: open spots come from the league's roster size, not empty lineup slots; drops are named
const fs=require('fs'); const src=fs.readFileSync(process.argv[2],'utf8');
const a=src.indexOf('  // Yahoo refuses every lineup change'), b=src.indexOf('  function lineupCard(p, lg) {');
const K=s=>String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z ]/g,'').trim(); const lastOf=n=>{const w=K(n).split(' ');return w[w.length-1];};
const esc=s=>String(s); const ago=()=>'just now'; const usToday=()=>'2026-11-09'; const fmtD=d=>({'2026-11-09':'Mon, 9 Nov','2026-11-11':'Wed, 11 Nov'})[d]||d; let Y; const ST={'ysetp:64669':{slots:Array(10).fill('X'),bench:4},'ysetp:99377':{slots:Array(10).fill('X'),bench:4}};
const RULES={'64669':{spots:14},'99377':{spots:14}};
const f=new Function('K','lastOf','esc','ago','yrFor','usToday','fmtD','ST','RULES', src.slice(a,b)+'; return [ilBackCard, ilBlocked];')(K,lastOf,esc,ago,()=>Y,usToday,fmtD,ST,RULES);
const [card,blocked]=f; const strip=h=>h.replace(/<[^>]+>/g,'').replace(/\s+/g,' ');
let bad=0; const ok=(c,m,h)=>{console.log(c?'✓':'✗',m+(h?'\n    '+strip(h).slice(0,600):''));if(!c)bad++;};
const row=(name,slot,inj)=>({name,slot,inj:inj||''});
// the exact Boomers vs Brits roster from the screenshot: SG empty, 5 on the bench, 14 outside the IL, 4 IL spots used
const bvb=()=>[row('Stephon Castle','PG'),row('Christian Braun','G','Q'),row('N. Alexander-Walker','G'),row('Peyton Watson','SF'),row('Paul Reed','PF'),row('Caleb Wilson','F'),row('Daniel Gafford','C'),row('Amen Thompson','Util'),row('CJ McCollum','Util'),row('Shai Gilgeous-Alexander','BN'),row('Tristan da Silva','BN'),row('Franz Wagner','BN'),row('Aday Mara','BN'),row('Nic Claxton','BN'),row('Norman Powell','IL','O'),row('Jalen Duren','IL','O'),row('Paolo Banchero','IL','O'),row('Moussa Diabaté','IL','Q')];
const vals={'Aday Mara':-0.72,'Tristan da Silva':-0.55,'Daniel Gafford':-0.51,'CJ McCollum':-0.49,'Christian Braun':-0.43,'Paul Reed':-0.34,'Peyton Watson':-0.31,'Norman Powell':-0.25,'Moussa Diabaté':-0.21,'Nic Claxton':-0.19,'Stephon Castle':-0.13,'N. Alexander-Walker':-0.01,'Franz Wagner':0.12,'Caleb Wilson':0.12,'Amen Thompson':0.22,'Shai Gilgeous-Alexander':0.75};
const rosVal=Object.entries(vals).map(([name,perWk])=>({name,perWk,out:/Powell|Duren|Banchero/.test(name)})).sort((a,b)=>a.perWk-b.perWk);
const p={rosVal,nowDays:[{date:'2026-11-11',open:true,start:[{name:'Norman Powell'}],bench:[]}]};
Y={ts:Date.now(),lid:'99377',tid:'9',rows:bvb(),empty:['SG']};
let h=card(p,'Boomers vs Brits'); let s=strip(h);
ok(/Now:.*Drop Aday Mara.*Moussa Diabaté from the injured list to the bench/.test(s),'screenshot: full roster despite the empty SG slot, drop Aday Mara for Diabaté now',h);
ok(!/Powell/.test(s)&&/one player has to be dropped/.test(s),'Powell is Out on Yahoo: he stays on the IL, no step for him');
{ const rows=bvb().map(r=>r.name==='Norman Powell'?Object.assign({},r,{slot:'IL+',inj:'GTD'}):r); Y.rows=rows; const s2=strip(card(p,'BvB')); ok(/Wed, 11 Nov: drop Tristan da Silva and move Norman Powell to the bench/.test(s2),'Powell day-to-day in an IL+ spot and planned Wed: next drop named', s2); Y.rows=bvb(); }
ok(!/open spot/.test(s),'no false "open spots"');
ok(blocked(Y),'Diabaté (Q) in a plain IL spot blocks lineup changes');
// a real open roster spot (13 outside the IL): no drop for Diabaté
Y.rows=bvb().filter(r=>r.name!=='Aday Mara'); h=card(p,'BvB'); s=strip(h);
ok(/Now: move Moussa Diabaté to the bench. You have an open roster spot/.test(s)&&!/Drop /.test(s)&&/No one needs to be dropped/.test(s),'one open spot used for Diabaté, nothing else',h);
// injured player outside the IL can swap
Y.rows=bvb(); Y.rows[1].inj='O'; h=card(p,'BvB'); s=strip(h);
ok(/Now: move Christian Braun \(O\) into the injured-list spot and Moussa Diabaté to the bench/.test(s),'swap with an injured active player',h);
// settings from Yahoo override the fallback
ST['ysetp:99377']={slots:['PG','SG','G','G','SF','PF','F','C','Util','Util'],bench:5}; Y.rows=bvb(); h=card(p,'BvB'); s=strip(h);
ok(/Now: move Moussa Diabaté to the bench. You have an open roster spot/.test(s),'15 spots in settings: open spot',h); delete ST['ysetp:99377'];
// Powell worth less than the next drop: leave him on the IL
const p3={rosVal:rosVal.map(x=>x.name==='Norman Powell'?Object.assign({},x,{perWk:-0.9}):x),nowDays:p.nowDays}; Y.rows=bvb().map(r=>r.name==='Norman Powell'?Object.assign({},r,{slot:'IL+',inj:'GTD'}):r); s=strip(card(p3,'BvB'));
ok(/Leave Norman Powell on the injured list/.test(s),'Powell worth less than da Silva: keep him on the IL',null);
// nothing to do
Y.rows=bvb().map(r=>r.name==='Moussa Diabaté'?Object.assign({},r,{inj:'O'}):r); const p4={rosVal,nowDays:[]}; ok(card(p4,'BvB')==='','all IL players legally out and not planned: no card'); ok(!blocked(Y),'not blocked');
console.log(bad?bad+' FAILED':'all passed'); process.exit(bad?1:0);
