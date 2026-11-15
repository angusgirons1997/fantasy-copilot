// fake finished weeks from the model itself (to exercise the backtest), true spread = 0.7 x the model's
const F=require('path').join(__dirname,'..','..','firefox')+'/'; globalThis.window=globalThis; require(F+'h2h.js'); require(F+'strategy.js'); require(F+'context.js');
const ST=JSON.parse(require('fs').readFileSync(process.argv[2])); const y=ST['yr:64669'];
const M=CTX.model(ST,'64669',{punt:null,yr:y,obj:'cats',today:'2026-11-13',rules:{}}); const ctx=M.ctx;
let seed=3; const rnd=()=>{seed=(seed*16807)%2147483647; return seed/2147483647;}; const nrm=()=>Math.sqrt(-2*Math.log(rnd()))*Math.cos(2*Math.PI*rnd());
const tids=M.L.teams.map(t=>t.tid);
for(let w=1;w<=3;w++){ const teams={}; const sh=tids.slice().sort(()=>rnd()-0.5);
  for(let i=0;i<sh.length;i+=2){ const a=sh[i],b=sh[i+1]; [a,b].forEach((t,j)=>{ const A=H2H.teamWeek(ctx,M.L.teams.find(x=>x.tid===t).ids,'ros'); const g=Math.round(A.games*(0.85+0.2*rnd())); const f=g/A.games; const st={};
      ['p','r','a','s','b','3','to'].forEach(c=>{ const mu=A.m[c]*f; st[c]=Math.max(0,Math.round(mu+nrm()*Math.sqrt(mu)*2.5*0.7)); });
      st.fga=Math.round(A.m.fga*f); st.fg=Math.round(st.fga*(A.m.fg/A.m.fga+nrm()*0.02)); st.fta=Math.round(A.m.fta*f); st.ft=Math.round(st.fta*(A.m.ft/A.m.fta+nrm()*0.03));
      teams[t]={st,games:{played:g},opp:j?a:b}; }); }
  ST['lgweek:64669:'+w]={week:w,teams};
  const pairs=[]; for(let i=0;i<sh.length;i+=2){ const a=sh[i],b=sh[i+1]; const r=H2H.matchup(ctx,H2H.teamWeek(ctx,M.L.teams.find(x=>x.tid===a).ids,'ros'),H2H.teamWeek(ctx,M.L.teams.find(x=>x.tid===b).ids,'ros')); pairs.push({a,b,cp:Object.fromEntries(ctx.cats.map(c=>[c,+r.cp[c].toFixed(3)]))}); }
  ST['lgfc:64669:2026-10-'+(19+7*w)]={ts:1,week:w,start:'2026-10-'+(19+7*w),sdMul:1,pairs}; }
require('fs').writeFileSync(process.argv[3]||'fake_fc.json',JSON.stringify({at:'2026-11-13T00:00:00Z',store:ST}));
// fake team totals + projection logs for the display test
Object.keys(ST).filter(k=>k.startsWith('lgfc:')).forEach(k=>{ const fc=ST[k]; fc.me='11'; fc.tot={}; fc.pairs.forEach(m=>[m.a,m.b].forEach(t=>{ const A=H2H.teamWeek(ctx,M.L.teams.find(x=>x.tid===t).ids,'ros'); fc.tot[t]=Object.assign({g:A.games},A.m); })); });
const ros=ST['bx:64669'].views.ros; const names=Object.values(ros).slice(0,200).map(r=>r.n);
['2026-10-27','2026-11-03'].forEach(st=>{ const bbm={},yh={},act={}; Object.values(ros).slice(0,200).forEach(r=>{ const s=r.st; const v=[3,s.p,s['3'],s.r,s.a,s.s,s.b,s.fg,s.fga,s.ft,s.fta,s.to]; bbm[r.n]=v; yh[r.n]=v.map((x,i)=>i?x*(0.9+0.2*rnd()):x); act[r.n]=v.map((x,i)=>i?Math.round(x*3*(0.7+0.6*rnd())):3); });
  ST['pjlog:64669:'+st]={ts:1,start:st,bbm,yh}; ST['pjact:'+st]={ts:1,start:st,by:act}; });
require('fs').writeFileSync(process.argv[3]||'fake_fc.json',JSON.stringify({at:'2026-11-13T00:00:00Z',store:ST}));
