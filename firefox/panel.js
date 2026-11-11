let CATS=['FG%','FT%','3PM','PTS','REB','AST','ST','BLK','TO'];
const byN=Object.fromEntries(P.map(p=>[p.n,p]));
let S={teams:12,rounds:14,slot:5,punt:[],risk:false,games:true,sound:true,goal:'punt'};
try{Object.assign(S,JSON.parse(localStorage.getItem('mdf-live')||'{}'));}catch(e){}if(typeof window!=='undefined'&&window.__goal)S.goal=window.__goal;
const FMT=(S.fmt==='bvb'&&typeof EMPTYZ11!=='undefined'&&P.length&&P[0].z11)?'bvb':'9';
if(FMT==='bvb'){CATS=['FG%','FTM','3PM','PTS','REB','AST','ST','BLK','TO','FGM','DD'];P.forEach(p=>{if(p.z11){p.z=p.z11.slice();p.v=p.v11;p.vr=p.vr11;p.pavr=p.pavr11;}else p.z=p.z.concat([0,0]);});}
const NC=CATS.length;const WINK=Math.floor(NC/2)+1;const RB=(S.teams||12)*(S.rounds||14);
let AC=null;
function chime(){if(!S.sound)return;try{AC=AC||new (window.AudioContext||window.webkitAudioContext)();if(AC.state==='suspended')AC.resume();const t=AC.currentTime;[[660,0],[880,0.18],[1100,0.36]].forEach(([f,d])=>{const o=AC.createOscillator(),g=AC.createGain();o.type='sine';o.frequency.value=f;g.gain.setValueAtTime(0.0001,t+d);g.gain.exponentialRampToValueAtTime(0.25,t+d+0.02);g.gain.exponentialRampToValueAtTime(0.0001,t+d+0.3);o.connect(g);g.connect(AC.destination);o.start(t+d);o.stop(t+d+0.32);});}catch(e){}}
const save=()=>{try{localStorage.setItem('mdf-live',JSON.stringify(S));}catch(e){}};
let L={picks:[]};
const EMPTYZ=(FMT==='bvb')?EMPTYZ11:[0.0, -0.0, -1.717, -3.195, -2.381, -1.965, -3.529, -1.344, 2.662];
const GREF=(typeof window!=='undefined'&&window.__gref)||82;const LAM=(typeof window!=='undefined'&&window.__lam!=null)?window.__lam:0;
(()=>{const wv=P.filter(p=>p.vr>=RB&&p.vr<=RB+60);const W=Array(NC).fill(0);wv.forEach(p=>p.z.forEach((v,i)=>W[i]+=v/wv.length));
 P.forEach(p=>{p.zpg=p.z.slice();p.vrpg=p.vr;const s=Math.min(1,(p.gp||GREF)/GREF);p.zw=p.z.map((v,i)=>s*v+(1-s)*W[i]);});
 const r=P.slice().sort((a,b)=>b.zw.reduce((x,y)=>x+y,0)-a.zw.reduce((x,y)=>x+y,0));r.forEach((p,i)=>p.vrw=i+1);})();
function setGames(){P.forEach(p=>{p.z=S.games?p.zw:p.zpg;p.vr=S.games?p.vrw:p.vrpg;});}
setGames();
const avail=p=>{const la=L.adp&&L.adp[p.n];if(la>0)return la;return (p.adp!=null&&p.adp>0)?p.adp:p.pre;};
const teamOf=o=>{const r=Math.ceil(o/S.teams),i=(o-1)%S.teams+1;const fwd=S.order==='3rr'?(r===1||(r>=4&&r%2===0)):(r%2===1);return fwd?i:S.teams+1-i;};
const total=()=>S.teams*S.rounds;
const made=()=>L.picks.length?Math.max(...L.picks.map(p=>p.o)):0;
const cur=()=>made()+1;
const slot=()=>{const m=L.picks.find(p=>p.mine);if(m)return teamOf(m.o);if(L.myNext>0&&L.myNext<=total())return teamOf(L.myNext);const r1=L.picks.filter(p=>p.o<=S.teams&&p.team);if(L.myTeam&&r1.length&&r1.every(p=>+p.team===p.o))return +L.myTeam;return S.slot;};
const myPicks=()=>{const a=[];for(let o=1;o<=total();o++)if(teamOf(o)===slot())a.push(o);return a;};
const nextMine=()=>myPicks().find(o=>o>=cur());
const nextAfter=o=>myPicks().find(x=>x>o);
const drafted=()=>new Set(L.picks.map(p=>p.n));
const mine=()=>L.picks.filter(p=>teamOf(p.o)===slot()).map(p=>p.n);
const roster=t=>L.picks.filter(p=>teamOf(p.o)===t).map(p=>p.n);
const sumZ=l=>{const t=Array(NC).fill(0);l.forEach(n=>{const p=byN[n];if(p)p.z.forEach((v,i)=>t[i]+=v);});return t;};
const Phi=x=>{const t=1/(1+0.2316419*Math.abs(x)),d=0.3989423*Math.exp(-x*x/2);const p=d*t*(0.3193815+t*(-0.3565638+t*(1.781478+t*(-1.821256+t*1.330274))));return x>0?1-p:p;};
let REPL=Array(NC).fill(0);
function setRepl(D){const left=Math.max(S.teams,total()-made());const av=P.filter(p=>!D.has(p.n)).sort((a,b)=>a.vr-b.vr).slice(0,left);const lo=av.slice(Math.floor(av.length/2));const t=Array(NC).fill(0);lo.forEach(p=>p.z.forEach((v,i)=>t[i]+=v));REPL=t.map(v=>v/Math.max(1,lo.length));}
const SLOTS=FMT==='bvb'?[['C'],['PG'],['SG'],['SF'],['PF'],['PG','SG'],['PG','SG'],['SF','PF'],null,null]:[['C'],['PG'],['SG'],['SF'],['PF'],['PG','SG'],['SF','PF'],null,null,null];const BENCHW=0.35;
const WV=(()=>{const wv=P.filter(p=>p.vrpg>=RB&&p.vrpg<=RB+60);const W=Array(NC).fill(0);wv.forEach(p=>p.zpg.forEach((v,i)=>W[i]+=v/wv.length));return W;})();
function teamTot(l){const ps=l.map(n=>byN[n]).filter(Boolean).sort((a,b)=>b.z.reduce((x,y)=>x+y,0)-a.z.reduce((x,y)=>x+y,0));const fill=Array(SLOTS.length).fill(false);const t=Array(NC).fill(0);
 ps.forEach(p=>{const el=p.p.split(',');let si=-1;for(let i=0;i<SLOTS.length;i++){if(fill[i])continue;if(!SLOTS[i]||SLOTS[i].some(x=>el.includes(x))){si=i;break;}}
  const wt=si>=0?1:BENCHW;if(si>=0)fill[si]=true;p.z.forEach((v,i)=>t[i]+=wt*v);});
 const unf=fill.filter(x=>!x).length,left=Math.max(0,S.rounds-l.length),use=Math.min(unf,left);
 for(let i=0;i<NC;i++)t[i]+=use*REPL[i]+(unf-use)*WV[i]+BENCHW*(left-use)*REPL[i];return t;}
const VOL=(window.__vol)||(FMT==='bvb'?[1.3,1.1,1.1,1.1,0.9,1.0,1.2,1.3,1.0,1.0,1.3]:[1.3,1.3,1.1,1.1,0.9,1.0,1.2,1.3,1.0]);
function pairs(my,ros,f){const mt=teamTot(my),sg0=1.2*Math.sqrt(S.rounds),out=Array(NC).fill(0);let c=0;
 for(let t=1;t<=S.teams;t++){if(t===slot())continue;const r=ros?ros[t]:roster(t);if(!r.length)continue;const ot=teamTot(r);for(let i=0;i<NC;i++){const sg=sg0*VOL[i];out[i]+=f((mt[i]-ot[i])/sg,sg);}c++;}
 return c?out.map(v=>v/c):null;}
function matchupWin(my,ros){if(!my.length)return 0.5;const mt=teamTot(my),sg0=1.2*Math.sqrt(S.rounds);let s=0,c=0;
 for(let t=1;t<=S.teams;t++){if(t===slot())continue;const r=ros?ros[t]:roster(t);if(!r.length)continue;const ot=teamTot(r);let dp=[1];
  for(let i=0;i<NC;i++){const p=Phi((mt[i]-ot[i])/(sg0*VOL[i]));const nd=Array(dp.length+1).fill(0);dp.forEach((v,k)=>{nd[k]+=v*(1-p);nd[k+1]+=v*p;});dp=nd;}
  let wv=0;for(let k=WINK;k<dp.length;k++)wv+=dp[k];s+=wv;c++;}return c?s/c:0.5;}
const PUNTMODE=()=>S.goal==='punt';
function winProbs(my,ros){if(!my.length)return Array(NC).fill(.5);return pairs(my,ros,x=>Phi(x))||Array(NC).fill(.5);}
const phi=x=>0.3989423*Math.exp(-x*x/2);
function catPrio(my){return pairs(my,null,x=>phi(x)/0.3989423)||Array(NC).fill(1);}
function slopes(my){return pairs(my,null,(x,sg)=>phi(x)/sg)||Array(NC).fill(0);}
function gain(p,sl){let g=0;for(let i=0;i<NC;i++)if(!S.punt.includes(i))g+=sl[i]*(p.z[i]-REPL[i]);return g;}
const valueOf=p=>{let s=0,d=0;p.z.forEach((v,i)=>{if(!S.punt.includes(i)){s+=v;d++;}});return d?s/d:0;};
function status(w,i){if(S.punt.includes(i))return['punt','Punted'];if(w>=.85)return['lock','Locked'];if(w>=.62)return['win','Winning'];if(w>=.38)return['swing','Swing'];if(w>=.15)return['lose','Behind'];return['gone','Long shot'];}
const teamName=t=>{const p=L.picks.find(x=>teamOf(x.o)===t&&x.tn&&x.tn!=='You');return p?p.tn:'Team '+t;};
const sur=n=>n.replace(/ (Jr\.|Sr\.|II|III|IV)$/,'').split(' ').slice(-1)[0];
const PROD=(()=>{const pool=P.filter(p=>p.vr<=180);return CATS.map((_,i)=>pool.filter(p=>p.z[i]>=1).length/pool.length);})();
function runs(){const last=L.picks.slice(-8).filter(p=>teamOf(p.o)!==slot());if(last.length<6)return[];const out=[];
 CATS.forEach((c,i)=>{const hit=last.filter(p=>byN[p.n]&&byN[p.n].z[i]>=1);const exp=last.length*PROD[i];if(hit.length>=Math.max(4,2.5*exp))out.push({i,hit,n:last.length});});
 const cs=last.filter(p=>byN[p.n]&&byN[p.n].p.split(',').includes('C'));if(cs.length>=4)out.push({pos:'C',hit:cs,n:last.length});
 return out;}
function needs(t){const r=roster(t).filter(n=>byN[n]);if(r.length<2)return[];const z=sumZ(r).map(v=>v/r.length);return [0,1,2,3,4,5,6,7].sort((a,b)=>z[a]-z[b]).slice(0,3);}
function pressure(o,nm){const np=[];for(let x=o;x<nm;x++){const t=teamOf(x);if(t!==slot())np.push(t);}const ts=[...new Set(np)];const cnt=Array(NC).fill(0),who=CATS.map(()=>[]);
 ts.forEach(t=>needs(t).forEach(i=>{cnt[i]++;who[i].push(teamName(t));}));return {picks:np.length,teams:ts.length,cnt,who};}
function oppPunts(){const out={};for(let t=1;t<=S.teams;t++){if(t===slot())continue;const r=roster(t).filter(n=>byN[n]);if(r.length<5)continue;const z=sumZ(r).map(v=>v/r.length);const mn=[...Array(NC).keys()].filter(i=>i!==8).sort((a,b)=>z[a]-z[b])[0];if(z[mn]<=-0.6)out[t]=mn;}return out;}
function survive(p,from,to,OP){if(!to||to<=from)return 1;let a=avail(p);const top=p.z.map((v,i)=>[v,i]).sort((x,y)=>y[0]-x[0])[0][1];
 let pun=0;for(let x=from;x<to;x++){const t=teamOf(x);if(t!==slot()&&OP[t]===top)pun++;}a+=2*pun;
 const sd=Math.max(3,0.22*a);const pn=1-Phi((from-0.5-a)/sd),pl=1-Phi((to-0.5-a)/sd);return pn>0.001?Math.max(0,Math.min(1,pl/pn)):0;}
const POOL0=(()=>{const t=Array(NC).fill(0);P.filter(p=>p.vr<=180).forEach(p=>p.z.forEach((v,i)=>t[i]+=Math.max(0,v)));return t;})();
const shares=list=>{const t=Array(NC).fill(0);list.forEach(p=>p.z.forEach((v,i)=>t[i]+=Math.max(0,v)));const s=t.reduce((a,b)=>a+b,0)||1;return t.map(v=>v/s);};
const SH0=shares(P.slice().sort((a,b)=>a.vr-b.vr).slice(0,156));
const supply=D=>{const left=Math.max(12,total()-made()+12);const av=P.filter(p=>!D.has(p.n)).sort((a,b)=>a.vr-b.vr).slice(0,left);const sh=shares(av);return sh.map((v,i)=>v/SH0[i]);};
function weakCats(w){return mine().length?[...Array(NC).keys()].filter(i=>!S.punt.includes(i)).sort((a,b)=>w[a]-w[b]).slice(0,2):[];}
function fit(p,punt,weak,nx){let s=0,d=0;p.z.forEach((v,i)=>{if(!punt.includes(i)){s+=v;d++;}});let f=d?s/d:0;
 weak.forEach(k=>{if(!punt.includes(k))f+=0.05*Math.max(-1.5,Math.min(2,p.z[k]));});if(nx&&avail(p)>nx+4)f-=0.08;return f;}
function rng(seed){let x=seed%2147483647;if(x<=0)x+=2147483646;return()=>{x=x*16807%2147483647;return (x-1)/2147483646;};}
function gauss(r){let u=0,v=0;while(!u)u=r();v=r();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);}
const isBig=p=>p.p.split(',').includes('C')||(p.z[4]>=1&&p.z[7]>=0.5);
let SIMN=5;
function rollout(D,plan,firstPick){let tot=0,mwt=0;const wsum=Array(NC).fill(0);let first=[];
 for(let s=0;s<SIMN;s++){const r=rng(1000+s*7919+made()*31);const tk=new Set(D),ros={};for(let t=1;t<=S.teams;t++)ros[t]=roster(t);
  const pool=P.filter(p=>!tk.has(p.n)).map(p=>{const a=avail(p);return {p,a:a+Math.max(3,0.22*a)*gauss(r)};}).sort((x,y)=>x.a-y.a);
  const nm=nextMine();let k=0;const me0=slot();const fp=[];
  for(let o=cur();o<=total();o++){const tm=teamOf(o);let pk=null;
   if(tm===me0){if(firstPick&&o===nm&&!tk.has(firstPick))pk=byN[firstPick];else{const me=ros[tm];const sl=me.length?pairs(me,ros,(x,sg)=>phi(x)/sg):null;const cc=me.filter(n=>byN[n]&&byN[n].p.split(',').includes('C')).length;let bf=-1e9;
     for(const q of pool){const p=q.p;if(tk.has(p.n))continue;let f=0;if(sl){for(let i=0;i<NC;i++){if(plan.punt.includes(i))continue;const wgt=(plan.chase===i&&k<2)?3:1;f+=wgt*sl[i]*(p.z[i]-REPL[i]);}}else{let s2=0,d=0;p.z.forEach((v,i)=>{if(!plan.punt.includes(i)){s2+=v;d++;}});f=s2/d;}
      if(p.p==='C'&&cc>=3)f=f>0?f*0.55:f/0.55;if(f>bf){bf=f;pk=p;}}}
    if(pk&&fp.length<2)fp.push(pk.n);k++;}
   else{const ro=ros[tm];const bigs=ro.filter(n=>byN[n]&&isBig(byN[n])).length;const needBig=o>2*S.teams&&bigs<Math.min(2,Math.floor(ro.length/3));let best=null,bs=1e9,c=0;
    for(const q of pool){if(tk.has(q.p.n))continue;const sc=q.a-(needBig&&isBig(q.p)?8:0);if(sc<bs){bs=sc;best=q.p;}if(++c>=15)break;}pk=best;}
   if(pk){tk.add(pk.n);ros[tm].push(pk.n);}}
  const wf=winProbs(ros[me0],ros);wf.forEach((v,i)=>wsum[i]+=v);tot+=wf.reduce((a,b)=>a+b,0);mwt+=matchupWin(ros[me0],ros);if(s===0)first=fp;}
 return {first,w:wsum.map(v=>v/SIMN),exp:tot/SIMN,mw:mwt/SIMN,obj:PUNTMODE()?mwt/SIMN*NC:tot/SIMN};}
function plans(D,w){const live=[...Array(NC).keys()].filter(i=>!S.punt.includes(i));const weak=live.slice().sort((a,b)=>w[a]-w[b]);
 const out=[{lab:S.punt.length?'Current plan':'Balanced',punt:S.punt.slice(),chase:null,kind:'base'}];
 const NW=PUNTMODE()?(S.punt.length>=2?0:4):3;weak.slice(0,NW).forEach(i=>out.push({lab:'Punt '+CATS[i],punt:[...S.punt,i],chase:null,cat:i,kind:'punt'}));
 const w3=PUNTMODE()?(S.punt.length>=1?[]:weak.slice(0,4)):weak.slice(0,3).filter(i=>w[i]<0.45);for(let a=0;a<w3.length;a++)for(let b=a+1;b<w3.length;b++)out.push({lab:'Punt '+CATS[w3[a]]+' + '+CATS[w3[b]],punt:[...S.punt,w3[a],w3[b]],chase:null,cat:w3[a],cat2:w3[b],kind:'punt2'});

 out.forEach(x=>Object.assign(x,rollout(D,x)));const base=out[0];let best=base;
 if(PUNTMODE()){const bar=S.punt.length?0.04:0.02;out.forEach(x=>{if(x!==base&&x.mw>=base.mw+bar&&x.mw>best.mw)best=x;});}else out.forEach(x=>{const bar=x.kind==='chase'?0.15:0.25;if(x!==base&&x.exp>=base.exp+bar&&x.exp>best.exp)best=x;});
 const lost=live.filter(i=>base.w[i]<0.25&&w[i]<0.3).map(i=>({i,r:out.find(x=>x.kind==='punt'&&x.cat===i)})).filter(x=>x.r&&x.r.exp>=base.exp-0.05);
 return {out,base,best,lost};}
function project(punt,D){const tk=new Set(D),ros={};for(let t=1;t<=S.teams;t++)ros[t]=roster(t);const first=[];const byA=P.slice().sort((a,b)=>avail(a)-avail(b));
 for(let o=cur();o<=total();o++){const tm=teamOf(o);let pk=null;
  if(tm===slot()){const me=ros[tm];const sl=me.length?pairs(me,ros,(x,sg)=>phi(x)/sg):null;let bf=-1e9;
   P.forEach(p=>{if(tk.has(p.n)||avail(p)<o-8)return;let f=0;if(sl){for(let i=0;i<NC;i++)if(!punt.includes(i))f+=sl[i]*(p.z[i]-REPL[i]);}else f=fit(p,punt,[],null);if(f>bf){bf=f;pk=p;}});if(pk&&first.length<2)first.push(pk.n);}
  else pk=byA.find(p=>!tk.has(p.n));
  if(pk){tk.add(pk.n);ros[tm].push(pk.n);}}
 return {first,exp:winProbs(ros[slot()],ros).reduce((a,b)=>a+b,0)};}
const strengths=p=>p.z.map((v,i)=>[v,i]).filter(x=>!S.punt.includes(x[1])).sort((a,b)=>b[0]-a[0]).slice(0,3).filter(x=>x[0]>0.4).map(x=>CATS[x[1]]);
const weakness=p=>{const m=p.z.map((v,i)=>[v,i]).filter(x=>!S.punt.includes(x[1])).sort((a,b)=>a[0]-b[0])[0];return m&&m[0]<-0.9?CATS[m[1]]:null;};
function whatIf(p,m){const a=winProbs(m),b=winProbs([...m,p.n]);const d=b.map((v,i)=>[v-a[i],i]);
 const cells=d.filter(x=>!S.punt.includes(x[1])).map(([dv,i])=>{const pp=Math.round(dv*100);return `<span class="wic ${pp>=2?'up':pp<=-2?'dn':''}">${CATS[i]} ${Math.round(a[i]*100)}→${Math.round(b[i]*100)}</span>`;}).join('');
 const tot=b.reduce((x,y)=>x+y,0)-a.reduce((x,y)=>x+y,0);return `<div class="wi"><div class="wih">If taken: ${tot>=0?'+':''}${tot.toFixed(2)} cats</div>${cells}</div>`;}
function leagueTable(){const ros={};for(let t=1;t<=S.teams;t++)ros[t]=roster(t);const sg0=1.2*Math.sqrt(S.rounds);const tot={};
 for(let t=1;t<=S.teams;t++){if(!ros[t].length)continue;const mt=teamTot(ros[t]);let s=0,c=0;for(let u=1;u<=S.teams;u++){if(u===t||!ros[u].length)continue;const ot=teamTot(ros[u]);for(let i=0;i<NC;i++)s+=Phi((mt[i]-ot[i])/(sg0*VOL[i]));c++;}tot[t]=c?s/c:0;}
 const order=Object.keys(tot).sort((a,b)=>tot[b]-tot[a]);return {mine:tot[slot()],rank:order.indexOf(String(slot()))+1,n:order.length,best:tot[order[0]]};}
function addQ(n){S.queue=S.queue||[];if(!S.queue.includes(n))S.queue.push(n);save();}
function beep2(){try{AC=AC||new (window.AudioContext||window.webkitAudioContext)();if(AC.state==='suspended')AC.resume();const t=AC.currentTime;[[520,0],[390,0.16]].forEach(([f,d])=>{const o=AC.createOscillator(),g=AC.createGain();o.type='triangle';o.frequency.value=f;g.gain.setValueAtTime(0.0001,t+d);g.gain.exponentialRampToValueAtTime(0.22,t+d+0.02);g.gain.exponentialRampToValueAtTime(0.0001,t+d+0.25);o.connect(g);g.connect(AC.destination);o.start(t+d);o.stop(t+d+0.27);});}catch(e){}}
function render(){
 const D=drafted();setRepl(D);const m=mine(),w=winProbs(m),sup=supply(D),nm=nextMine(),o=cur(),has=L.picks.length>0;
 const now=document.getElementById('now');
 if(!has){now.className='now';now.innerHTML='<b>Waiting for the draft room</b><span>Open your Yahoo draft.</span>';}
 else if(!nm||o>total()){now.className='now';now.innerHTML=o>total()?'<b>Draft complete</b>':'<b>Your picks are done</b>';}
 else{const me=nm===o;const secs=L.secs;now.className='now'+(me?' me':'')+(me&&secs!=null&&secs<=15?' hurry':'');now.innerHTML=me?`<b>You're on the clock: pick ${o}${secs!=null?' · '+secs+'s':''}</b>`:`<b>Your pick: ${nm}</b><span>${nm-o} away · last: ${L.picks[L.picks.length-1].n}</span>`;}
 const hasOpp=L.picks.some(p=>teamOf(p.o)!==slot());
 document.getElementById('cats').innerHTML=CATS.map((c,i)=>{const pu=S.punt.includes(i);const [cl,lab]=pu?['punt','Punted']:(m.length&&hasOpp?status(w[i],i):['','']);
  return `<div class="cr ${cl}" data-i="${i}" title="${c}: ${Math.round(w[i]*100)}% to win, ${Math.round(sup[i]*100)}% of pool left. Tap to ${pu?'un-punt':'punt'}."><span class="n">${c}</span><span class="pct">${m.length&&hasOpp&&!pu?Math.round(w[i]*100)+'%':'–'}</span><span class="lab">${lab}</span><div class="pl"><u style="width:${Math.round(sup[i]*100)}%"></u></div></div>`}).join('');
 document.querySelectorAll('.cr').forEach(el=>el.onclick=()=>{const i=+el.dataset.i;S.punt=S.punt.includes(i)?S.punt.filter(x=>x!==i):[...S.punt,i];save();render();});
 // alerts, recommended pick
 const heavy=nm&&(nm-o)<=3;SIMN=window.__simn||((nm===o)?8:5);const pkey=made()+'|'+S.punt.join(',')+'|'+SIMN;if(heavy&&m.length>=2&&hasOpp&&window.__plk!==pkey&&!window.__noplans){window.__pl=plans(D,w);window.__plk=pkey;}
 const PL=(m.length>=2&&nm&&hasOpp&&window.__plk===pkey)?window.__pl:null;const PLAN=(PUNTMODE()&&!S.punt.length&&PL&&PL.best&&PL.best.kind!=='base')?{punt:PL.best.punt.slice(),chase:null,kind:'punt'}:{punt:S.punt.slice(),chase:(S.chase&&S.chase.until>=o)?S.chase.cat:null,kind:(S.chase&&S.chase.until>=o)?'chase':'base'};const EP=PLAN.punt;
 const al=document.getElementById('alerts'),rc=document.getElementById('rec');let ah='';const RP=[],BP=[];const OPall=oppPunts();
 if(nm){const nx=nextAfter(nm);const live=[...Array(NC).keys()].filter(i=>!S.punt.includes(i));
  const poolNow=P.filter(p=>!D.has(p.n)&&avail(p)>=Math.min(o,nm)-8);
  if(m.length>=4&&hasOpp){
   const locked=live.filter(i=>w[i]>=.85),pr=catPrio(m);
   const swing=live.filter(i=>w[i]>=.25&&w[i]<.75).sort((a,b)=>pr[b]-pr[a]).slice(0,2);
   if(locked.length)BP.push(['Over: '+locked.map(i=>CATS[i]).join(', '),'More of these barely moves your weekly wins.']);if(swing.length)BP.push(['Closest: '+swing.map(i=>CATS[i]).join(', '),'Your tightest weekly battles.']);
   if(locked.length&&swing.length)ah+=`<div class="ov"><b>Over-indexed in ${locked.map(i=>CATS[i]).join(', ')}</b>. More of ${locked.length>1?'these':'this'} barely moves your weekly wins. Chase ${swing.map(i=>CATS[i]).join(' and ')} instead.</div>`;
   else if(swing.length)ah+=`<div class="ov"><b>Most valuable now: ${swing.map(i=>CATS[i]).join(' and ')}</b>. These are your closest weekly battles.</div>`;
  }
  const opk=Object.entries(OPall);if(opk.length)BP.push(['Opp punting '+[...new Set(opk.map(x=>CATS[x[1]]))].join(', '),opk.map(([t,i])=>`${teamName(+t)}: ${CATS[i]}`).join(', ')]);if(opk.length)ah+=`<div class="ov"><b>Opponents punting</b>: ${opk.map(([t,i])=>`${teamName(+t)} (${CATS[i]})`).join(', ')}. Players strong there are more likely to last.</div>`;
  const fall=P.filter(p=>!D.has(p.n)&&avail(p)<=o-6&&p.vr<=o+10).sort((a,b)=>a.vr-b.vr).slice(0,3);
  if(fall.length)BP.unshift(['Falling: '+fall.map(p=>sur(p.n)).join(', '),fall.map(p=>`${p.n} usually goes ~${Math.round(avail(p))}`).join('; ')]);if(fall.length)ah+=`<div class="ov"><b>Falling to you</b>: ${fall.map(p=>`${p.n} (usually goes ~${Math.round(avail(p))}, value #${p.vr}${p.risk?', injury risk':''})`).join(', ')}. The tool has already re-ranked for them; if one is top of the list, it's worth changing course.</div>`;
  const RUNS=runs();let LC=[];
  RUNS.forEach(r=>{if(r.pos){RP.push(['C run',`${r.hit.length} of the last ${r.n} picks were centers`]);ah+=`<div class="lc"><b>Center run</b>: ${r.hit.length} of the last ${r.n} picks were centers (${r.hit.slice(-3).map(p=>sur(p.n)).join(', ')}).</div>`;return;}
   if(S.punt.includes(r.i)||(m.length&&hasOpp&&w[r.i]>=.85))return;const nb=poolNow.slice().sort((a,b)=>b.z[r.i]-a.z[r.i])[0];
   RP.push(['Run: '+CATS[r.i],`${r.hit.length} of the last ${r.n} picks`]);
   ah+=`<div class="lc"><b>Run on ${CATS[r.i]}</b>: ${r.hit.length} of the last ${r.n} picks were ${CATS[r.i]} producers (${r.hit.slice(-3).map(p=>sur(p.n)).join(', ')}).${nb?` Best left: ${nb.n} (+${nb.z[r.i].toFixed(1)}).`:''}</div>`;});
  var PR=nm>o?pressure(o,nm):null;
  if(nx){const later=P.filter(p=>!D.has(p.n)&&avail(p)>=nx-2);
   const top=(arr,i)=>arr.map(p=>p.z[i]).sort((a,b)=>b-a).slice(0,3);
   const lc=live.filter(i=>!(m.length&&hasOpp&&w[i]>=.85)).map(i=>{const a=top(poolNow,i),b=top(later,i);const an=a.reduce((x,y)=>x+y,0)/Math.max(1,a.length),bn=b.reduce((x,y)=>x+y,0)/Math.max(1,b.length);
     const best=poolNow.slice().sort((x,y)=>y.z[i]-x.z[i])[0];return {i,an,bn,best};}).filter(x=>x.best&&x.an>=1&&x.bn<x.an*0.55).sort((x,y)=>(y.an-y.bn)-(x.an-x.bn)).slice(0,2);
   LC=lc;lc.forEach(x=>RP.unshift(['Last chance: '+CATS[x.i],`${x.best.n} now; best left by pick ${nx} ≈ +${x.bn.toFixed(1)}`]));lc.forEach(x=>ah+=`<div class="lc"><b>Last chance at ${CATS[x.i]}</b>: ${x.best.n} (${x.best.z[x.i]>0?'+':''}${x.best.z[x.i].toFixed(1)}). By pick ${nx}, the best left is about ${x.bn>0?'+':''}${x.bn.toFixed(1)}.</div>`);}
  al.innerHTML='';window.__RPa=RP;window.__BPa=BP;
  const atRisk=p=>{if(!PR||!PR.picks)return '';const st=[...Array(NC).keys()].filter(i=>p.z[i]>=1).sort((a,b)=>PR.cnt[b]-PR.cnt[a])[0];const tot=PR.teams;return st!==undefined&&PR.cnt[st]>=Math.max(2,Math.ceil(PR.teams/2))?`${CATS[st]} in demand: ${PR.cnt[st]} of ${tot} teams`:'';};
  const elig=n=>(byN[n]?byN[n].p.split(','):[]);
  const posFit=p=>{const ps=p.p.split(',');if(ps.length===1&&ps[0]==='C'){const c=m.filter(n=>elig(n).includes('C')).length;if(c>=3)return [0.55,`Would be your ${c+1}th C`];if(c===2)return [0.85,'3rd C'];}
   const crowd=ps.every(x=>m.filter(n=>elig(n).includes(x)).length>=5);return crowd?[0.8,'Position crowded']:[1,null];};
  const late=o>8*S.teams;
  const OP=OPall;
  const NEEDW=(window.__needw!=null?window.__needw:0.08);const needOf=p=>{let s=0;for(let i=0;i<NC;i++){if(EP.includes(i)||w[i]>=0.5)continue;s+=Math.max(0,p.z[i]-REPL[i])*(0.5-w[i]);}let pos=0;for(let i=0;i<NC;i++)if(!EP.includes(i)&&p.z[i]-REPL[i]>0.3)pos++;return pos>=2?s:s*0.5;};
  const needCats=p=>[...Array(NC).keys()].filter(i=>!EP.includes(i)&&w[i]<0.5&&p.z[i]-REPL[i]>0.3).sort((a,b)=>w[a]-w[b]).map(i=>CATS[i]);
  const sl=slopes(m).map((v,i)=>(m.length&&hasOpp&&w[i]>=.85)?v*0.3:v);
  const scar=sup.map(r=>Math.max(0.75,Math.min(1.6,1/Math.max(r,0.01))));
  const sc0=poolNow.map(p=>{const g=gain(p,sl),v=valueOf(p);let gs=0;for(let i=0;i<NC;i++)if(!EP.includes(i))gs+=(PLAN.chase===i?3:1)*sl[i]*scar[i]*(p.z[i]-REPL[i]);
   let s=m.length&&hasOpp?g+0.35*(gs-g)+0.15*v:v;const sv=nx?survive(p,nm,nx,OP):0;if(nx)s-=Math.abs(s)*0.2*sv;const pf=posFit(p);s=s>0?s*pf[0]:s/pf[0];if(late&&p.up)s+=Math.abs(s)*0.05*p.up;return {p,g,v,s,pf,sv,sn:nm>o?survive(p,o,nm,OP):null};}).sort((a,b)=>b.s-a.s);
  let sc=sc0;let FORK=null;let TIE=null;if(PL&&heavy){const cand=sc0.slice(0,Math.max(15,(S.nrec||10)+3));sc0.filter(x=>isBig(x.p)&&!cand.includes(x)).slice(0,3).forEach(x=>cand.push(x));sc0.filter(x=>!isBig(x.p)&&!cand.includes(x)).slice(0,2).forEach(x=>cand.push(x));if(m.length>=4)sc0.filter(x=>!cand.includes(x)).map(x=>[x,needOf(x.p)]).filter(y=>y[1]>0).sort((a,b)=>b[1]-a[1]).slice(0,3).forEach(y=>cand.push(y[0]));cand.forEach(x=>{const r=rollout(D,PLAN,x.p.n);x.end=r.exp;x.mw=r.mw;x.w=r.w;x.fs=r.obj-0.06*x.sv-(1-x.pf[0])*0.3+(late&&x.p.up?0.01*x.p.up:0)+LAM*x.s+NEEDW*needOf(x.p)+(o>9*S.teams?0.01*(x.p.up||0):0);});cand.forEach(x=>{if(x.w==null){const r=rollout(D,PLAN,x.p.n);x.w=r.w;}});
   sc=cand.sort((a,b)=>b.fs-a.fs).concat(sc0.filter(x=>!cand.includes(x)));
   if(window.__tieg===true&&m.length>=3){const TW=window.__tiew||0.05;const tg0=sc.filter(x=>x.fs!=null&&sc[0].fs-x.fs<=TW);if(tg0.length>=2){tg0.forEach(x=>x.nd=needOf(x.p));const grp=tg0.slice().sort((a,b)=>(b.nd-a.nd)||(b.fs-a.fs));grp.forEach(x=>x.tie=tg0.length);TIE={n:tg0.length,cats:needCats(grp[0].p)};sc=grp.concat(sc.filter(x=>!tg0.includes(x)));}}
   const bb=cand.filter(x=>isBig(x.p))[0],bg=cand.filter(x=>!isBig(x.p))[0];if(bb&&bg)FORK={bb,bg};}
  const top=sc[0];if(top){const pr=m.length&&hasOpp?sl.map((v,i)=>v*scar[i]):Array(NC).fill(1);
   const why=top.p.z.map((v,i)=>[v*pr[i],i]).filter(x=>!S.punt.includes(x[1])&&top.p.z[x[1]]>0.3).sort((a,b)=>b[0]-a[0]).slice(0,2).map(x=>CATS[x[1]]);
   const forkH='';
   let srchH='';if(S.search){const sp=byN[S.search];if(sp&&!D.has(sp.n)){let x=sc.find(y=>y.p.n===sp.n)||sc0.find(y=>y.p.n===sp.n);const rk=sc.indexOf(x);
     if(x&&x.end==null&&m.length&&hasOpp){const r=rollout(D,PLAN,sp.n);x.end=r.exp;x.mw=r.mw;x.w=r.w;}
     const nb=nx?Math.round(survive(sp,nm,nx,OPall)*100):null;const now=nm>o?Math.round(survive(sp,o,nm,OPall)*100):null;
     const val=x&&x.end!=null?(PUNTMODE()&&x.mw!=null?(x.mw*100).toFixed(1)+'% wins':x.end.toFixed(2)+' cats'):'—';
     const topv=sc[0]&&sc[0].end!=null?(PUNTMODE()&&sc[0].mw!=null?(sc[0].mw*100).toFixed(1)+'%':sc[0].end.toFixed(2)):'';
     const fc=(m.length&&hasOpp)?needCats(sp):[];
     srchH=`<div class="rec srch" data-wi="${sp.n}"><div class="l1"><b>🔍 ${sp.n}</b><span class="end">${val}</span></div><div class="l2"><span>${sp.t} ${sp.p}${rk>=0&&rk<15?' · #'+(rk+1)+' in list':(topv?' · #1 is '+topv:'')}</span>${fc.length?'<span class="t g">Fills '+fc.slice(0,2).join(', ')+'</span>':''}${now!=null?'<span class="t">'+now+'% at '+nm+'</span>':''}${nb!=null&&now==null?'<span class="t">'+nb+'% at '+nx+'</span>':''}${sp.risk?'<span class="t b">Injury prone</span>':''}</div>${S.whatIf===sp.n?whatIf(sp,m):''}</div>`;}
    else if(sp&&D.has(sp.n)){srchH=`<div class="rec srch"><div class="l2">🔍 ${sp.n} has been drafted.</div></div>`;}}
   rc.innerHTML=srchH+forkH+sc.slice(0,S.nrec||10).map((x,k)=>{const rp=x.p;const why=rp.z.map((v,i)=>[(v-REPL[i])*pr[i],i]).filter(y=>!S.punt.includes(y[1])&&y[0]>0).sort((a,b)=>b[0]-a[0]).slice(0,2).map(y=>CATS[y[1]]);
    const tg=[];const yi=L.inj&&L.inj[rp.n];if(yi)tg.push('<span class="t b">Yahoo: '+({Q:'Questionable',O:'Out',INJ:'Injured',GTD:'Game-time',DTD:'Day-to-day',NA:'Inactive',P:'Probable'}[yi]||yi)+'</span>');
    if(rp.risk)tg.push('<span class="t b">Injury prone</span>');
    const fc=(m.length&&hasOpp)?needCats(rp):[];let pos=0;for(let i=0;i<NC;i++)if(!EP.includes(i)&&rp.z[i]-REPL[i]>0.3)pos++;if(fc.length&&pos>=2)tg.unshift('<span class="t fill">▲ '+fc.slice(0,2).join(', ')+'</span>');
    let reach=false;{const ad=Math.round(avail(rp));const pk=nm||o;const q=x.sn!=null?x.sn:(nx?x.sv:0);const q2=nx?x.sv:0;if(ad>=pk+8&&q2>=0.7){reach=true;}}
    if(k>0&&sc[0].fs!=null&&x.fs!=null&&sc[0].fs-x.fs<=0.05)tg.push('<span class="t">≈ tie</span>');
    let svl='';{const q=x.sn!=null?x.sn:(nx?x.sv:null);const at=x.sn!=null?nm:nx;if(q!=null&&at)svl=Math.round(q*100)+'% lasts to '+at;}
    if(avail(rp)<=o-6&&rp.vr<=o+10)tg.push('<span class="t g">Falling</span>');if(x.pf&&x.pf[1])tg.push('<span class="t w">'+x.pf[1]+'</span>');if(o>9*S.teams&&rp.up>=0.5)tg.push('<span class="t g">Lottery ticket</span>');else if(late&&rp.up>=0.5)tg.push('<span class="t g">Upside</span>');if(S.games&&rp.gp<60)tg.push('<span class="t w">~'+rp.gp+' of 82 games · priced in</span>');
    const wi=S.whatIf===rp.n?whatIf(rp,m):'';const end=x.end!=null?(PUNTMODE()&&x.mw!=null?(x.mw*100).toFixed(1)+'% wins':x.end.toFixed(2)):'';
    const hlc=S.hl!=null?(rp.z[S.hl]-REPL[S.hl]>0.3?' hl':' dim'):'';const mtv=x.end!=null?(PUNTMODE()&&x.mw!=null?[(x.mw*100).toFixed(1)+'%','']:[x.end.toFixed(2),'']):['',''];
    const meta=`${rp.t} · ${rp.p}`;
    const foc=[...Array(NC).keys()].filter(i=>!EP.includes(i)&&rp.z[i]-REPL[i]>0.3).sort((a,b)=>(rp.z[b]-REPL[b])-(rp.z[a]-REPL[a])).slice(0,4);
    const need=new Set((m.length&&hasOpp)?[...Array(NC).keys()].filter(i=>!EP.includes(i)&&w[i]<0.5):[]);
    const hurt=[...Array(NC).keys()].filter(i=>!EP.includes(i)&&rp.z[i]-REPL[i]<-0.6).sort((a,b)=>(rp.z[a]-REPL[a])-(rp.z[b]-REPL[b])).slice(0,2);
    const chips=foc.map(i=>`<span class="fc${need.has(i)?' nd':''}">${need.has(i)?'▲ ':''}${CATS[i]}</span>`).join('')+hurt.map(i=>`<span class="fc bd">▼ ${CATS[i]}</span>`).join('');
    const tgx=tg.filter(t=>!/t fill|≈ tie/.test(t));
    const isTie=k>0&&sc[0].fs!=null&&x.fs!=null&&sc[0].fs-x.fs<=0.05;
    const qb=`<button class="qadd" data-q="${rp.n}" title="Add to your Yahoo queue">+ Queue</button>`;
    const big=k===0||isTie;
    const ntie=sc.slice(1,10).filter(y=>sc[0].fs!=null&&y.fs!=null&&sc[0].fs-y.fs<=0.05).length;const lbl=k===0&&!ntie?(nm===o?'PICK NOW':'TARGET FOR PICK '+nm):'';
    const adv=Math.round(avail(rp)),pk0=nm||o;const adk=reach?'reach':(adv<=pk0-6?'value':'par');const adp=`<span class="madp ${adk}">ADP ${adv}${adk==='reach'?' · Reach':adk==='value'?' · Value':''}</span>`;
    const sub=svl?`<span class="msv">${svl}</span>`:'';
    return `<div class="rec ${big?'c1':'c2'}${hlc}" data-wi="${rp.n}" title="Tap for what-if"><div class="rk2">${k+1}</div><div class="mn">${lbl?'<div class="lbl">'+lbl+'</div>':''}<div class="nm">${rp.n}</div><div class="meta">${meta}${k===0&&EP.includes(5)&&rp.pavr?' · BBM punt-AST #'+rp.pavr:''}</div>${chips?'<div class="fcs">'+chips+'</div>':''}${tgx.length?'<div class="tgs">'+tgx.slice(0,big?4:3).join('')+'</div>':''}</div><div class="mt">${adp}<b>${mtv[0]}</b>${sub}${qb}</div>${wi?'<div class="wiw">'+wi+(rp.josh?'<p class="josh">Josh: '+rp.josh+'</p>':'')+'</div>':''}</div>`;}).join('');

   {const nt=sc.slice(1,10).filter(y=>sc[0].fs!=null&&y.fs!=null&&sc[0].fs-y.fs<=0.05).length;if(nt){const cards=[...rc.querySelectorAll('.rec.c1,.rec.c2')].filter(e=>!e.classList.contains('srch')).slice(0,nt+1);const g=document.createElement('div');g.className='tgrp';g.innerHTML='<div class="tgl">'+(nt+1)+' players tied: your call'+(nm===o?' · pick now':'')+'</div>';cards[0].parentNode.insertBefore(g,cards[0]);cards.forEach(c=>g.appendChild(c));}}
   rc.querySelectorAll('[data-wi]').forEach(el=>el.onclick=()=>{S.whatIf=S.whatIf===el.dataset.wi?null:el.dataset.wi;save();render();});
   rc.querySelectorAll('[data-q]').forEach(b=>b.onclick=e=>{e.stopPropagation();addQ(b.dataset.q);S.qMsg='Queueing '+b.dataset.q+'…';save();browser.storage.local.set({mdfCmd:{id:Date.now(),cmd:'queue',names:[b.dataset.q]}});render();});}
  const bpaTop=poolNow.slice().sort((a,b)=>valueOf(b)-valueOf(a))[0];
  if(top){const rp=top.p,str=i=>rp.z[i]>=1,lead=nm===o?'Take '+rp.n:(nm-o<=3?'Line up '+rp.n:'Pick '+nm+': '+rp.n);let why='';
   const lc1=LC.find(x=>str(x.i)),run1=RUNS.find(r=>r.i!==undefined&&str(r.i)),rk=atRisk(rp);
   const sw=m.length&&hasOpp?rp.z.map((v,i)=>[sl[i]*scar[i]*(v-REPL[i]),i]).filter(x=>!S.punt.includes(x[1])&&x[0]>0.005).sort((a,b)=>b[0]-a[0]).slice(0,2).map(x=>x[1]):[];
   if(PLAN.kind==='chase'&&rp.z[PLAN.chase]>0.5)why=`your plan is to chase ${CATS[PLAN.chase]} and he's the best way to do it`;else if(lc1)why=`last real chance at ${CATS[lc1.i]}`;else if(run1)why=`there's a run on ${CATS[run1.i]}`;else if(rk){const mm=rk.match(/^(\S+) in demand: (\d+) of (\d+)/);why=mm?`${mm[2]} of the ${mm[3]} teams before you need ${mm[1]}`:rk;}else if(sw.length)why=`he adds the most where your weekly battles are closest (${sw.slice(0,2).map(i=>CATS[i]).join(', ')})`;else why='best fit for your build';
   let sub='';
   if(bpaTop&&bpaTop.n!==rp.n){const bs=[...Array(NC).keys()].sort((a,b)=>bpaTop.z[b]-bpaTop.z[a]).slice(0,2);const lk=bs.filter(i=>S.punt.includes(i)||(m.length&&hasOpp&&(w[i]>=.85||w[i]<.15)));
    if(lk.length)sub=`Best value is ${bpaTop.n}, but his value is mostly ${lk.map(i=>CATS[i]).join(' and ')}, which ${lk.some(i=>S.punt.includes(i))?"you're punting":lk.every(i=>w[i]>=.85)?"you've locked":"is out of reach"}.`;
    else if(nx&&survive(bpaTop,nm,nx,OPall)>=0.6)sub=`Best value is ${bpaTop.n}, but he has a ${Math.round(survive(bpaTop,nm,nx,OPall)*100)}% chance of lasting to pick ${nx}.`;
    else sub=`Best value is ${bpaTop.n}. ${rp.n.split(' ')[0]} fits your weekly matchups better.`;}
   else sub='He is also the best value on the board.';
   document.getElementById('head').innerHTML=`${lead}${sw.length?' · '+sw.slice(0,2).map(i=>CATS[i]).join(', '):''}${bpaTop&&bpaTop.n!==rp.n?`<small>Best value: ${bpaTop.n}${nx?' ('+Math.round(survive(bpaTop,nm,nx,OPall)*100)+'% lasts)':''}</small>`:''}`;}
  document.getElementById('nextT').innerHTML=`<span>${nm===o?'Recommended pick':'Recommended for pick '+nm}</span><span class="wwh">${PUNTMODE()?'Weekly wins':'Cats / week'}</span><span id="qMsg" class="qmsg">${S.qMsg||''}</span>`;
  const qb=document.getElementById('qBtn');if(qb)qb.onclick=()=>{const names=sc.slice(0,3).map(x=>x.p.n);S.qMsg='Sending…';save();browser.storage.local.set({mdfCmd:{id:Date.now(),cmd:'queue',names}});render();};
  if(nm===o&&L.secs!=null&&L.secs<=15&&top){document.getElementById('head').innerHTML=`<b>${L.secs}s left: take ${top.p.n}</b><small>If time runs out, Yahoo autodrafts from your queue.</small>`;}
 }else{al.innerHTML='';rc.innerHTML='';const hd=document.getElementById('head');if(m.length&&hasOpp){const LT=leagueTable();hd.innerHTML=`Your team: ${LT.mine.toFixed(1)} cats/week · ${LT.rank}${['st','nd','rd'][LT.rank-1]||'th'} of ${LT.n}<small>${LT.rank===1?'Projected best weekly team.':'Best team: '+LT.best.toFixed(1)+' cats/week.'} Weekly H2H projection, not Yahoo's season-total standings.</small>`;}else hd.innerHTML='';}
 const pc=document.getElementById('punt');
 if(!PL){pc.innerHTML='<div class="m" style="font-size:13px;color:var(--mute)">'+(!nm?'—':m.length<2?'After your 2nd pick':'Updates 3 picks out')+'</div>';}
 else{const {out,base,best,lost}=PL;const left=myPicks().filter(x=>x>=o).length;let h='';const gain=best.exp-base.exp;let key=null;
  const gtxt=PUNTMODE()?`${Math.round(base.mw*100)}→${Math.round(best.mw*100)}% wins`:`+${gain.toFixed(1)}`;
  if(left<=1){h=`<div class="verdict">Set</div>`;}
  else if(best.kind==='chase'){h=`<div class="verdict big">Chase ${CATS[best.cat]} (+${gain.toFixed(1)})</div><button class="applyBig" data-c="${best.cat}">Chase next 2 picks</button>`;key='c'+best.cat;}
  else if(best.kind==='punt2'){h=`<div class="verdict big">Punt ${CATS[best.cat]} + ${CATS[best.cat2]} (${gtxt})</div>${PUNTMODE()?'<div class="vsub">Recommendations already follow this.</div>':''}<button class="applyBig" data-p2="${best.cat},${best.cat2}">Lock in</button>`;key='q'+best.cat+best.cat2;}
  else if(best.kind==='punt'){h=`<div class="verdict big">Punt ${CATS[best.cat]} now (${gtxt})</div>${PUNTMODE()?'<div class="vsub">Recommendations already follow this.</div>':''}<button class="applyBig" data-p="${best.cat}">Lock in</button>`;key='p'+best.cat;}
  else{const gone=[...Array(NC).keys()].filter(i=>!S.punt.includes(i)&&base.w[i]<0.25&&w[i]<0.35);h=`<div class="verdict">${S.punt.length?'Keep plan':'Stay balanced'}${gone.length?` <span class="vsub" style="font-weight:400">· ${gone.map(i=>CATS[i]).join(', ')} lost</span>`:''}</div>`;}
  h+=`<details class="opts"><summary>Plans</summary>${out.map(r=>`<div class="row ${r===best?'best':''}"><span>${r.lab}</span><span>${r.exp.toFixed(1)}</span>${r.kind==='punt'?`<button data-p="${r.cat}">Punt</button>`:r.kind==='punt2'?`<button data-p2="${r.cat},${r.cat2}">Punt</button>`:'<span></span>'}</div>`).join('')}</details>`;
  {const dr=[...Array(NC).keys()].filter(i=>left>=2&&!S.punt.includes(i)&&w[i]<.4&&sup[i]<0.65);if(dr.length)h+=`<div class="note">Drying up: ${dr.map(i=>CATS[i]+' '+Math.round(sup[i]*100)+'%').join(', ')}</div>`;}
  if(key&&key!==S.lastPuntAlert){S.lastPuntAlert=key;save();chime();pc.classList.add('flash');setTimeout(()=>pc.classList.remove('flash'),2500);}
  if(!key&&S.lastPuntAlert){S.lastPuntAlert=null;save();}
  if(S.targetFrom&&S.punt.length)h+=`<div class="note tnote" style="border-color:var(--accent)">${S.targetFrom.split(' ').slice(-1)[0]} build</div>`;
  if(S.punt.length)h+=`<div class="pchips">${S.punt.map(i=>`<span class="pchip" data-u="${i}">Punted: ${CATS[i]} ✕</span>`).join('')}</div>`;
  pc.classList.toggle('compact',!key&&left>1);pc.innerHTML=h;pc.querySelectorAll('[data-u]').forEach(b=>b.onclick=()=>{S.punt=S.punt.filter(x=>x!==+b.dataset.u);save();render();});pc.querySelectorAll('[data-p]').forEach(b=>b.onclick=()=>{S.punt=[...S.punt,+b.dataset.p];save();render();});pc.querySelectorAll('[data-c]').forEach(b=>b.onclick=()=>{const mp=myPicks().filter(x=>x>=o);S.chase={cat:+b.dataset.c,until:mp[1]||mp[0]};save();render();});pc.querySelectorAll('[data-p2]').forEach(b=>b.onclick=()=>{S.punt=[...S.punt,...b.dataset.p2.split(',').map(Number)];save();render();});}
 const fo=document.getElementById('focus');
 if(!nm){fo.innerHTML='';}
 else{
  const nx=nextAfter(nm),wk=weakCats(w);
  const pool=P.filter(p=>!D.has(p.n)&&avail(p)>=Math.min(o,nm)-8);
  const r=pool.map(p=>({p,f:valueOf(p)})).sort((a,b)=>b.f-a.f).slice(0,5);
  const strong=[...Array(NC).keys()].filter(i=>!S.punt.includes(i)&&w[i]>=.6);
  let h=m.length?``:'';
  const nx2=nx||999;const over=pool.filter(p=>p.pre<=p.vr-20&&avail(p)<=nx2+3).sort((a,b)=>a.pre-b.pre).slice(0,2).map(p=>`${p.n} (Yahoo #${p.pre}, value #${p.vr})`);
  const conf=m.length>=3?pool.filter(p=>p.vr<=nm+25&&strong.some(k=>p.z[k]<-1.3)&&!r.some(x=>x.p===p)).sort((a,b)=>a.vr-b.vr).slice(0,2).map(p=>`${p.n} (hurts ${CATS[strong.find(k=>p.z[k]<-1.3)]})`):[];
  const avl=[...conf,...over].filter((x,i,a)=>a.findIndex(y=>y.split(' (')[0]===x.split(' (')[0])===i);if(avl.length)window.__RP2=[['Avoid: '+avl.slice(0,2).map(x=>sur(x.split(' (')[0])).join(', '),avl.join('; ')]];else window.__RP2=[];if(avl.length)h+=`<div class="avoid"><b>Avoid</b>: ${avl.join('; ')}.</div>`;
  const hasP=s=>m.some(n=>byN[n]&&byN[n].p.split(',').includes(s));const miss=['PG','SG','SF','PF','C'].filter(s=>!hasP(s));
  if(m.length>=4&&miss.length)window.__RP2.unshift(['No '+miss.join('/')+' yet','Position gap']);if(m.length>=4&&miss.length)h+=`<div class="note">No ${miss.join(', ')} yet.</div>`;
  fo.innerHTML='';const RPA=[...(window.__RPa||[]),...(window.__RP2||[])];const BPA=window.__BPa||[];
  const pill=(arr,cls)=>arr.length?`<div class="pill ${cls}" title="${arr.map(x=>x[0]+': '+x[1]).join('\n').replace(/"/g,'')}">${arr[0][0]}${arr.length>1?' <span class="more">+'+(arr.length-1)+'</span>':''}</div>`:'';
  }
 ['teams','rounds','slot'].forEach(k=>document.getElementById(k).value=S[k]);document.getElementById('sound').checked=S.sound;document.getElementById('games').checked=S.games;
}
{const fs=document.getElementById('fmtSel');if(fs){fs.value=FMT;fs.onchange=e=>{const v=e.target.value;S.fmt=v;if(v==='bvb'){S.teams=10;S.rounds=14;S.manualOn=true;}else{S.teams=12;S.rounds=14;}S.punt=[];S.targetSet=false;S.manual=[];save();location.reload();};}}
['teams','rounds','slot'].forEach(k=>document.getElementById(k).onchange=e=>{S[k]=+e.target.value||S[k];save();render();});

document.getElementById('sound').onchange=e=>{S.sound=e.target.checked;save();if(S.sound)chime();};
document.getElementById('testSound').onclick=()=>{const s=S.sound;S.sound=true;chime();S.sound=s;};
document.addEventListener('click',()=>{try{AC=AC||new (window.AudioContext||window.webkitAudioContext)();AC.resume();}catch(e){}},{once:true});
document.getElementById('games').onchange=e=>{S.games=e.target.checked;setGames();save();render();};
document.getElementById('clearPunt').onclick=()=>{S.punt=[];save();render();};
// First-round builds, by league size. From simulated H2H drafts (weekly matchup win %); single punts only, kept when they beat balanced.
const TGS={bvb:{},12:{'Tyrese Maxey':[5]},10:{'Shai Gilgeous-Alexander':[5],'Tyrese Maxey':[5],'Anthony Edwards':[5],'Giannis Antetokounmpo':[2]}};
function applyTG(){const n=S.targetN;if(!n)return;const tb=TGS[FMT==='bvb'?'bvb':S.teams]||{};const was=S.targetAuto||null;
 if(S.targetT!=null&&!(was?S.punt.join()===was.join():!S.punt.length)){S.targetT=S.teams;return;}
 if(was&&S.punt.join()===was.join()){S.punt=[];S.targetAuto=null;S.targetFrom=null;}
 if(tb[n]&&!S.punt.length){S.punt=tb[n].slice();S.targetAuto=tb[n].slice();S.targetFrom=n;}
 S.targetT=S.teams;}
let LIVE={picks:[]};
function mergeManual(){const have=new Set(LIVE.picks.map(p=>p.o));const man=(S.manual||[]).filter(p=>!have.has(p.o));L=Object.assign({},LIVE,{picks:LIVE.picks.concat(man).sort((a,b)=>a.o-b.o)});}
function apply(v){if(v&&Array.isArray(v.picks)){if(v.draft&&v.draft!==S.draftId){S.draftId=v.draft;S.punt=[];S.lastPuntAlert=null;S.manual=[];S.targetSet=false;S.targetFrom=null;S.targetN=null;S.targetAuto=null;S.targetT=null;save();}LIVE=v;mergeManual();v=L;
 {const T=S.teams;const r1={};v.picks.forEach(p=>{if(p.o<=T&&p.team)r1[p.team]=p.o;});const r3=v.picks.find(p=>p.o===2*T+1&&p.team&&r1[p.team]);
  if(r3&&S.orderAuto!==false){const od=r1[r3.team]===T?'3rr':(r1[r3.team]===1?'snake':S.order);if(od!==S.order){S.order=od;window.__plk=null;save();}}}
 {const f0=L.picks.find(p=>teamOf(p.o)===slot());if(f0&&!S.targetSet&&S.goal!=='balanced'){S.targetSet=true;S.targetN=f0.n;applyTG();save();}}if(v.rounds>=8&&v.rounds<=20)S.rounds=v.rounds;const ids=v.picks.map(p=>+p.team).filter(Boolean);const mx=ids.length?Math.max(...ids):0;if(mx>=8&&ids.length>=mx&&S.teams!==mx){S.teams=mx;if(S.targetSet&&S.targetT!==mx){applyTG();save();}}}render();}
browser.storage.local.get('mdfLive').then(r=>apply(r.mdfLive));
browser.storage.onChanged.addListener((c,a)=>{if(a==='local'&&c.mdfLive)apply(c.mdfLive.newValue);if(a==='local'&&c.mdfCmdResult){S.qMsg=c.mdfCmdResult.newValue.msg;save();render();}});
render();

(function(){if(typeof DATAINFO==='undefined')window.DATAINFO={src:'built-in',version:typeof DATA_VERSION!=='undefined'?DATA_VERSION:''};const di=document.getElementById('dataInfo');if(di)di.textContent=((S.fmt==='bvb'&&FMT!=='bvb')?'⚠ This data has no 11-cat values: click Use built-in data. ':'')+(DATAINFO.src==='file'?'loaded file, ':'built-in, ')+DATAINFO.version+' · '+P.length+' players';
 const f=document.getElementById('dataFile');if(f)f.onchange=e=>{const file=e.target.files[0];if(!file)return;const rd=new FileReader();rd.onload=()=>{try{const d=JSON.parse(rd.result);if(d.type!=='mdf-data'||!Array.isArray(d.P)||!d.P.length||!d.P[0].z)throw new Error('Not a draft co-pilot data file');
   browser.storage.local.set({mdfData:d}).then(()=>{document.getElementById('dataMsg').textContent='Loaded '+(d.version||'')+'. Refresh the Yahoo draft tab.';setTimeout(()=>location.reload(),1200);});}catch(err){document.getElementById('dataMsg').textContent='Could not load: '+err.message;}};rd.readAsText(file);};
 const rb=document.getElementById('dataReset');if(rb)rb.onclick=()=>{browser.storage.local.remove('mdfData').then(()=>{document.getElementById('dataMsg').textContent='Using built-in data. Refresh the Yahoo draft tab.';setTimeout(()=>location.reload(),1200);});};
 const pop=/popout=1/.test(location.search);const nb=document.getElementById('now');
 if(!pop&&nb&&browser.windows){const b=document.createElement('button');b.id='popout';b.textContent='Pop out';b.title='Open in its own window';b.onclick=()=>browser.windows.create({url:browser.runtime.getURL('panel.html?popout=1'),type:'popup',width:440,height:960});nb.parentNode.insertBefore(b,nb);}
})();

(function(){
 const box=document.createElement('div');box.id='manualBox';box.innerHTML='<div class="mrow"><input id="mIn" list="mList" placeholder="Type a drafted player, press Enter"><button id="mUndo" title="Undo last manual pick">Undo</button></div><datalist id="mList"></datalist><div id="mMsg" class="dmsg"></div>';
 const now=document.getElementById('now');now.parentNode.insertBefore(box,now.nextSibling);
 const fb=document.createElement('div');fb.id='feedBadge';now.parentNode.insertBefore(fb,box);
 const dl=document.getElementById('mList');
 const refreshList=()=>{const D=new Set(L.picks.map(p=>p.n));dl.innerHTML=P.filter(p=>!D.has(p.n)).slice().sort((a,b)=>a.pre-b.pre).slice(0,250).map(p=>'<option value="'+p.n+'">').join('');};
 const inp=document.getElementById('mIn');
 inp.addEventListener('keydown',e=>{if(e.key!=='Enter')return;const v=inp.value.trim().toLowerCase();const p=P.find(x=>x.n.toLowerCase()===v)||P.find(x=>x.n.toLowerCase().includes(v));if(!p){document.getElementById('mMsg').textContent='No match';return;}
  const o=made()+1;S.manual=(S.manual||[]).concat([{o,n:p.n,manual:true}]);save();inp.value='';document.getElementById('mMsg').textContent='Pick '+o+': '+p.n;mergeManual();render();refreshList();});
 document.getElementById('mUndo').onclick=()=>{S.manual=(S.manual||[]).slice(0,-1);save();mergeManual();render();refreshList();};
 const upd=()=>{const live=LIVE.picks.length,man=(S.manual||[]).length;const pk=+((LIVE.clock||'').match(/Pick (\d+)/)||[])[1]||0;
  const stale=pk>1&&live<pk-2;const show=S.manualOn||stale||man>0;box.style.display=show?'block':'none';
  fb.className='fb '+(stale?'bad':live?'ok':'idle');const off=LIVE.ts&&Date.now()-LIVE.ts>20000;fb.className='fb '+(stale||off?'bad':live?'ok':'idle');fb.textContent=stale?'Not reading picks: enter them below':off?'offline':live?'✓ live':(man?'manual':'waiting');refreshList();};
 setInterval(upd,2000);upd();
 // settings additions
 const det=document.querySelector('details');const ex=document.createElement('div');ex.className='dsec';
 ex.innerHTML='<label><input type="checkbox" id="manOn"> Show manual pick entry</label><label>Goal <select id="goalSel"><option value="punt">Punt to win matchups</option><option value="balanced">Balanced (average categories)</option></select></label><button id="cheat" class="fbtn">Print cheat sheet</button>';
 det.appendChild(ex);
 const mo=document.getElementById('manOn');mo.checked=!!S.manualOn;mo.onchange=e=>{S.manualOn=e.target.checked;save();upd();};
 const gs=document.getElementById('goalSel');gs.value=S.goal||'punt';gs.onchange=e=>{S.goal=e.target.value;window.__plk=null;save();render();};
 document.getElementById('cheat').onclick=()=>{
  const pa=S.punt.includes(5);const list=P.slice().sort((a,b)=>pa?((a.pavr||999)-(b.pavr||999))||(a.vr-b.vr):a.vr-b.vr).slice(0,216);
  const rows=list.map((p,i)=>{const top=p.z.map((v,k)=>[v,k]).sort((a,b)=>b[0]-a[0]).slice(0,2).filter(x=>x[0]>0.4).map(x=>CATS[x[1]]).join(' ');
   const note=[p.risk?'Inj':'',p.rook?'Rookie':'',p.up>=0.5?'Upside':''].filter(Boolean).join(' ');
   return (i%12===0?'<tr class="tier"><td colspan="7">Tier '+(i/12+1)+' (round '+(i/12+1)+' value)</td></tr>':'')+'<tr><td>'+(i+1)+'</td><td><b>'+p.n+'</b></td><td>'+p.t+' '+p.p+'</td><td>'+top+'</td><td>'+p.gp+'</td><td>'+(p.adp?Math.round(p.adp):p.pre)+'</td><td>'+note+'</td></tr>';}).join('');
  const html='<!doctype html><meta charset="utf-8"><title>Draft cheat sheet</title><style>body{font:11px Arial;margin:12mm}h1{font-size:16px;margin:0 0 4px}p{margin:0 0 8px;color:#555}table{border-collapse:collapse;width:100%}td{padding:1px 4px;border-bottom:1px solid #ddd}.tier td{background:#1D428A;color:#fff;font-weight:bold;padding:2px 4px}@media print{tr{break-inside:avoid}}</style><h1>Draft cheat sheet: top 216 by '+(pa?'BBM punt-AST value':'value')+'</h1><p>Data: '+(typeof DATAINFO!=="undefined"?DATAINFO.version:'')+'. Columns: rank, player, team/pos, best categories, projected games, ADP, notes. Backup if the co-pilot fails on draft day.</p><table>'+rows+'</table><script>window.print()<\/script>';
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([html],{type:'text/html'}));a.download='draft-cheat-sheet.html';document.body.appendChild(a);a.click();a.remove();
  document.getElementById('dataMsg').textContent='Saved draft-cheat-sheet.html: open it and print.';};
})();

(function(){const h2=document.getElementById('nextT');const wrap=document.createElement('div');wrap.className='sbox';
 wrap.innerHTML='<input id="sIn" list="sList" placeholder="Search any player to test…"><button id="sClr">✕</button><datalist id="sList"></datalist>';
 h2.parentNode.insertBefore(wrap,h2);const inp=document.getElementById('sIn'),dl=document.getElementById('sList');
 const fill=()=>{const D=new Set(L.picks.map(p=>p.n));dl.innerHTML=P.filter(p=>!D.has(p.n)).sort((a,b)=>a.vr-b.vr).slice(0,300).map(p=>'<option value="'+p.n+'">').join('');};
 inp.addEventListener('focus',fill);
 const go=()=>{const v=inp.value.trim().toLowerCase();if(!v)return;const p=P.find(x=>x.n.toLowerCase()===v)||P.find(x=>x.n.toLowerCase().includes(v));if(p){S.search=p.n;S.whatIf=p.n;save();render();}};
 inp.addEventListener('change',go);inp.addEventListener('keydown',e=>{if(e.key==='Enter')go();});
 document.getElementById('sClr').onclick=()=>{S.search=null;inp.value='';save();render();};
 // draft order setting
 const det=document.querySelector('details');const ex=document.createElement('div');ex.className='dsec';
 ex.innerHTML='<label>Draft order <select id="ordSel"><option value="auto">Auto-detect</option><option value="snake">Snake</option><option value="3rr">3rd-round reversal</option></select></label> <span id="ordNow" class="dmsg"></span>';
 det.appendChild(ex);const os=document.getElementById('ordSel');os.value=S.orderAuto===false?(S.order||'snake'):'auto';
 const show=()=>{document.getElementById('ordNow').textContent='Using: '+(S.order==='3rr'?'3rd-round reversal':'snake');};show();
 os.onchange=e=>{if(e.target.value==='auto'){S.orderAuto=true;}else{S.orderAuto=false;S.order=e.target.value;}window.__plk=null;save();render();show();};
 setInterval(show,3000);
})();



(function(){const hd=document.querySelector('.top2 .h3');const tg=document.createElement('span');tg.className='keytg';hd.appendChild(tg);
 const ap=()=>{document.body.classList.toggle('nokey',!S.showKey);tg.textContent=S.showKey?'Hide colour key':'Show colour key';};
 tg.onclick=()=>{S.showKey=!S.showKey;save();ap();};ap();})();

(function(){const _r=render;render=function(){_r.apply(this,arguments);try{const hd=document.getElementById('head');const o=cur(),nm=nextMine();const show=!nm||o>total()||(nm===o&&L.secs!=null&&L.secs<=15);hd.style.display=show?'':'none';}catch(e){}};render();})();

(function(){S.hl=null;
 const now=document.getElementById('now'),fb=document.getElementById('feedBadge'),po=document.getElementById('popout');
 const row=document.createElement('div');row.className='statusrow';now.parentNode.insertBefore(row,now);row.appendChild(now);if(fb)row.appendChild(fb);if(po)row.appendChild(po);
 
})();

(function(){
 // queue bar
 const qb=document.createElement('div');qb.id='qbar';document.body.appendChild(qb);
 const drawQ=()=>{const D=new Set(L.picks.map(p=>p.n));const q=S.queue||[];const gone=q.filter(n=>D.has(n));
  if(gone.length){S.queue=q.filter(n=>!D.has(n));save();beep2();const t=document.createElement('div');t.className='qtoast';t.textContent=gone.join(', ')+(gone.length>1?' were':' was')+' taken';document.body.appendChild(t);setTimeout(()=>t.remove(),4000);}
  const cur2=S.queue||[];qb.style.display=cur2.length?'flex':'none';
  qb.innerHTML='<span class="qh">Your queue</span>'+cur2.map(n=>{const p=byN[n];return `<span class="qi">${n.replace(/\s+(Jr\.|Sr\.|II|III|IV)$/,'').split(' ').slice(-1)[0]}${p?' <i>ADP '+Math.round(avail(p))+'</i>':''}<b data-rm="${n}">✕</b></span>`;}).join('');
  qb.querySelectorAll('[data-rm]').forEach(b=>b.onclick=()=>{S.queue=(S.queue||[]).filter(n=>n!==b.dataset.rm);save();drawQ();});};
 const _r=render;render=function(){_r.apply(this,arguments);try{drawQ();}catch(e){}};
 // search dropdown
 const inp=document.getElementById('sIn');inp.removeAttribute('list');const dd=document.createElement('div');dd.id='sdd';inp.parentNode.appendChild(dd);inp.parentNode.style.position='relative';
 const pick=n=>{S.search=n;S.whatIf=n;inp.value=n;dd.style.display='none';save();render();};
 const clear=()=>{S.search=null;S.whatIf=null;inp.value='';dd.style.display='none';save();render();};
 const list=()=>{const v=inp.value.trim().toLowerCase();if(!v){dd.style.display='none';return;}const D=new Set(L.picks.map(p=>p.n));
  const r=P.filter(p=>!D.has(p.n)&&p.n.toLowerCase().includes(v)).sort((a,b)=>avail(a)-avail(b)).slice(0,8);
  if(!r.length){dd.style.display='none';return;}
  dd.innerHTML=r.map(p=>`<div class="sdi" data-n="${p.n}"><span class="sdn">${p.n}</span><span class="sdm">${p.t} · ${p.p}</span><span class="sda">ADP ${Math.round(avail(p))}</span><button class="sdq" data-q="${p.n}">+ Queue</button></div>`).join('');dd.style.display='block';
  dd.querySelectorAll('.sdi').forEach(el=>el.onmousedown=e=>{if(e.target.classList.contains('sdq'))return;e.preventDefault();pick(el.dataset.n);});
  dd.querySelectorAll('.sdq').forEach(b=>b.onmousedown=e=>{e.preventDefault();e.stopPropagation();addQ(b.dataset.q);browser.storage.local.set({mdfCmd:{id:Date.now(),cmd:'queue',names:[b.dataset.q]}});b.textContent='Queued';render();});};
 inp.addEventListener('input',list);inp.addEventListener('focus',list);inp.addEventListener('blur',()=>setTimeout(()=>dd.style.display='none',150));
 inp.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();clear();inp.blur();}});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&S.search){clear();}});
 document.getElementById('sClr').onclick=clear;
 // settings: number of suggestions
 const det=document.querySelector('details');const ex=document.createElement('div');ex.className='dsec';
 ex.innerHTML='<label>Suggested players <input type="range" id="nrec" min="10" max="20" step="1"> <b id="nrecv"></b></label>';det.appendChild(ex);
 const nr=document.getElementById('nrec'),nv=document.getElementById('nrecv');nr.value=S.nrec||10;nv.textContent=nr.value;
 nr.oninput=e=>{nv.textContent=e.target.value;};nr.onchange=e=>{S.nrec=+e.target.value;save();render();};
 drawQ();
})();
