const {JSDOM}=require('jsdom'); const B=require(require('path').join(__dirname,'..','..','firefox','bbmx.js'));
const rows=Array.from({length:22},(_,i)=>`<tr><td><a href="playerinfo.aspx?i=${i+1}">P${i}</a></td><td>LAL</td><td>40</td><td>${i===0?'<span class="badge mr-1"><span class="tooltip-control" title="Still a massive sell high (1.9d)"><i></i></span>&nbsp;Josh&nbsp;Sell High</span>':i===1?'<span class="badge"><span title="Minutes coming back (21.3h)"></span>&nbsp;Josh&nbsp;Buy Low</span><span class="badge"><span title="Bad game (2d)"></span>&nbsp;Josh</span>':i===2?'<span class="badge"><span title="cut him (5d)"></span>&nbsp;Josh&nbsp;Droppable 12 teams</span>':''}</td><td>10</td></tr>`).join('');
const d=new JSDOM(`<table><thead><tr><th>Name</th><th>Team</th><th>g</th><th>Analysts</th><th>p/g</th></tr></thead><tbody>${rows}</tbody></table>`).window.document;
const t=B.parseTable(d); const n=i=>JSON.stringify(t.rows[i].notes);
console.log(n(0)); console.log(n(1)); console.log(n(2)); console.log(n(3));
const ok=t.rows[0].notes[0].tag==='Sell High'&&t.rows[0].notes[0].age>40&&t.rows[1].notes[0].tag==='Buy Low'&&t.rows[1].notes[1].tag===null&&t.rows[2].notes[0].tag==='Droppable'&&t.rows[2].notes[0].tagNote==='12 teams';
console.log(ok?'tags ok':'TAGS FAIL'); process.exit(ok?0:1);
