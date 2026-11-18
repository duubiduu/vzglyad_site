'use strict';
const KEY = 'vzglyad-artworks-v2';
const LEGACY_KEY = 'vzglyad-circe-v1';
const artworks = window.VZGLYAD_ARTWORKS;
const app = document.getElementById('app');
const blank = id => ({step:0, impression:'', point:null, detail:artworks[id].defaultDetail, after:'', note:'', completed:false, savedAt:null, viewed:[], started:false});
let sessions = Object.fromEntries(Object.keys(artworks).map(id => [id, blank(id)]));
let activeId = 'marriage';
let persistence = true;
function normalize(saved, id) {
  const s = {...blank(id), ...(saved && typeof saved === 'object' ? saved : {})};
  s.step = Math.max(0, Math.min(4, Math.trunc(Number(s.step) || 0)));
  s.note = String(s.note || '').slice(0,600);
  s.impression = String(s.impression || '');
  s.after = String(s.after || '');
  s.completed = s.completed === true;
  s.started = s.started === true;
  if (!artworks[id].regionOrder.includes(s.detail)) s.detail = artworks[id].defaultDetail;
  s.viewed = Array.isArray(s.viewed) ? s.viewed.filter(k => artworks[id].regionOrder.includes(k)) : [];
  if (s.point && Number.isFinite(s.point.x) && Number.isFinite(s.point.y)) {
    s.point = {x:Math.max(0,Math.min(100,s.point.x)), y:Math.max(0,Math.min(100,s.point.y)), region:artworks[id].regions[s.point.region] ? s.point.region : 'own'};
  } else s.point = null;
  if (s.savedAt && !Number.isFinite(Date.parse(s.savedAt))) s.savedAt = null;
  return s;
}
try {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (_) {}
  if (saved && typeof saved === 'object' && saved.sessions && typeof saved.sessions === 'object') {
    for (const id of Object.keys(artworks)) sessions[id] = normalize(saved.sessions[id], id);
    if (artworks[saved.activeId]) activeId = saved.activeId;
  } else {
    let legacy = null;
    try { legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) || 'null'); } catch (_) {}
    if (legacy) sessions.circe = normalize(legacy, 'circe');
  }
} catch (_) { persistence = false; }
// A link from the diary bot can select a painting without changing saved sessions.
const linkedArtwork = new URLSearchParams(window.location.search).get('artwork');
if (linkedArtwork && Object.prototype.hasOwnProperty.call(artworks, linkedArtwork)) {
  activeId = linkedArtwork;
}
let state = sessions[activeId];
let view = 'home';
let showHints = false;
let toastTimer;
const e = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const afters = ['Впечатление изменилось','Стало понятнее и подробнее','Почти не изменилось'];
const steps = ['Первое впечатление','Своё наблюдение','История картины','Новый взгляд','Моё открытие'];
const work = () => artworks[activeId];
const regions = () => work().regions;
function persist() {
  sessions[activeId] = state;
  try { localStorage.setItem(KEY, JSON.stringify({activeId,sessions})); return true; }
  catch (_) { persistence = false; return false; }
}
function activate(id) {
  if (!artworks[id]) return;
  sessions[activeId] = state;
  activeId = id;
  state = sessions[id];
  showHints = false;
  persist();
}
function toast(text) {
  const el = document.getElementById('toast');
  el.textContent = text;
  el.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>el.classList.remove('visible'),3300);
}
function primary(text, action='next') {
  return `<button class="primary wide" data-action="${action}">${text}<span class="arrow" aria-hidden="true">→</span></button>`;
}
function regionKey(p) { return p && regions()[p.region] ? p.region : 'own'; }
function chips(action, selected) {
  return work().regionOrder.map(k=>`<button class="detail-chip ${selected===k?'selected':''}" data-action="${action}" data-value="${k}" aria-pressed="${selected===k}">${e(regions()[k].label)}</button>`).join('');
}
function gallery() {
  const w = work();
  const active = view==='session' && state.step===1;
  const explore = view==='session' && state.step===3;
  const point = active ? state.point : explore ? regions()[state.detail] : view==='complete' ? state.point : null;
  const marker = point ? `<span class="marker" style="--x:${Number(point.x)};--y:${Number(point.y)}" aria-hidden="true"></span>` : '';
  const hints = active && showHints ? w.regionOrder.map((key,i)=>{
    const r=regions()[key];
    return `<button class="hint-dot" data-action="region" data-value="${key}" style="left:${r.x}%;top:${r.y}%" aria-label="Выбрать: ${e(r.label)}">${i+1}</button>`;
  }).join('') : '';
  let hint='Одна картина. Столько способов увидеть.';
  if(active) hint=state.point?'Ваша точка внимания. Её можно изменить.':'Коснитесь детали, которая привлекла внимание.';
  if(explore) hint='Выберите, что хочется рассмотреть ещё раз.';
  if(view==='session'&&state.step===2) hint='Посмотрите на картину, пока узнаёте её историю.';
  return `<section class="gallery" aria-label="Картина целиком"><div class="gallery-top"><span class="eyebrow">${e(w.artist)} · ${w.year}</span><span class="gallery-number">№ ${w.number}</span></div><div class="artwork" style="--art-ratio:${w.width/w.height}"><img src="${w.image}" alt="${e(w.alt)}" width="${w.width}" height="${w.height}"><button class="art-target" aria-label="Отметить деталь на картине. Также можно выбрать её кнопками под вопросом." ${active?'':'disabled'} data-action="mark"></button>${marker}${hints}</div><p class="art-hint">${hint}</p><div class="art-caption"><strong>${e(w.title)}</strong><span>${e(w.museum)}</span></div></section>`;
}
function selector() {
  return `<section class="work-selector" aria-label="Выбор картины"><span class="eyebrow">Выберите картину</span><div class="work-options">${['marriage','circe','folies','moving','nepushchu'].map(id=>{
    const w=artworks[id];
    return `<button class="work-option ${activeId===id?'selected':''}" data-action="choose-work" data-value="${id}" aria-pressed="${activeId===id}"><img src="${w.image}" alt="" width="44" height="56"><span><span class="work-option-title">${e(w.title)}</span><span class="work-option-meta">${e(w.shortArtist)} · ${w.year}${sessions[id].completed?' · Сохранено':''}</span></span><span class="work-option-mark" aria-hidden="true">${activeId===id?'✓':'→'}</span></button>`;
  }).join('')}</div></section>`;
}
function home() {
  const w=work();
  const resume=state.started&&!state.completed;
  return `${selector()}<div class="experience home fade-in">${gallery()}<section class="panel"><div class="pill"><span class="tiny-dot"></span>Одна встреча с искусством · 3–5 минут</div><h1>Одна картина.<br><em>Чуть глубже.</em></h1><p class="lead">Посмотрите своим взглядом. Узнайте историю. Заметьте то, что ускользнуло в первый раз.</p><div class="work-title"><h2>${e(w.hook)}</h2><p>${e(w.hookSubtitle)}</p></div>${primary(resume?'Продолжить знакомство':state.completed?'Рассмотреть ещё раз':'Познакомиться с картиной','start')}<p class="home-note">Без подготовки. В своём темпе.</p>${resume?'<button class="quiet" data-action="restart">Начать заново</button>':''}<div class="home-sequence"><span><b>01</b> Заметить</span><i></i><span><b>02</b> Узнать</span><i></i><span><b>03</b> Увидеть иначе</span></div></section></div>`;
}
function choiceList(items, selected, action) {
  return `<div class="choices" role="group" aria-label="${action==='impression'?'Первое впечатление':'Изменение впечатления'}">${items.map(v=>`<button class="choice ${selected===v?'selected':''}" aria-pressed="${selected===v}" data-action="${action}" data-value="${e(v)}"><span>${e(v)}</span><span class="radio" aria-hidden="true"></span></button>`).join('')}</div>`;
}
function actions(main, skipText) {return `<div class="panel-actions">${main}${skipText?`<button class="quiet" data-action="skip">${skipText}</button>`:''}</div>`;}
function facts() {
  if(!work().facts.length)return '';
  return `<div class="facts"><span class="eyebrow">Ещё о картине · по желанию</span>${work().facts.map(f=>`<details class="fact"><summary>${e(f.title)}</summary><p>${e(f.text)}</p><a class="source-link" href="${f.source}" target="_blank" rel="noopener">Материалы галереи ↗</a></details>`).join('')}</div>`;
}
function sessionContent() {
  const w=work();
  if(state.step===0) return `<h1>Какое впечатление<br>производит сцена?</h1><p class="lead">Дайте себе немного времени посмотреть. Можно начать с ощущения.</p>${choiceList(w.impressions,state.impression,'impression')}<p class="reassurance"><svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6"/><path d="M8 7v4M8 4.5v1"/></svg>Здесь нет правильного впечатления.</p>${actions(primary('Рассмотреть внимательнее'),!state.impression?'Пока просто посмотрю':null)}`;
  if(state.step===1) {
    const key=regionKey(state.point);
    return `<h1>Что привлекло<br>ваше внимание?</h1><p class="lead">Отметьте любую деталь на картине. Или выберите область ниже — писать ничего не нужно.</p><div class="detail-picker" role="group" aria-label="Выбрать деталь">${chips('region',state.point?key:null)}</div>${state.point?`<div class="point-preview" aria-live="polite"><span class="eyebrow">${e(regions()[key].label)}</span><p>${e(regions()[key].observation)}</p></div>`:`<button class="help" data-action="hints"><span aria-hidden="true">＋</span>${showHints?'Скрыть подсказки на картине':'Помоги рассмотреть'}</button><div class="point-preview"><span class="eyebrow">Небольшая подсказка</span><p>${e(w.lookHint)}</p></div>`}${actions(primary('Узнать, что происходит'),'Сразу к истории')}`;
  }
  if(state.step===2) return `<h1>${w.storyTitle}</h1><div class="story-label"><span class="eyebrow">${e(w.storyLabel)}</span><span class="small">~ 40 секунд</span></div><div class="story">${w.story.map(p=>`<p>${p}</p>`).join('')}</div><p class="story-aside">${e(w.storyAside)}</p><a class="source-link" href="${w.sourceUrl}" target="_blank" rel="noopener">По материалам музея · ${e(w.sourceName)} ↗</a>${facts()}${actions(primary('Посмотреть новым взглядом'))}`;
  if(state.step===3) {
    const r=regions()[state.detail];
    return `<h1>Теперь вы знаете<br>историю. А что видите?</h1><p class="lead">Выберите одну деталь для небольшого разбора. Можно исследовать все три.</p><div class="detail-picker" role="group" aria-label="Выбрать разбор">${chips('detail',state.detail)}</div><div class="detail-content" aria-live="polite"><span class="eyebrow">${e(r.kind||(state.detail==='water'?'Музейная интерпретация':'Присмотритесь'))}</span><h2>${e(r.title)}</h2><p>${e(r.text)}</p><p class="question">${e(r.question)}</p></div>${actions(primary('Сохранить своё открытие'))}`;
  }
  return `<h1>Что изменилось<br>в вашем взгляде?</h1>${state.impression?`<div class="compare"><span>Первое впечатление</span><span aria-hidden="true">→</span><strong>${e(state.impression)}</strong></div>`:'<p class="lead">Сравните то, что увидели сначала, с тем, что замечаете сейчас.</p>'}${choiceList(afters,state.after,'after')}<label class="note-label" for="note">Что хочется запомнить? <span>Необязательно</span></label><textarea id="note" maxlength="600" placeholder="${e(w.notePlaceholder)}">${e(state.note)}</textarea><div class="note-bottom"><span>Только для вас</span><span id="char-count">${state.note.length} / 600</span></div>${actions(primary(state.completed?'Обновить моё открытие':'Сохранить в «Мои открытия»','save'))}`;
}
function session() {
  return `<div class="experience session fade-in">${gallery()}<section class="panel"><div class="step-top"><button class="back" data-action="back"><span aria-hidden="true">←</span>${state.step===0?'К выбору картины':'Назад'}</button><span>${state.step+1} из 5</span></div><div class="progress" role="progressbar" aria-label="Шаг сессии" aria-valuemin="1" aria-valuemax="5" aria-valuenow="${state.step+1}">${steps.map((_,i)=>`<i class="${i<=state.step?'done':''}"></i>`).join('')}</div><div class="step-label"><span class="num">0${state.step+1}</span><span class="eyebrow">${steps[state.step]}</span></div>${sessionContent()}</section></div>`;
}
function complete() {
  const w=work();
  return `<div class="experience complete fade-in">${gallery()}<section class="panel"><div class="complete-symbol" aria-hidden="true">✓</div><span class="eyebrow" style="color:var(--gold);margin-bottom:17px">Маленькое открытие</span><h1>Теперь вы знакомы<br>чуть ближе.</h1><p class="lead" style="margin-top:21px">У картины появилась история.<br>А у вас — собственное наблюдение.</p><div class="complete-summary"><div class="eyebrow">${persistence?'Сохранено в ваших открытиях':'Открытие этой сессии'}</div><p>${e(w.title)} · ${e(w.shortArtist)}</p>${state.after?`<p style="margin-top:7px">${e(state.after)}</p>`:''}${state.note?`<blockquote>${e(state.note)}</blockquote>`:''}</div><div class="panel-actions">${primary('Перейти к моим открытиям','collection')}<button class="quiet" data-action="home">Выбрать другую картину</button><button class="quiet" data-action="review">Ещё немного побыть с картиной</button></div><p class="home-note">${persistence?'Ваш взгляд сохранён в этом браузере.':'Хранилище браузера недоступно. Сохранение действует до закрытия страницы.'}</p></section></div>`;
}
function collection() {
  const saved=Object.keys(artworks).filter(id=>sessions[id].completed).sort((a,b)=>(Date.parse(sessions[b].savedAt)||0)-(Date.parse(sessions[a].savedAt)||0));
  const cards=saved.map(id=>{
    const w=artworks[id],s=sessions[id];
    const date=s.savedAt?new Date(s.savedAt).toLocaleDateString('ru-RU',{day:'numeric',month:'long'}):'Моё открытие';
    return `<article class="collection-card"><div class="collection-art"><img src="${w.image}" alt="${e(w.title)} — картина целиком"></div><div class="collection-content"><span class="eyebrow">${e(date)}</span><h2>${e(w.title)}</h2><p>${e(w.artist)} · ${w.year}</p>${s.note?`<blockquote>${e(s.note)}</blockquote>`:`<p style="margin-top:20px">${e(s.after||'Своё впечатление можно добавить позже.')}</p>`}<div class="collection-actions"><button class="quiet" data-action="review" data-work="${id}">Вернуться к картине ↗</button><button class="quiet" data-action="edit" data-work="${id}">${s.note?'Изменить заметку':'Добавить заметку'}</button></div></div></article>`;
  }).join('');
  return `<section class="collection fade-in"><span class="eyebrow" style="color:var(--gold)">Личная коллекция</span><h1>Мои открытия</h1><p class="lead">Картины, с которыми вы познакомились.<br>И то, что увидели в них именно вы.</p>${saved.length?`${cards}<p class="local-note">${persistence?'Сохранено только в этом браузере. Ваши заметки видны только вам.':'Доступно до закрытия страницы: хранилище браузера недоступно.'}</p>`:`<div class="empty-state"><div class="empty-mark" aria-hidden="true">✳</div><p>Здесь появится ваша первая картина. Начните с нескольких минут внимательного взгляда.</p>${primary('Выбрать картину','home')}</div>`}</section>`;
}
function renderSources() {
  const w=work();
  document.getElementById('sources-dialog').innerHTML=`<div class="dialog-top"><span class="eyebrow">О ПРОЕКТЕ</span><button class="icon-button" data-action="close-dialog" aria-label="Закрыть">×</button></div><h2 id="sources-title">У каждого взгляда<br>есть отправная точка.</h2><p>«Взгляд» — прототип коротких встреч с искусством. Рассмотрите картину, узнайте её историю и сохраните то, что заметили.</p><div class="source-work"><span class="eyebrow">КАРТИНА В ЭТОЙ СЕССИИ</span><h3>${e(w.title)}</h3><p>${e(w.artist)} · ${w.year}<br>${e(w.medium)}<br>${e(w.museum)}</p></div><p class="small">${e(w.about)}</p>${w.imageCredit?`<p class="small image-credit">${e(w.imageCredit)} <a href="${w.imageLicenseUrl}" target="_blank" rel="noopener">${e(w.imageLicenseLabel)}</a></p>`:''}<ul class="source-links">${w.sources.map(s=>`<li><a href="${s.url}" target="_blank" rel="noopener">${e(s.label)} <span>↗</span></a></li>`).join('')}</ul><p class="small">Сюжет основан на музейных материалах. Впечатления и прочтения могут различаться. Ваши ответы хранятся только в этом браузере.</p>`;
}
function render(focus=false) {
  const previouslyFocused=document.activeElement;
  const focusAction=previouslyFocused?.dataset?.action;
  const focusValue=previouslyFocused?.dataset?.value;
  app.innerHTML=view==='home'?home():view==='collection'?collection():view==='complete'?complete():session();
  document.getElementById('nav-today').classList.toggle('active',view!=='collection');
  document.getElementById('nav-collection').classList.toggle('active',view==='collection');
  document.getElementById('nav-today').setAttribute('aria-current',view!=='collection'?'page':'false');
  document.getElementById('nav-collection').setAttribute('aria-current',view==='collection'?'page':'false');
  const count=Object.values(sessions).filter(s=>s.completed).length;
  document.getElementById('saved-count').hidden=count===0;
  document.getElementById('saved-count').textContent=count;
  if(focus) {
    const heading=app.querySelector('h1');
    if(heading) { heading.tabIndex=-1;heading.focus({preventScroll:true}); }
    scrollTo({top:0,behavior:'auto'});
  } else if(focusAction) {
    const match=[...app.querySelectorAll('[data-action]')].find(el=>el.dataset.action===focusAction&&el.dataset.value===focusValue);
    match?.focus({preventScroll:true});
  }
}
function gotoStep(step) {
  state.step=Math.max(0,Math.min(4,step));state.started=true;view='session';
  if(state.step===3&&!state.viewed.includes(state.detail))state.viewed.push(state.detail);
  persist();render(true);
}
function selectRegion(key) {
  const r=regions()[key];if(!r)return;
  state.point={x:r.x,y:r.y,region:key};persist();render();
}
function onAction(event) {
  const el=event.target.closest('[data-action]');if(!el)return;
  const action=el.dataset.action,value=el.dataset.value;
  if(action==='sources'){renderSources();document.getElementById('sources-dialog').showModal();return;}
  if(action==='close-dialog'){document.getElementById('sources-dialog').close();return;}
  if(action==='home'){view='home';render(true);return;}
  if(action==='collection'){view='collection';render(true);return;}
  if(action==='choose-work'){activate(value);view='home';render();return;}
  if(action==='start'){gotoStep(state.completed?3:state.started?state.step:0);return;}
  if(action==='restart'){state=blank(activeId);showHints=false;gotoStep(0);return;}
  if(action==='back'){if(state.step===0){view='home';render(true);}else gotoStep(state.step-1);return;}
  if(action==='next'||action==='skip'){
    if(state.step===1&&state.point&&regionKey(state.point)!=='own')state.detail=regionKey(state.point);
    gotoStep(state.step+1);return;
  }
  if(action==='impression'){state.impression=value;persist();render();return;}
  if(action==='after'){state.after=value;persist();render();return;}
  if(action==='hints'){showHints=!showHints;render();return;}
  if(action==='region'){selectRegion(value);return;}
  if(action==='detail'){if(!work().regionOrder.includes(value))return;state.detail=value;if(!state.viewed.includes(value))state.viewed.push(value);persist();render();return;}
  if(action==='mark'){
    if(event.detail===0){showHints=true;render();app.querySelector('[data-action="region"]')?.focus();return;}
    const rect=el.getBoundingClientRect();
    const x=Math.max(0,Math.min(100,(event.clientX-rect.left)/rect.width*100));
    const y=Math.max(0,Math.min(100,(event.clientY-rect.top)/rect.height*100));
    let key='own',min=Infinity;
    for(const k of work().regionOrder){const r=regions()[k];const distance=Math.hypot(x-r.x,(y-r.y)*work().height/work().width);if(distance<19&&distance<min){key=k;min=distance;}}
    state.point={x,y,region:key};persist();render();return;
  }
  if(action==='save'){
    state.completed=true;state.savedAt=new Date().toISOString();const ok=persist();view='complete';render(true);
    toast(ok?'Ваше открытие сохранено':'Хранилище недоступно. Заметка останется до закрытия страницы.');return;
  }
  if(action==='review'){if(el.dataset.work)activate(el.dataset.work);gotoStep(3);return;}
  if(action==='edit'){if(el.dataset.work)activate(el.dataset.work);gotoStep(4);return;}
}
// Create the new record once, preserving legacy Circe notes and progress.
if(persistence)persist();
document.addEventListener('click',onAction);
document.addEventListener('input',event=>{
  if(event.target.id==='note'){state.note=event.target.value;document.getElementById('char-count').textContent=`${state.note.length} / 600`;persist();}
});
document.getElementById('sources-dialog').addEventListener('click',event=>{
  if(event.target===event.currentTarget){const r=event.currentTarget.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)event.currentTarget.close();}
});
render();
