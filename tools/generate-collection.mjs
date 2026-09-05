import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const storageBridge = `
const nexusStore = (() => {
  let sequence = 0;
  const pending = new Map();
  addEventListener('message', (event) => {
    const data = event.data || {};
    if (data.channel !== 'nexus-extension-response' || !pending.has(data.requestId)) return;
    const item = pending.get(data.requestId);
    pending.delete(data.requestId);
    data.error ? item.reject(new Error(data.error)) : item.resolve(data.value);
  });
  const request = (action, value) => new Promise((resolve, reject) => {
    const requestId = 'req-' + Date.now() + '-' + (++sequence);
    pending.set(requestId, { resolve, reject });
    parent.postMessage({ channel: 'nexus-extension-v1', requestId, action, value }, '*');
    setTimeout(() => {
      if (!pending.has(requestId)) return;
      pending.delete(requestId);
      reject(new Error('Nexus-opslag reageert niet.'));
    }, 2500);
  });
  return { load: () => request('load'), save: (value) => request('save', value) };
})();
`;

function sandboxHtml({ title, intro, body, script, accent = '#7c5cff', storage = false }) {
  return `<!doctype html>
<html lang="nl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title}</title>
  <style>
    :root{color-scheme:dark;--accent:${accent};--panel:#171826;--panel2:#202235;--text:#f5f7ff;--muted:#a9aec5;--border:rgba(255,255,255,.11)}
    *{box-sizing:border-box}body{margin:0;min-height:100vh;background:radial-gradient(circle at 88% 0,color-mix(in srgb,var(--accent) 20%,transparent),transparent 38%),#0d0e16;color:var(--text);font:14px/1.45 Inter,Segoe UI,sans-serif}
    main{max-width:760px;margin:auto;padding:22px}.head{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:18px}.eyebrow{color:var(--accent);font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase}h1{font-size:25px;line-height:1.1;margin:4px 0 5px}.intro,.muted{color:var(--muted)}
    .card{background:linear-gradient(145deg,rgba(255,255,255,.055),rgba(255,255,255,.018));border:1px solid var(--border);border-radius:18px;padding:16px;box-shadow:0 18px 50px rgba(0,0,0,.2)}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px}.row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.stack{display:grid;gap:11px}
    button,input,select,textarea{font:inherit;color:inherit;border:1px solid var(--border);border-radius:11px;background:var(--panel2);padding:10px 12px}input,select,textarea{width:100%}textarea{resize:vertical;min-height:92px}button{cursor:pointer;font-weight:750;width:auto}button:hover{border-color:color-mix(in srgb,var(--accent) 70%,white);transform:translateY(-1px)}button.primary{background:var(--accent);border-color:transparent;color:#fff}.grow{flex:1}.big{font-size:38px;font-weight:850;letter-spacing:-.04em}.metric{padding:15px;background:rgba(0,0,0,.18);border:1px solid var(--border);border-radius:14px}.metric strong{display:block;font-size:25px}.pill{display:inline-flex;padding:5px 9px;border-radius:999px;background:color-mix(in srgb,var(--accent) 16%,transparent);color:color-mix(in srgb,var(--accent) 70%,white);font-size:12px;font-weight:800}
    .list{display:grid;gap:8px}.item{display:flex;align-items:center;gap:10px;padding:10px 12px;background:rgba(0,0,0,.18);border:1px solid var(--border);border-radius:12px}.item span{min-width:0;overflow-wrap:anywhere}.item button{margin-left:auto;padding:6px 9px}.result{padding:14px;border-radius:14px;background:color-mix(in srgb,var(--accent) 12%,transparent);border:1px solid color-mix(in srgb,var(--accent) 35%,transparent);font-weight:750}.notice{min-height:20px;margin-top:10px;color:var(--muted);font-size:12px}label{display:grid;gap:6px;color:var(--muted);font-size:12px;font-weight:700}progress{width:100%;height:12px;accent-color:var(--accent)}
    @media(max-width:520px){main{padding:15px}h1{font-size:21px}.big{font-size:31px}}
  </style>
</head>
<body><main><header class="head"><div><div class="eyebrow">Nexus local addon</div><h1>${title}</h1><div class="intro">${intro}</div></div><span class="pill">Lokaal</span></header>${body}<div id="notice" class="notice" aria-live="polite"></div></main><script>${storage ? storageBridge : ''}${script}</script></body></html>`;
}

const packages = [
  {
    id: 'pomodoro-deck', version: '1.0.0', name: 'Pomodoro Deck', kind: 'widget', accent: '#ff5f7e', permissions: ['storage'], height: 450,
    description: 'Een lokale focus- en pauzetimer met sessieteller en instelbare intervallen.',
    html: sandboxHtml({ title: 'Pomodoro Deck', intro: 'Werk in heldere blokken en neem op tijd pauze.', accent: '#ff5f7e', storage: true,
      body: `<section class="card stack"><div class="row"><span id="phase" class="pill">Focus</span><span id="sessions" class="muted">0 sessies voltooid</span></div><div id="clock" class="big" aria-live="polite">25:00</div><progress id="progress" max="1500" value="0"></progress><div class="row"><button id="start" class="primary">Start</button><button id="reset">Opnieuw</button><button id="switch">Wissel fase</button></div><div class="grid"><label>Focusminuten<input id="focusMinutes" type="number" min="1" max="120" value="25"></label><label>Pauzeminuten<input id="breakMinutes" type="number" min="1" max="60" value="5"></label></div></section>`,
      script: `const $=id=>document.getElementById(id);let state={focus:25,rest:5,phase:'focus',remaining:1500,sessions:0},timer=null;function total(){return 60*(state.phase==='focus'?state.focus:state.rest)}function draw(){$('phase').textContent=state.phase==='focus'?'Focus':'Pauze';$('sessions').textContent=state.sessions+' sessies voltooid';$('clock').textContent=String(Math.floor(state.remaining/60)).padStart(2,'0')+':'+String(state.remaining%60).padStart(2,'0');$('progress').max=total();$('progress').value=total()-state.remaining;$('start').textContent=timer?'Pauzeer':'Start';$('focusMinutes').value=state.focus;$('breakMinutes').value=state.rest}async function save(){try{await nexusStore.save({...state,remaining:total()})}catch(e){$('notice').textContent=e.message}}function stop(){clearInterval(timer);timer=null}function changePhase(next){stop();if(state.phase==='focus'&&next==='break')state.sessions++;state.phase=next;state.remaining=total();save();draw()}$('start').onclick=()=>{if(timer){stop();draw();return}timer=setInterval(()=>{state.remaining--;if(state.remaining<=0)changePhase(state.phase==='focus'?'break':'focus');draw()},1000);draw()};$('reset').onclick=()=>{stop();state.remaining=total();draw()};$('switch').onclick=()=>changePhase(state.phase==='focus'?'break':'focus');for(const id of ['focusMinutes','breakMinutes'])$(id).onchange=()=>{state.focus=Math.max(1,Number($('focusMinutes').value)||25);state.rest=Math.max(1,Number($('breakMinutes').value)||5);state.remaining=total();save();draw()};nexusStore.load().then(v=>{if(v&&typeof v==='object')state={...state,...v,remaining:60*((v.phase||'focus')==='focus'?(v.focus||25):(v.rest||5))};draw()}).catch(()=>draw());draw();`
    })
  },
  {
    id: 'habit-streak', version: '1.0.0', name: 'Habit Streak', kind: 'widget', accent: '#36d399', permissions: ['storage'], height: 440,
    description: 'Houd één dagelijkse gewoonte bij met een lokale reeks en totaalstand.',
    html: sandboxHtml({ title: 'Habit Streak', intro: 'Bouw elke dag verder aan één goede gewoonte.', accent: '#36d399', storage: true,
      body: `<section class="card stack"><label>Mijn gewoonte<input id="habit" maxlength="50" value="30 minuten bewegen"></label><div class="grid"><div class="metric"><span class="muted">Huidige reeks</span><strong id="streak">0 dagen</strong></div><div class="metric"><span class="muted">Totaal</span><strong id="total">0 keer</strong></div></div><button id="done" class="primary">Vandaag voltooid</button><button id="clear">Reeks resetten</button></section>`,
      script: `const $=id=>document.getElementById(id);let state={habit:'30 minuten bewegen',dates:[]};const day=()=>new Date().toISOString().slice(0,10);function streak(){let n=0,d=new Date();for(;;){const key=d.toISOString().slice(0,10);if(!state.dates.includes(key))break;n++;d.setDate(d.getDate()-1)}return n}function draw(){$('habit').value=state.habit;$('streak').textContent=streak()+' dagen';$('total').textContent=state.dates.length+' keer';const yes=state.dates.includes(day());$('done').disabled=yes;$('done').textContent=yes?'Vandaag voltooid ✓':'Vandaag voltooid'}async function save(){await nexusStore.save(state);draw()}$('habit').onchange=()=>{state.habit=$('habit').value.trim()||'Mijn gewoonte';save()};$('done').onclick=()=>{if(!state.dates.includes(day()))state.dates.push(day());save()};$('clear').onclick=()=>{state.dates=[];save()};nexusStore.load().then(v=>{if(v&&Array.isArray(v.dates))state=v;draw()}).catch(()=>draw());draw();`
    })
  },
  {
    id: 'dice-roller', version: '1.0.0', name: 'Dice Roller', kind: 'tool', accent: '#f6c945', permissions: [], height: 360,
    description: 'Gooi gangbare dobbelstenen lokaal met een compacte worpengeschiedenis.',
    html: sandboxHtml({ title: 'Dice Roller', intro: 'Voor tabletop, challenges en snelle beslissingen.', accent: '#f6c945',
      body: `<section class="card stack"><div class="row" id="dice"><button data-sides="4">D4</button><button data-sides="6">D6</button><button data-sides="8">D8</button><button data-sides="10">D10</button><button data-sides="12">D12</button><button class="primary" data-sides="20">D20</button></div><div id="result" class="big" aria-live="polite">—</div><div><span class="muted">Laatste worpen</span><div id="history" class="row"></div></div></section>`,
      script: `const out=document.getElementById('result'),history=[];document.getElementById('dice').onclick=e=>{const sides=Number(e.target.dataset.sides);if(!sides)return;const value=Math.floor(Math.random()*sides)+1;out.textContent=value;history.unshift('D'+sides+': '+value);history.splice(8);const box=document.getElementById('history');box.replaceChildren(...history.map(x=>{const s=document.createElement('span');s.className='pill';s.textContent=x;return s}))};`
    })
  },
  {
    id: 'decision-wheel', version: '1.0.0', name: 'Decision Wheel', kind: 'tool', accent: '#ff8a4c', permissions: ['storage'], height: 420,
    description: 'Kies willekeurig uit je eigen opgeslagen opties, volledig offline.',
    html: sandboxHtml({ title: 'Decision Wheel', intro: 'Plak opties op losse regels en laat Nexus kiezen.', accent: '#ff8a4c', storage: true,
      body: `<section class="card stack"><label>Opties<textarea id="options">Eerste optie&#10;Tweede optie&#10;Derde optie</textarea></label><button id="pick" class="primary">Kies voor mij</button><div id="result" class="result" aria-live="polite">Klaar om te kiezen.</div></section>`,
      script: `const input=document.getElementById('options'),result=document.getElementById('result');let spinning=false;function values(){return input.value.split('\\n').map(x=>x.trim()).filter(Boolean)}input.onchange=()=>nexusStore.save({options:input.value});document.getElementById('pick').onclick=()=>{const list=values();if(!list.length){result.textContent='Voeg eerst een optie toe.';return}if(spinning)return;spinning=true;let ticks=0;const spin=setInterval(()=>{result.textContent=list[Math.floor(Math.random()*list.length)];if(++ticks>=12){clearInterval(spin);spinning=false;result.textContent='Keuze: '+list[Math.floor(Math.random()*list.length)]}},70)};nexusStore.load().then(v=>{if(v&&v.options)input.value=v.options}).catch(()=>{});`
    })
  },
  {
    id: 'session-planner', version: '1.0.0', name: 'PC Session Planner', kind: 'tool', accent: '#6aa8ff', permissions: ['storage'], height: 440,
    description: 'Plan taken voor je pc-sessie en vink ze af zonder cloudaccount.',
    html: sandboxHtml({ title: 'PC Session Planner', intro: 'Maak een korte route voor je volgende game- of werksessie.', accent: '#6aa8ff', storage: true,
      body: `<section class="card stack"><form id="form" class="row"><input id="task" class="grow" maxlength="80" placeholder="Bijv. drivers bijwerken" aria-label="Nieuwe taak"><input id="minutes" type="number" min="5" max="480" value="30" style="width:100px" aria-label="Minuten"><button class="primary">Toevoegen</button></form><div id="total" class="muted"></div><div id="list" class="list"></div></section>`,
      script: `const list=document.getElementById('list');let items=[];async function save(){await nexusStore.save({items});draw()}function draw(){list.replaceChildren(...items.map((item,i)=>{const row=document.createElement('label');row.className='item';const check=document.createElement('input');check.type='checkbox';check.checked=item.done;check.style.width='auto';check.onchange=()=>{items[i].done=check.checked;save()};const text=document.createElement('span');text.textContent=item.name+' · '+item.minutes+' min';if(item.done)text.style.textDecoration='line-through';const del=document.createElement('button');del.type='button';del.textContent='×';del.onclick=()=>{items.splice(i,1);save()};row.append(check,text,del);return row}));document.getElementById('total').textContent=items.filter(x=>!x.done).reduce((n,x)=>n+x.minutes,0)+' minuten gepland'}document.getElementById('form').onsubmit=e=>{e.preventDefault();const input=document.getElementById('task'),name=input.value.trim();if(!name)return;items.push({name,minutes:Math.max(5,Number(document.getElementById('minutes').value)||30),done:false});input.value='';save()};nexusStore.load().then(v=>{items=Array.isArray(v&&v.items)?v.items:[];draw()}).catch(()=>draw());draw();`
    })
  },
  {
    id: 'water-tracker', version: '1.0.0', name: 'Water Tracker', kind: 'widget', accent: '#39bdf8', permissions: ['storage'], height: 460,
    description: 'Volg je dagelijkse waterinname met een lokaal doel en snelle knoppen.',
    html: sandboxHtml({ title: 'Water Tracker', intro: 'Blijf tijdens lange sessies goed gehydrateerd.', accent: '#39bdf8', storage: true,
      body: `<section class="card stack"><div class="row"><div id="amount" class="big">0 ml</div><span id="goalText" class="muted"></span></div><progress id="progress" value="0" max="2000"></progress><div class="row"><button data-add="250" class="primary">+ 250 ml</button><button data-add="500">+ 500 ml</button><button id="undo">− 250 ml</button></div><label>Dagdoel in ml<input id="goal" type="number" min="500" max="6000" step="250" value="2000"></label><button id="reset">Vandaag resetten</button></section>`,
      script: `const $=id=>document.getElementById(id);let state={amount:0,goal:2000,date:new Date().toISOString().slice(0,10)};function draw(){const today=new Date().toISOString().slice(0,10);if(state.date!==today){state.amount=0;state.date=today;nexusStore.save(state)}$('amount').textContent=state.amount+' ml';$('goalText').textContent='van '+state.goal+' ml';$('progress').max=state.goal;$('progress').value=state.amount;$('goal').value=state.goal}function save(){nexusStore.save(state).then(draw)}document.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>{state.amount+=Number(b.dataset.add);save()});$('undo').onclick=()=>{state.amount=Math.max(0,state.amount-250);save()};$('reset').onclick=()=>{state.amount=0;save()};$('goal').onchange=()=>{state.goal=Math.max(500,Number($('goal').value)||2000);save()};nexusStore.load().then(v=>{if(v&&typeof v.amount==='number')state=v;draw()}).catch(()=>draw());draw();`
    })
  },
  {
    id: 'game-backlog-picker', version: '1.0.0', name: 'Game Backlog Picker', kind: 'tool', accent: '#a78bfa', permissions: ['storage'], height: 430,
    description: 'Bewaar je gamebacklog en laat Nexus willekeurig je volgende game kiezen.',
    html: sandboxHtml({ title: 'Game Backlog Picker', intro: 'Geen keuzestress: één klik bepaalt wat je start.', accent: '#a78bfa', storage: true,
      body: `<section class="card stack"><label>Games, één per regel<textarea id="games" placeholder="Cyberpunk 2077&#10;Forza Horizon 5"></textarea></label><div class="row"><button id="save">Lijst bewaren</button><button id="pick" class="primary">Kies een game</button></div><div id="result" class="result" aria-live="polite">Je keuze verschijnt hier.</div></section>`,
      script: `const games=document.getElementById('games'),result=document.getElementById('result');function values(){return games.value.split('\\n').map(x=>x.trim()).filter(Boolean)}function save(){nexusStore.save({games:games.value});document.getElementById('notice').textContent='Backlog lokaal opgeslagen.'}document.getElementById('save').onclick=save;document.getElementById('pick').onclick=()=>{const list=values();result.textContent=list.length?'Nu spelen: '+list[Math.floor(Math.random()*list.length)]:'Voeg eerst games toe.'};nexusStore.load().then(v=>{if(v&&v.games)games.value=v.games}).catch(()=>{});`
    })
  },
  {
    id: 'daily-goals', version: '1.0.0', name: 'Daily Goals', kind: 'widget', accent: '#f472b6', permissions: ['storage'], height: 430,
    description: 'Een rustige dagelijkse doelenlijst die automatisch met een nieuwe dag begint.',
    html: sandboxHtml({ title: 'Daily Goals', intro: 'Zet drie dingen klaar die vandaag echt tellen.', accent: '#f472b6', storage: true,
      body: `<section class="card stack"><form id="form" class="row"><input id="goal" class="grow" maxlength="80" placeholder="Nieuw doel" aria-label="Nieuw doel"><button class="primary">Toevoegen</button></form><div id="status" class="muted"></div><div id="list" class="list"></div></section>`,
      script: `const today=()=>new Date().toISOString().slice(0,10),list=document.getElementById('list');let state={date:today(),items:[]};async function save(){await nexusStore.save(state);draw()}function draw(){if(state.date!==today()){state={date:today(),items:[]};nexusStore.save(state)}list.replaceChildren(...state.items.map((item,i)=>{const row=document.createElement('label');row.className='item';const c=document.createElement('input');c.type='checkbox';c.style.width='auto';c.checked=item.done;c.onchange=()=>{state.items[i].done=c.checked;save()};const s=document.createElement('span');s.textContent=item.text;if(item.done)s.style.textDecoration='line-through';const b=document.createElement('button');b.type='button';b.textContent='×';b.onclick=()=>{state.items.splice(i,1);save()};row.append(c,s,b);return row}));const done=state.items.filter(x=>x.done).length;document.getElementById('status').textContent=done+' van '+state.items.length+' voltooid'}document.getElementById('form').onsubmit=e=>{e.preventDefault();const input=document.getElementById('goal'),text=input.value.trim();if(!text)return;state.items.push({text,done:false});input.value='';save()};nexusStore.load().then(v=>{if(v&&Array.isArray(v.items))state=v;draw()}).catch(()=>draw());draw();`
    })
  },
  {
    id: 'shortcut-companion', version: '1.0.0', name: 'Shortcut Companion', kind: 'tool', accent: '#60a5fa', permissions: [], height: 480,
    description: 'Doorzoekbare Windows-, browser- en gamebar-sneltoetsen binnen Nexus.',
    html: sandboxHtml({ title: 'Shortcut Companion', intro: 'Vind veelgebruikte toetsen zonder je sessie te verlaten.', accent: '#60a5fa',
      body: `<section class="card stack"><input id="search" placeholder="Zoek bijvoorbeeld screenshot" aria-label="Sneltoets zoeken"><div id="list" class="list"></div></section>`,
      script: `const shortcuts=[['Win + G','Xbox Game Bar'],['Win + Alt + R','Opname starten of stoppen'],['Win + Alt + Print Screen','Game screenshot'],['Win + Shift + S','Schermknipsel'],['Win + V','Klembordgeschiedenis'],['Win + Ctrl + D','Nieuw bureaublad'],['Win + Ctrl + ←/→','Wissel bureaublad'],['Alt + Tab','Wissel venster'],['Ctrl + Shift + Esc','Taakbeheer'],['Win + P','Projectiemodus'],['Ctrl + L','Adresbalk selecteren'],['Ctrl + Shift + T','Gesloten tab herstellen'],['F11','Volledig scherm'],['Win + .','Emoji-venster']];const list=document.getElementById('list');function draw(){const q=document.getElementById('search').value.toLowerCase();const rows=shortcuts.filter(x=>x.join(' ').toLowerCase().includes(q)).map(x=>{const row=document.createElement('div');row.className='item';const key=document.createElement('span');key.className='pill';key.textContent=x[0];const text=document.createElement('span');text.textContent=x[1];row.append(key,text);return row});list.replaceChildren(...rows)}document.getElementById('search').oninput=draw;draw();`
    })
  },
  {
    id: 'unit-converter', version: '1.0.0', name: 'Unit Converter', kind: 'tool', accent: '#2dd4bf', permissions: [], height: 450,
    description: 'Converteer lengte, gewicht en temperatuur direct en volledig lokaal.',
    html: sandboxHtml({ title: 'Unit Converter', intro: 'Snelle conversies voor dagelijks gebruik.', accent: '#2dd4bf',
      body: `<section class="card stack"><label>Categorie<select id="category"><option value="length">Lengte</option><option value="weight">Gewicht</option><option value="temperature">Temperatuur</option></select></label><div class="grid"><label>Waarde<input id="value" type="number" value="1" step="any"></label><label>Van<select id="from"></select></label><label>Naar<select id="to"></select></label></div><div id="result" class="result" aria-live="polite"></div></section>`,
      script: `const units={length:{m:1,km:1000,cm:.01,mm:.001,mi:1609.344,ft:.3048,in:.0254},weight:{kg:1,g:.001,lb:.45359237,oz:.0283495},temperature:{C:'C',F:'F',K:'K'}};const names={m:'meter',km:'kilometer',cm:'centimeter',mm:'millimeter',mi:'mile',ft:'foot',in:'inch',kg:'kilogram',g:'gram',lb:'pound',oz:'ounce',C:'Celsius',F:'Fahrenheit',K:'Kelvin'};const $=id=>document.getElementById(id);function options(){const keys=Object.keys(units[$('category').value]);for(const id of ['from','to'])$(id).replaceChildren(...keys.map(k=>{const o=document.createElement('option');o.value=k;o.textContent=names[k];return o}));$('to').selectedIndex=1;calc()}function calc(){const cat=$('category').value,from=$('from').value,to=$('to').value,value=Number($('value').value);let out;if(cat==='temperature'){let c=from==='C'?value:from==='F'?(value-32)*5/9:value-273.15;out=to==='C'?c:to==='F'?c*9/5+32:c+273.15}else out=value*units[cat][from]/units[cat][to];$('result').textContent=Number.isFinite(out)?value+' '+from+' = '+Number(out.toFixed(6))+' '+to:'Vul een geldige waarde in.'}for(const id of ['category','value','from','to'])$(id).oninput=id==='category'?options:calc;options();`
    })
  },
  {
    id: 'color-studio', version: '1.0.0', name: 'Color Studio', kind: 'tool', accent: '#ec4899', permissions: [], height: 460,
    description: 'Meng RGB-kleuren, bekijk HEX-waarden en stel een compact palet samen.',
    html: sandboxHtml({ title: 'Color Studio', intro: 'Maak snel een kleur voor je setup of thema.', accent: '#ec4899',
      body: `<section class="card stack"><div id="swatch" style="height:100px;border-radius:14px;border:1px solid var(--border)"></div><div class="grid"><label>R <input id="r" type="range" min="0" max="255" value="124"></label><label>G <input id="g" type="range" min="0" max="255" value="92"></label><label>B <input id="b" type="range" min="0" max="255" value="255"></label></div><div id="hex" class="result big" aria-live="polite">#7C5CFF</div><div class="row"><button data-preset="124,92,255">Nexus</button><button data-preset="0,229,255">Cyan</button><button data-preset="255,76,129">Pink</button><button data-preset="54,211,153">Mint</button></div></section>`,
      script: `const $=id=>document.getElementById(id);function draw(){const rgb=['r','g','b'].map(id=>Number($(id).value)),hex='#'+rgb.map(n=>n.toString(16).padStart(2,'0')).join('').toUpperCase();$('swatch').style.background=hex;$('hex').textContent=hex}for(const id of ['r','g','b'])$(id).oninput=draw;document.querySelectorAll('[data-preset]').forEach(b=>b.onclick=()=>{b.dataset.preset.split(',').forEach((v,i)=>$( ['r','g','b'][i]).value=v);draw()});draw();`
    })
  },
  {
    id: 'password-generator', version: '1.0.0', name: 'Password Generator', kind: 'tool', accent: '#f59e0b', permissions: [], height: 440,
    description: 'Genereer sterke wachtwoorden lokaal met instelbare lengte en tekensets.',
    html: sandboxHtml({ title: 'Password Generator', intro: 'De gegenereerde waarde verlaat deze addon niet.', accent: '#f59e0b',
      body: `<section class="card stack"><label>Lengte <input id="length" type="range" min="12" max="64" value="24"><span id="lengthText">24 tekens</span></label><div class="row"><label><span><input id="upper" type="checkbox" checked style="width:auto"> Hoofdletters</span></label><label><span><input id="symbols" type="checkbox" checked style="width:auto"> Symbolen</span></label></div><input id="password" readonly aria-label="Gegenereerd wachtwoord"><button id="generate" class="primary">Nieuw wachtwoord</button><div id="strength" class="muted"></div></section>`,
      script: `const $=id=>document.getElementById(id);function rand(max){const a=new Uint32Array(1);crypto.getRandomValues(a);return a[0]%max}function generate(){let chars='abcdefghijkmnopqrstuvwxyz23456789';if($('upper').checked)chars+='ABCDEFGHJKLMNPQRSTUVWXYZ';if($('symbols').checked)chars+='!@#$%&*+-=?';let out='';for(let i=0;i<Number($('length').value);i++)out+=chars[rand(chars.length)];$('password').value=out;$('strength').textContent='Entropie-indicatie: ongeveer '+Math.floor(out.length*Math.log2(chars.length))+' bits'}$('length').oninput=()=>{$('lengthText').textContent=$('length').value+' tekens';generate()};$('upper').onchange=generate;$('symbols').onchange=generate;$('generate').onclick=generate;generate();`
    })
  },
  {
    id: 'game-session-counter', version: '1.0.0', name: 'Game Session Counter', kind: 'widget', accent: '#fb7185', permissions: ['storage'], height: 370,
    description: 'Tel wins, losses of runs tijdens een gamesessie en bewaar de stand lokaal.',
    html: sandboxHtml({ title: 'Game Session Counter', intro: 'Een flexibele teller voor ranked, speedruns of pogingen.', accent: '#fb7185', storage: true,
      body: `<section class="card stack"><label>Naam teller<input id="label" maxlength="40" value="Wins"></label><div id="count" class="big">0</div><div class="row"><button id="minus">− 1</button><button id="plus" class="primary">+ 1</button><button id="reset">Reset</button></div></section>`,
      script: `const $=id=>document.getElementById(id);let state={label:'Wins',count:0};function draw(){$('label').value=state.label;$('count').textContent=state.count}function save(){nexusStore.save(state).then(draw)}$('label').onchange=()=>{state.label=$('label').value.trim()||'Teller';save()};$('plus').onclick=()=>{state.count++;save()};$('minus').onclick=()=>{state.count--;save()};$('reset').onclick=()=>{state.count=0;save()};nexusStore.load().then(v=>{if(v&&Number.isFinite(v.count))state=v;draw()}).catch(()=>draw());draw();`
    })
  },
  {
    id: 'loot-tracker', version: '1.0.0', name: 'Loot Tracker', kind: 'tool', accent: '#fbbf24', permissions: ['storage'], height: 450,
    description: 'Noteer drops en aantallen per sessie met lokale, compacte opslag.',
    html: sandboxHtml({ title: 'Loot Tracker', intro: 'Houd materialen, drops en collectibles overzichtelijk bij.', accent: '#fbbf24', storage: true,
      body: `<section class="card stack"><form id="form" class="row"><input id="item" class="grow" maxlength="60" placeholder="Item of materiaal" aria-label="Item"><input id="quantity" type="number" value="1" min="1" max="99999" style="width:90px" aria-label="Aantal"><button class="primary">Voeg toe</button></form><div id="list" class="list"></div><button id="clear">Nieuwe sessie</button></section>`,
      script: `const list=document.getElementById('list');let items=[];function save(){nexusStore.save({items}).then(draw)}function draw(){list.replaceChildren(...items.map((item,i)=>{const row=document.createElement('div');row.className='item';const name=document.createElement('span');name.textContent=item.name;const qty=document.createElement('strong');qty.textContent='× '+item.quantity;const plus=document.createElement('button');plus.textContent='+';plus.onclick=()=>{items[i].quantity++;save()};const del=document.createElement('button');del.textContent='×';del.onclick=()=>{items.splice(i,1);save()};row.append(name,qty,plus,del);return row}))}document.getElementById('form').onsubmit=e=>{e.preventDefault();const input=document.getElementById('item'),name=input.value.trim();if(!name)return;const existing=items.find(x=>x.name.toLowerCase()===name.toLowerCase()),quantity=Math.max(1,Number(document.getElementById('quantity').value)||1);existing?existing.quantity+=quantity:items.push({name,quantity});input.value='';save()};document.getElementById('clear').onclick=()=>{items=[];save()};nexusStore.load().then(v=>{items=Array.isArray(v&&v.items)?v.items:[];draw()}).catch(()=>draw());draw();`
    })
  },
  {
    id: 'match-scoreboard', version: '1.0.0', name: 'Match Scoreboard', kind: 'widget', accent: '#22c55e', permissions: ['storage'], height: 450,
    description: 'Een lokaal scorebord voor twee spelers of teams met snelle bediening.',
    html: sandboxHtml({ title: 'Match Scoreboard', intro: 'Voor lokale matches, toernooien en game nights.', accent: '#22c55e', storage: true,
      body: `<section class="card stack"><div class="grid"><div class="metric stack"><input id="nameA" value="Team A" maxlength="30" aria-label="Naam team A"><div id="scoreA" class="big">0</div><div class="row"><button data-team="a" data-delta="-1">−</button><button class="primary" data-team="a" data-delta="1">+</button></div></div><div class="metric stack"><input id="nameB" value="Team B" maxlength="30" aria-label="Naam team B"><div id="scoreB" class="big">0</div><div class="row"><button data-team="b" data-delta="-1">−</button><button class="primary" data-team="b" data-delta="1">+</button></div></div></div><button id="reset">Nieuwe wedstrijd</button></section>`,
      script: `const $=id=>document.getElementById(id);let state={nameA:'Team A',nameB:'Team B',a:0,b:0};function draw(){$('nameA').value=state.nameA;$('nameB').value=state.nameB;$('scoreA').textContent=state.a;$('scoreB').textContent=state.b}function save(){nexusStore.save(state).then(draw)}document.querySelectorAll('[data-team]').forEach(b=>b.onclick=()=>{const key=b.dataset.team;state[key]=Math.max(0,state[key]+Number(b.dataset.delta));save()});for(const key of ['nameA','nameB'])$(key).onchange=()=>{state[key]=$(key).value.trim()||key;save()};$('reset').onclick=()=>{state.a=0;state.b=0;save()};nexusStore.load().then(v=>{if(v&&Number.isFinite(v.a))state=v;draw()}).catch(()=>draw());draw();`
    })
  }
];

const webApps = [
  ['youtube', 'YouTube', 'Video, muziek en livecontent openen in een apart Nexus-venster.', '#ff0033', 'https://www.youtube.com/'],
  ['reddit', 'Reddit', 'Communities en discussies openen in een apart Nexus-venster.', '#ff5700', 'https://www.reddit.com/'],
  ['soundcloud', 'SoundCloud', 'Muziek, mixes en podcasts openen in een apart Nexus-venster.', '#ff5500', 'https://soundcloud.com/'],
  ['steam-store', 'Steam Store', 'De Steam-winkel en community openen zonder je dashboard te verlaten.', '#66c0f4', 'https://store.steampowered.com/'],
  ['github', 'GitHub', 'Repositories, issues en releases openen in een apart Nexus-venster.', '#8b5cf6', 'https://github.com/']
];

const themes = [
  ['cyberpunk-neon', 'Cyberpunk Neon', 'Fel cyaan en magenta op een diepe nachtbasis.', { accent: '#00e5ff', background: '#070812', panel: '#151126', text: '#f7f4ff', muted: '#aaa4c4' }],
  ['nord-frost', 'Nord Frost', 'Koele blauwtinten met rustig, helder contrast.', { accent: '#88c0d0', background: '#242933', panel: '#303846', text: '#eceff4', muted: '#aeb8c8' }],
  ['solar-flare', 'Solar Flare', 'Warm oranje met donker grafiet voor een energieke setup.', { accent: '#ff8a1f', background: '#140d09', panel: '#261711', text: '#fff4e8', muted: '#c5a994' }],
  ['matrix-terminal', 'Matrix Terminal', 'Helder terminalgroen op bijna zwart.', { accent: '#35e46b', background: '#030805', panel: '#0a170e', text: '#dcffe6', muted: '#78a987' }],
  ['crimson-night', 'Crimson Night', 'Diep rood met antraciet en zacht wit.', { accent: '#ef445d', background: '#10080b', panel: '#211116', text: '#fff1f3', muted: '#bc969f' }],
  ['arctic-glass', 'Arctic Glass', 'Fris ijsblauw met lichte, glazen panelen.', { accent: '#38bdf8', background: '#0c1722', panel: '#172938', text: '#effaff', muted: '#9cb7c8' }],
  ['royal-purple', 'Royal Purple', 'Verzadigd paars met een luxe donkere basis.', { accent: '#a855f7', background: '#0e0817', panel: '#20102f', text: '#fbf5ff', muted: '#b8a0c8' }],
  ['forest-night', 'Forest Night', 'Rustig groen en moskleurige panelen.', { accent: '#4ade80', background: '#07100b', panel: '#122219', text: '#effff4', muted: '#96b5a0' }],
  ['monochrome-pro', 'Monochrome Pro', 'Minimalistisch zwart, grafiet en helder wit.', { accent: '#d4d4d8', background: '#09090b', panel: '#18181b', text: '#fafafa', muted: '#a1a1aa' }],
  ['sakura-night', 'Sakura Night', 'Zacht roze op nachtblauw met een warme gloed.', { accent: '#ff7eb6', background: '#100d1a', panel: '#21182e', text: '#fff3fa', muted: '#baa7bd' }]
];

for (const item of packages) {
  const target = path.join(root, 'packages', item.id, `${item.version}.nexus.json`);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify({
    schema: 1,
    id: item.id,
    version: item.version,
    minNexus: '1.4.0',
    name: item.name,
    description: item.description,
    author: 'Nexus Hub',
    kind: item.kind,
    accent: item.accent,
    permissions: item.permissions,
    content: { type: 'sandbox', height: item.height, html: item.html }
  }, null, 2)}\n`, 'utf8');
}

for (const [id, name, description, accent, url] of webApps) {
  const version = '1.0.0';
  const target = path.join(root, 'packages', id, `${version}.nexus.json`);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify({ schema: 1, id, version, minNexus: '1.4.0', name, description, author: 'Nexus Hub', kind: 'app', accent, permissions: ['web'], content: { type: 'web', url } }, null, 2)}\n`, 'utf8');
}

for (const [id, name, description, palette] of themes) {
  const version = '1.0.0';
  const target = path.join(root, 'packages', id, `${version}.nexus.json`);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify({ schema: 1, id, version, minNexus: '1.4.0', name, description, author: 'Nexus Hub', kind: 'theme', accent: palette.accent, permissions: [], content: { type: 'theme', palette } }, null, 2)}\n`, 'utf8');
}

console.log(`Generated ${packages.length + webApps.length + themes.length} Nexus Store packages.`);
