const F=require('path').join(__dirname,'..','..','firefox')+'/'; globalThis.window=globalThis;
require(F+'h2h.js'); require(F+'strategy.js'); require(F+'context.js');
// synthetic: true z ~ N(0,1); stored forecast made with spread 1.5x too narrow (overconfident) => p = Phi(z*1.5); outcome ~ Bernoulli(Phi(z))
let seed=7; const rnd=()=>{seed=(seed*16807)%2147483647; return seed/2147483647;}; const nrm=()=>Math.sqrt(-2*Math.log(rnd()))*Math.cos(2*Math.PI*rnd());
function run(over, weeks){ const ST={}; const cats=['p','r','a','s','b','3','fg%','ft%','to'];
 for(let w=1;w<=weeks;w++){ const pairs=[], teams={}; for(let m=0;m<6;m++){ const a='t'+(2*m),b='t'+(2*m+1); const cp={}; teams[a]={st:{}}; teams[b]={st:{}};
   cats.forEach(c=>{ const z=nrm()*0.8; cp[c]=+H2H.Phi(z*over).toFixed(3); const win=rnd()<H2H.Phi(z); const va=win?2:1, vb=win?1:2; if(c==='to'){teams[a].st.to=win?1:2;teams[b].st.to=win?2:1;} else if(c==='fg%'){teams[a].st.fg=va;teams[a].st.fga=3;teams[b].st.fg=vb;teams[b].st.fga=3;} else if(c==='ft%'){teams[a].st.ft=va;teams[a].st.fta=3;teams[b].st.ft=vb;teams[b].st.fta=3;} else {teams[a].st[c]=va;teams[b].st[c]=vb;} });
   pairs.push({a,b,cp}); }
  ST['lgfc:1:2026-11-'+(10+w)]={week:w,start:'2026-11-'+(10+w),sdMul:1,pairs}; ST['lgweek:1:'+w]={week:w,teams}; }
 const c=CTX.calibrate(ST,'1'); console.log('overconfident x'+over,'weeks',weeks,'n',c.n,'fit',c.fit,'applied',c.mul,'brier',c.brier.toFixed(3),'->',c.brierFit&&c.brierFit.toFixed(3), c.bins.map(b=>b.n?`${Math.round(b.p*100)}:${Math.round(b.won*100)}`:'').join(' ')); }
run(1.5,4); run(1,4); run(0.7,4); run(1.5,1);
