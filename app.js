

let DATA = [];
let fuse = null;
let PHOTOS = {}; // { id: ["photos/<id>/a.jpg", ...] }
let BY_ID = {};  // { id: record }

const I18N = {
  ru: {
    found: (n, total) => `Найдено: ${n} / ${total}`,
    position: (id) => `Позиция #${id}`,
    notFound: "Позиция не найдена",
    noPhoto: "Фото не найдено",
    loadError: "Ошибка загрузки данных. Проверьте data.json",
    allSections: "Все разделы",
    onlyWithPhoto: "Только с фото",
    clear: "Очистить",
    howAddPhotos: "как добавить фото",
    howTitle: "Как добавить фото",
    close: "Закрыть",
    searchPlaceholder: "Поиск: номер / название / описание...",
    brandTitle: "4Runner 2003 4.7 Limited",
    brandSubtitle: "Поиск по номеру запчасти и по описанию",
    callBtn: "Позвонить +374 41 153113",
    waBtn: "WhatsApp",
    tgBtn: "Telegram",

    sortNumAsc: "№ по возрастанию",
    sortSecAsc: "Раздел A→Z",
    sortSecDesc: "Раздел Z→A",
    waBtn: "WhatsApp",
    tgBtn: "Telegram",

    sortNumAsc: "№ по возрастанию",
    sortSecAsc: "Раздел A→Z",
    sortSecDesc: "Раздел Z→A",

    // UI labels
    sectionLabel: "Раздел",
    categoryLabel: "Категория",
    catalogLabel: "Каталожное",
    partNoLabel: "№ детали",
    boxLabel: "коробка",
    photoCountLabel: "фото",
    damageBadge: "повреждения",
    tuningBadge: "тюнинг",
    photoBadge: "есть фото",
    damageLabel: "Повреждения",
    back: "Назад",
  },
  hy: {
    found: (n, total) => `Գտնվել է՝ ${n} / ${total}`,
    position: (id) => `Դիրք #${id}`,
    notFound: "Դիրքը չի գտնվել",
    noPhoto: "Լուսանկար չկա",
    loadError: "Տվյալների բեռնումը ձախողվեց. Ստուգեք data.json-ը",
    allSections: "Բոլոր բաժինները",
    onlyWithPhoto: "Միայն լուսանկարով",
    clear: "Մաքրել",
    howAddPhotos: "ինչպես ավելացնել լուսանկարներ",
    howTitle: "Ինչպես ավելացնել լուսանկարներ",
    close: "Փակել",
    searchPlaceholder: "Փնտրում՝ համար / անվանում / նկարագրություն...",
    brandTitle: "4Runner 2003 4.7 Limited",
    brandSubtitle: "Փնտրում՝ համարով ու նկարագրությամբ",
    callBtn: "Զանգել +374 41 153113",
    waBtn: "WhatsApp",
    tgBtn: "Telegram",

    sortNumAsc: "№ աճմամբ",
    sortSecAsc: "Բաժին A→Z",
    sortSecDesc: "Բաժին Z→A",
    waBtn: "WhatsApp",
    tgBtn: "Telegram",

    sortNumAsc: "Համար ↑",
    sortSecAsc: "Բաժին A→Z",
    sortSecDesc: "Բաժին Z→A",

    // UI labels
    sectionLabel: "Բաժին",
    categoryLabel: "Կատեգորիա",
    catalogLabel: "Կատալոգային",
    partNoLabel: "Դետալի №",
    boxLabel: "արկղ",
    photoCountLabel: "լուսանկար",
    damageBadge: "վնասվածք",
    tuningBadge: "թյունինգ",
    photoBadge: "կա ֆոտո",
    damageLabel: "Վնասվածքներ",
    back: "Վերադառնալ",
  }
};

let LANG = "ru";

// Lightweight placeholder (1x1 transparent gif) to support lazy image hydration.
const BLANK_IMG = "data:image/gif;base64,R0lGODlhAQABAAAAACwAAAAAAQABAAA=";

const UI_STATE_KEY = "toyo_parts_ui_state_v1";

function loadUiState(){
  try{ return JSON.parse(localStorage.getItem(UI_STATE_KEY) || "{}") || {}; }catch(e){ return {}; }
}
function saveUiState(state){
  try{ localStorage.setItem(UI_STATE_KEY, JSON.stringify(state || {})); }catch(e){}
}

// Compute site root so the app works on GitHub Pages subpaths like /toyo-parts/
// and still fetches data.json correctly even when opened at /part/<id>.
function siteRoot(){
  const p = window.location.pathname || "/";
  const i = p.indexOf("/part/");
  if(i >= 0){
    return p.slice(0, i) + "/";
  }
  const lastSlash = p.lastIndexOf("/");
  if(lastSlash >= 0) return p.slice(0, lastSlash + 1);
  return "/";
}

const ROOT = siteRoot();
function url(rel){
  return ROOT + String(rel || "").replace(/^\/+/, "");
}

const $ = (id) => document.getElementById(id);


function langFromStorageOrQuery(){
  try{
    const sp = new URLSearchParams(window.location.search || "");
    const q = (sp.get("lang") || "").toLowerCase();
    if(q === "ru" || q === "hy") return q;
  }catch(e){}
  try{
    const s = (localStorage.getItem("lang") || "").toLowerCase();
    if(s === "ru" || s === "hy") return s;
  }catch(e){}
  return "ru";
}

function setLang(next){
  LANG = (next === "hy") ? "hy" : "ru";
  try{ localStorage.setItem("lang", LANG); }catch(e){}
  // keep routes in English; store lang as query param (no /hy prefix => no 404)
  try{
    const u = new URL(window.location.href);
    u.searchParams.set("lang", LANG);
    history.replaceState({}, "", u.toString());
  }catch(e){}
}

// Use hash-based routes so deep links work on GitHub Pages (static hosting).
// Example: https://.../toyo-parts/#/part/258
function partHref(id){
  return `#/part/${encodeURIComponent(String(id))}`;
}

function switchLanguage(){
  const next = (LANG === "ru") ? "hy" : "ru";
  setLang(next);
  applyI18n();
  // Rebuild section options so their labels match the current language.
  if(Array.isArray(DATA) && DATA.length){
    buildSections(DATA);
  }
  handleRoute();
}
function applyI18n(){
  const dict = I18N[LANG] || I18N.ru;

  // Update <html lang="..."> for accessibility/SEO
  try{ document.documentElement.lang = LANG; }catch(e){}

  // Placeholder
  const q = $("q");
  if(q) q.placeholder = dict.searchPlaceholder;

  // Brand text
  const bt = $("brandTitle");
  const bs = $("brandSubtitle");
  if(bt) bt.textContent = dict.brandTitle;
  if(bs) bs.textContent = dict.brandSubtitle;

  // Call button label
  const cb = $("callBtn");
  if(cb) cb.textContent = dict.callBtn;

  // Static labels via data-i18n
  document.querySelectorAll("[data-i18n]").forEach(el=>{
    const key = el.getAttribute("data-i18n");
    if(dict[key]) el.textContent = dict[key];
  });

  // Option label for all sections
  const opt = document.querySelector('option[value=""][data-i18n="allSections"]');
  if(opt) opt.textContent = dict.allSections;

  // Checkbox label: we wrapped in span[data-i18n="onlyWithPhoto"]
  // Clear button already has data-i18n

  // Dialog title/button
  const howTitle = document.querySelector('[data-i18n="howTitle"]');
  if(howTitle) howTitle.textContent = dict.howTitle;
  const close = document.querySelector('[data-i18n="close"]');
  if(close) close.textContent = dict.close;

  // Footer link
  const how = $("how");
  if(how) how.textContent = dict.howAddPhotos;

  // Language button text
  const btn = $("langToggle");
  if(btn){
    btn.textContent = (LANG === "ru") ? "Հայ" : "RU";
    btn.title = (LANG === "ru") ? "Փոխել լեզուն" : "Сменить язык";
  }

  // If in /hy prefix, adjust call button? keep RU number label.

  // Refresh dynamic filter option labels (section list)
  if(Array.isArray(DATA) && DATA.length){
    buildSections(DATA);
  }
}

function getField(r, base){
  // Uses *_hy when LANG=hy (if non-empty), otherwise falls back to RU.
  if(LANG === "hy"){
    const hyKey = `${base}_hy`;
    const v = r?.[hyKey];
    if(v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return r?.[base];
}

function getFieldForLang(r, base, lang){
  // Same as getField but with explicit lang.
  if(lang === "hy"){
    const hyKey = `${base}_hy`;
    const v = r?.[hyKey];
    if(v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return r?.[base];
}

function truthyFlag(v){
  if(v === true) return true;
  if(v === false || v === null || v === undefined) return false;
  const s = String(v).trim().toLowerCase();
  if(!s) return false;
  if(["true","1","yes","y","да","есть"].includes(s)) return true;
  if(["false","0","no","n","нет"].includes(s)) return false;
  // any other non-empty string -> treat as true (e.g., "царапины")
  return true;
}


function normalizeStr(s){
  return (s ?? "").toString().trim();
}

async function loadPhotosIndex(){
  try{
    const res = await fetch(url("photos_index.json"));
    if(res.ok){
      PHOTOS = await res.json();
    }else{
      PHOTOS = {};
    }
  }catch(e){
    PHOTOS = {};
  }
}

function photosEntry(id){
  return PHOTOS?.[String(id)];
}
function imagesFullFor(id){
  const rec = BY_ID?.[String(id)];
  if(rec && Array.isArray(rec.images_full) && rec.images_full.length) return rec.images_full;
  const e = photosEntry(id);
  if(Array.isArray(e)) return e;
  if(e && Array.isArray(e.full)) return e.full;
  return [];
}
function imagesThumbFor(id){
  const rec = BY_ID?.[String(id)];
  if(rec && Array.isArray(rec.images_thumb) && rec.images_thumb.length) return rec.images_thumb;
  const e = photosEntry(id);
  if(e && Array.isArray(e.thumb)) return e.thumb;
  const full = imagesFullFor(id);
  return full.map(u => u.replace(/^photos\//, "photos_thumb/"));
}
function coverImageFor(id){
  const thumbs = imagesThumbFor(id);
  if(thumbs.length) return thumbs[0];
  const full = imagesFullFor(id);
  return full.length ? full[0] : null;
}


function buildSections(records){
  const sel = $("section");
  if(!sel) return;

  // Preserve current selection (value is RU key)
  const cur = normalizeStr(sel.value);

  // Clear all options except the first "all" option
  while(sel.options.length > 1) sel.remove(1);

  // Stable key = RU value. Label = localized (falls back to RU).
  const map = new Map(); // ru -> label
  for(const r of records){
    const ru = normalizeStr(r?.["Раздел"]);
    if(!ru) continue;
    if(!map.has(ru)){
      const label = normalizeStr(getFieldForLang(r, "Раздел", LANG)) || ru;
      map.set(ru, label);
    }
  }
  const items = Array.from(map.entries()).map(([ru,label])=>({ru,label}));
  const loc = (LANG === "hy") ? "hy" : "ru";
  items.sort((a,b)=>a.label.localeCompare(b.label, loc));

  for(const it of items){
    const opt = document.createElement("option");
    opt.value = it.ru;           // stable
    opt.textContent = it.label;  // localized
    sel.appendChild(opt);
  }

  // Restore previous selection if possible
  if(cur) sel.value = cur;
}


function cardHtml(r, imgUrl, opts){
  opts = opts || {};
  const dict = I18N[LANG] || I18N.ru;

  const num = r["Номер"] ?? "";
  const name = getField(r, "Название") ?? "";
  const pn = r["Номер запчасти"] ?? "";
  const sec = getField(r, "Раздел") ?? "";
  const cat = getField(r, "Детальная категория") ?? "";
  const catName = getField(r, "Каталожное название") ?? "";
  const desc = getField(r, "Описание") ?? "";
  const damaged = getField(r, "Есть повреждения");
  const tuning = r["Тюнинг"];
  const thumbs = (opts.detail) ? imagesThumbFor(r["_id"]) : [];
  const fulls = (opts.detail) ? imagesFullFor(r["_id"]) : [];

  const badges = [];
  if(truthyFlag(damaged)) badges.push(`<span class="badge warn">${escapeHtml(dict.damageBadge)}</span>`);
  if(truthyFlag(tuning)) badges.push(`<span class="badge good">${escapeHtml(dict.tuningBadge)}</span>`);
const kv = [];
  const imgs = imagesFullFor(r["_id"]);
  if(imgs.length) kv.push(`<span>${escapeHtml(dict.photoCountLabel)}: ${imgs.length}</span>`);
  if(pn) kv.push(`<span>${escapeHtml(dict.partNoLabel)}: ${escapeHtml(pn)}</span>`);

  // If damage field contains details (not just boolean), show it as a line
  const damagedStr = (damaged === true || damaged === false) ? "" : normalizeStr(damaged);
  const showDamageDetails = damagedStr && !["true","false","1","0","да","нет","есть"].includes(damagedStr.toLowerCase());

  const cls = opts.detail ? "card detail" : "card";
  const mainThumb = (opts.detail && thumbs && thumbs.length) ? thumbs[0] : imgUrl;
  const mainFull = (opts.detail && fulls && fulls.length) ? fulls[0] : (imagesFullFor(r["_id"])[0] || "");
  return `
  <article class="${cls}" data-id="${escapeHtml(r['_id'])}">
    <div class="img ${opts.detail ? 'zoom-wrap' : ''}">
      ${imgUrl ? `
        <img id="detailMain" class="pimg ${opts.detail ? 'detail-main' : 'is-thumb'}" loading="lazy" src="${BLANK_IMG}" data-src="${escapeHtml(mainThumb)}" data-full="${escapeHtml(mainFull)}" alt="${escapeHtml(name)}">
        ${opts.detail ? `<div id="zoomPane" class="zoom-pane" aria-hidden="true"></div>` : ``}
      ` : `<div>${escapeHtml(I18N[LANG].noPhoto)}</div>`}
      ${badges.length ? `<div class="badges">${badges.join("")}</div>` : ""}
    </div>
    ${opts.detail && (thumbs && thumbs.length) ? `<div class="thumbs">${thumbs.map((t,i)=>`<button class="thumb" type="button" data-idx="${i}" title="${i+1}"><img loading="lazy" src="${t}" alt="thumb ${i+1}"></button>`).join("")}</div>` : ""}
    <div class="body">
      <div class="hrow">
        <a class="name" href="${partHref(r['_id'])}">${escapeHtml(name)}</a>
        <div class="num">#${escapeHtml(num)}</div>
      </div>
      <div class="meta">
        ${sec ? `<div><b>${escapeHtml(dict.sectionLabel)}:</b> ${escapeHtml(sec)}</div>` : ""}
        ${cat ? `<div><b>${escapeHtml(dict.categoryLabel)}:</b> ${escapeHtml(cat)}</div>` : ""}
        ${catName ? `<div><b>${escapeHtml(dict.catalogLabel)}:</b> ${escapeHtml(catName)}</div>` : ""}
      </div>
      ${desc ? `<div class="desc">${escapeHtml(desc)}</div>` : ""}
      ${showDamageDetails ? `<div class="desc warnline"><b>${escapeHtml(dict.damageLabel)}:</b> ${escapeHtml(damagedStr)}</div>` : ""}
      ${kv.length ? `<div class="kv">${kv.join("")}</div>` : ""}
    </div>
  </article>
  `;
}

function escapeHtml(s){
  return (s ?? "").toString()
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function upsertMeta(selector, attrs){
  let el = document.querySelector(selector);
  if(!el){
    el = document.createElement("meta");
    if(attrs.name) el.setAttribute("name", attrs.name);
    if(attrs.property) el.setAttribute("property", attrs.property);
    document.head.appendChild(el);
  }
  if(attrs.content !== undefined) el.setAttribute("content", attrs.content);
}

function setPageMetaList(){
  const dict = I18N[LANG] || I18N.ru;
  const title = `${dict.brandTitle} — каталог запчастей`;
  const desc = dict.brandSubtitle || "Каталог запчастей";
  document.title = title;
  upsertMeta('meta[name="description"]', { name: "description", content: desc });
  upsertMeta('meta[property="og:title"]', { property: "og:title", content: title });
  upsertMeta('meta[property="og:description"]', { property: "og:description", content: desc });
  try{
    const u = new URL(window.location.href);
    u.searchParams.set("lang", LANG);
    upsertMeta('meta[property="og:url"]', { property: "og:url", content: u.toString() });
  }catch(e){}
}

function setPageMetaPart(rec){
  const dict = I18N[LANG] || I18N.ru;
  const id = rec?._id;
  const num = rec?.["Номер"] ?? id;
  const name = getField(rec, "Название") || "Запчасть";
  const sec = getField(rec, "Раздел") || "";
  const title = `#${num} — ${name}`;
  const desc = [sec, getField(rec, "Каталожное название"), getField(rec, "Описание")].filter(Boolean).join(" · ").slice(0, 180);
  document.title = title;
  upsertMeta('meta[name="description"]', { name: "description", content: desc || dict.brandSubtitle });
  upsertMeta('meta[property="og:title"]', { property: "og:title", content: title });
  upsertMeta('meta[property="og:description"]', { property: "og:description", content: desc || dict.brandSubtitle });
  const img = coverImageFor(id);
  if(img){
    const abs = (img.startsWith("http") ? img : (new URL(url(img), window.location.href)).toString());
    upsertMeta('meta[property="og:image"]', { property: "og:image", content: abs });
  }
  try{
    const u = new URL(window.location.href);
    u.searchParams.set("lang", LANG);
    upsertMeta('meta[property="og:url"]', { property: "og:url", content: u.toString() });
  }catch(e){}
}

async function render(records){
  const st = $("stats");
  if(st) { st.classList.remove("detail"); st.textContent = I18N[LANG].found(records.length, DATA.length); }
  const cards = $("cards");
  cards.innerHTML = "";
  for(const r of records){
    const id = r["_id"];
    const imgUrl = coverImageFor(id);
    const wrapper = document.createElement("div");
    wrapper.innerHTML = cardHtml(r, imgUrl);
    const el = wrapper.firstElementChild;
    cards.appendChild(el);
  }

  // Hover slideshow: on desktop, cycle through thumbnails while hovering the image.
  bindHoverSlides();

  // Hydrate lazy images (swap BLANK_IMG -> actual thumb) when they enter viewport.
  setupLazyImages();
}

function renderSkeletons(count){
  const cards = $("cards");
  if(!cards) return;
  cards.innerHTML = "";
  const n = Math.max(6, Math.min(24, count || 12));
  for(let i=0;i<n;i++){
    const d = document.createElement("div");
    d.className = "skeleton";
    d.innerHTML = `<div class="sk-img"></div><div class="sk-body"><div class="sk-line w70"></div><div class="sk-line w45"></div><div class="sk-line w90"></div></div>`;
    cards.appendChild(d);
  }
}

let _imgObserver = null;
function setupLazyImages(){
  if(!_imgObserver){
    _imgObserver = new IntersectionObserver((entries)=>{
      for(const e of entries){
        if(!e.isIntersecting) continue;
        const img = e.target;
        const src = img.getAttribute("data-src");
        if(src && img.getAttribute("src") !== src){
          img.src = src;
          img.addEventListener("load", ()=>{
            img.classList.remove("is-thumb");
            img.classList.add("is-full");
          }, { once: true });
        }
        _imgObserver.unobserve(img);
      }
    }, { rootMargin: "200px 0px" });
  }
  document.querySelectorAll('img[data-src]').forEach(img=>{
    // Only hydrate images still on placeholder
    if(img.getAttribute('src') === BLANK_IMG) _imgObserver.observe(img);
  });
}


function bindDetailThumbs(id){
  try{
    const card = document.querySelector('.card.detail[data-id="'+CSS.escape(String(id))+'"]');
    if(!card) return;
    const mainImg = card.querySelector('.img img');
    const thumbsWrap = card.querySelector('.thumbs');
    if(!mainImg) return;

    const thumbs = imagesThumbFor(id);
    const full = imagesFullFor(id);
    if(!thumbs.length && !full.length) return;

    const buttons = thumbsWrap ? thumbsWrap.querySelectorAll('button.thumb') : [];

    const activate = (i)=>{
      if(!buttons || !buttons.length) return;
      buttons.forEach(b=>b.classList.remove('active'));
      const btn = thumbsWrap.querySelector('button.thumb[data-idx="'+i+'"]');
      if(btn) btn.classList.add('active');
    };

    const setMain = (i)=>{
      const maxLen = Math.max(thumbs.length, full.length);
      if(maxLen <= 0) return;
      i = Math.max(0, Math.min(i, maxLen-1));

      const t = thumbs[i] || thumbs[0] || null;
      const f = full[i] || full[0] || null;
      const shown = t || f;
      if(shown) mainImg.src = shown;
      mainImg.dataset.idx = String(i);
      mainImg.dataset.full = f || "";

      // Preload full and swap when ready (keeps thumb visible while loading)
      if(f && shown && f !== shown){
        const probe = new Image();
        probe.decoding = 'async';
        probe.onload = ()=>{
          if(mainImg.dataset.idx === String(i)) mainImg.src = f;
        };
        probe.src = f;
      }

      // Preload the rest of full images in background (best effort)
      if(full && full.length){
        setTimeout(()=>{
          full.forEach((u,j)=>{
            if(!u || j===i) return;
            const im = new Image();
            im.decoding = 'async';
            im.src = u;
          });
        }, 120);
      }

      activate(i);
    };

    if(buttons && buttons.length){
      buttons.forEach(btn=>{
        btn.addEventListener('click', (e)=>{
          e.preventDefault();
          e.stopPropagation();
          const i = parseInt(btn.getAttribute('data-idx')||'0',10) || 0;
          setMain(i);
        });
      });
    }

    setMain(0);
  }catch(e){
    // ignore
  }
}

function bindDetailZoom(id){
  // Amazon-like hover zoom on desktop: show a zoom pane with magnified area.
  try{
    const card = document.querySelector('.card.detail[data-id="'+CSS.escape(String(id))+'"]');
    if(!card) return;
    const wrap = card.querySelector('.img.zoom-wrap');
    const img = card.querySelector('img.detail-main');
    const pane = card.querySelector('.zoom-pane');
    if(!wrap || !img || !pane) return;

    // Only enable on devices that support hover & fine pointer.
    if(window.matchMedia && !window.matchMedia('(hover: hover) and (pointer: fine)').matches){
      pane.style.display = 'none';
      return;
    }

    let activeUrl = null;

    const ensurePaneImage = (fullUrl)=>{
      if(!fullUrl) return;
      if(fullUrl === activeUrl) return;
      activeUrl = fullUrl;
      pane.style.backgroundImage = `url("${fullUrl}")`;
      // preload image silently
      const p = new Image();
      p.decoding = 'async';
      p.src = fullUrl;
    };

    const onMove = (e)=>{
      const rect = wrap.getBoundingClientRect();
      const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
      const y = Math.max(0, Math.min(e.clientY - rect.top, rect.height));
      const px = (x / rect.width) * 100;
      const py = (y / rect.height) * 100;
      pane.style.backgroundPosition = `${px}% ${py}%`;
    };

    const onEnter = ()=>{
      const fullUrl = img.dataset.full || img.getAttribute('data-full') || '';
      if(fullUrl) ensurePaneImage(fullUrl);
      pane.classList.add('on');
    };

    const onLeave = ()=>{
      pane.classList.remove('on');
    };

    // Update zoom source when main image changes (thumb clicks update data-full)
    const obs = new MutationObserver(()=>{
      const fullUrl = img.dataset.full || img.getAttribute('data-full') || '';
      if(fullUrl) ensurePaneImage(fullUrl);
    });
    obs.observe(img, { attributes: true, attributeFilter: ['src','data-full'] });

    wrap.addEventListener('mouseenter', onEnter);
    wrap.addEventListener('mousemove', onMove);
    wrap.addEventListener('mouseleave', onLeave);
  }catch(e){
    // ignore
  }
}

function bindHoverSlides(){
  // Clean previous listeners by replacing nodes? We'll just attach once per render
  document.querySelectorAll(".card:not(.detail) .img").forEach((box)=>{
    const card = box.closest(".card");
    const id = card?.getAttribute("data-id");
    const img = box.querySelector("img");
    if(!id || !img) return;

    const thumbs = (imagesThumbFor(id) || []).filter(Boolean);
    if(thumbs.length < 2) return;

    // Avoid duplicate binding
    if(box.dataset.hoverBound === "1") return;
    box.dataset.hoverBound = "1";

    let t = null;
    let idx = 0;
    const first = thumbs[0];

    const stop = ()=>{
      if(t){ clearInterval(t); t = null; }
      idx = 0;
      // Ensure we never flash black/empty
      img.src = first || img.getAttribute("data-src") || first;
    };

    const start = ()=>{
      if(t) return;
      // Ensure the first image is shown immediately (prevents black flash on hover)
      if(first){ img.src = first; }
      // Preload next frame to reduce flicker
      const preloadNext = (j)=>{
        const u = thumbs[j];
        if(!u) return;
        const p = new Image();
        p.decoding = "async";
        p.src = u;
      };
      preloadNext(1);
      t = setInterval(()=>{
        idx = (idx + 1) % thumbs.length;
        const next = thumbs[idx];
        if(next) img.src = next;
        preloadNext((idx + 1) % thumbs.length);
      }, 900);
    };

    box.addEventListener("mouseenter", start);
    box.addEventListener("mouseleave", stop);
    // Touch devices shouldn't auto-slide; mouseenter won't fire
  });
}

function currentFiltered(){
  const q = normalizeStr($("q").value);
  const section = normalizeStr($("section").value);
  const onlyWithPhoto = $("onlyWithPhoto").checked;
  const sortMode = normalizeStr($("sort")?.value || "num_asc");

  let base = DATA;

  if(section){
    // Filter key is stable RU section value (option.value stores RU)
    base = base.filter(r => normalizeStr(r?.["Раздел"]) === section);
  }
  if(onlyWithPhoto){
    base = base.filter(r => imagesFullFor(r["_id"] || r._id || r["Номер"]).length > 0);
  }

  // sorting helper
  const numVal = (r)=>{
    const s = String(r["Номер"] ?? r["_id"] ?? "").trim();
    const n = parseInt(s, 10);
    return Number.isFinite(n) ? n : 1e15;
  };
  const secVal = (r)=>normalizeStr(getField(r, "Раздел"));

  const priVal = (r)=>{
    const s = String(r["Приоритет"] ?? r["priority"] ?? "").trim();
    if(!s) return 0;
    const n = parseFloat(s.replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  };

  const applySort = (arr)=>{
    const out = arr.slice();
    out.sort((a,b)=>{
      // Primary: priority desc (higher first)
      const pa = priVal(a), pb = priVal(b);
      if(pb !== pa) return pb - pa;

      // Secondary: user-selected sorting
      if(sortMode === "sec_asc"){
        const sa = secVal(a); const sb = secVal(b);
        const c = sa.localeCompare(sb, LANG === "hy" ? "hy" : "ru");
        if(c !== 0) return c;
        return numVal(a) - numVal(b);
      }else if(sortMode === "sec_desc"){
        const sa = secVal(a); const sb = secVal(b);
        const c = sb.localeCompare(sa, LANG === "hy" ? "hy" : "ru");
        if(c !== 0) return c;
        return numVal(a) - numVal(b);
      }else{
        return numVal(a) - numVal(b);
      }
    });
    return out;
  };

  if(!q) return applySort(base);

  // Special: if user types only digits, prioritize by "Номер" exact match
  const isDigits = /^[0-9]+$/.test(q);
  if(isDigits){
    const exact = base.filter(r => String(r["Номер"] ?? "") === q);
    if(exact.length) return applySort(exact);
  }

  if(!fuse){
    return applySort(base.filter(r => (r["_search"] ?? "").toLowerCase().includes(q.toLowerCase())));
  }
  const res = fuse.search(q, { limit: 200 });
  const set = new Set(res.map(x=>x.item._id));
  return applySort(base.filter(r => set.has(r._id)));
}


function routePath(){
  const h = window.location.hash || "#/";
  const m = h.match(/^#\/part\/([^\/?#]+)/);
  if(m){
    return { mode:"part", id: decodeURIComponent(m[1]) };
  }
  return { mode:"list" };
}

let CURRENT_MODE = "list";

function findById(id){
  const sid = String(id);
  return DATA.find(r => String(r["_id"]) === sid || String(r["Номер"] ?? "") === sid);
}

function renderDetail(rec){
  const cards = $("cards");
  cards.innerHTML = "";
  const imgUrl = coverImageFor(rec["_id"]);
  const wrap = document.createElement("div");
  wrap.innerHTML = cardHtml(rec, imgUrl, { detail: true });
  cards.appendChild(wrap.firstElementChild);
  const st = $("stats");
  if(st) {
    st.classList.add("detail");
    const dict = I18N[LANG] || I18N.ru;
    const pid = rec["Номер"] ?? rec["_id"];
    st.innerHTML = `
      <button id="backBtn" class="backbtn" type="button">← ${escapeHtml(dict.back)}</button>
      <div class="detailpos">${escapeHtml(dict.position(pid))}</div>
    `;
    const bb = $("backBtn");
    if(bb){
      bb.addEventListener("click", (e)=>{
        e.preventDefault();
        // Prefer history back, but fall back to home.
        if(window.history.length > 1){
          window.history.back();
        }else{
          window.location.hash = "#/";
        }
      });
    }
  }
  bindDetailThumbs(rec["_id"]);
  bindDetailZoom(rec["_id"]);
}

function interceptLinks(){
  // With hash routes, the browser can navigate without server support.
  // We only need to re-render on hash changes.
  window.addEventListener("hashchange", ()=>handleRoute());
}

async function openGalleryFor(id){
  const full = imagesFullFor(id);
  if(!full.length) return;

  const dlg = $("galleryDlg");
  const rec = findById(id);
  $("gTitle").textContent = rec ? (getField(rec, "Название") ?? `#${id}`) : `#${id}`;
  $("gSub").textContent = rec ? (getField(rec, "Каталожное название") ?? getField(rec, "Раздел") ?? "") : "";

  const thumbs = imagesThumbFor(id);
  const gMain = $("gMain");
  const gThumbs = $("gThumbs");
  gThumbs.innerHTML = "";

  let cur = 0;
  const setMain = (thumbUrl, fullUrl)=>{
    const shown = thumbUrl || fullUrl;
    if(shown) gMain.src = shown;
    gMain.dataset.full = fullUrl || "";
    if(fullUrl && shown && fullUrl !== shown){
      const im = new Image();
      im.decoding = "async";
      im.onload = ()=>{
        if(gMain.dataset.full === fullUrl) gMain.src = fullUrl;
      };
      im.src = fullUrl;
    }
  };

  const setIndex = (i)=>{
    const max = full.length;
    if(max <= 0) return;
    cur = ((i % max) + max) % max;
    const t = thumbs[cur] || thumbs[0] || null;
    setMain(t, full[cur]);
  };

  setIndex(0);

  const tlist = (thumbs.length === full.length) ? thumbs : full;
  tlist.forEach((tUrl, i)=>{
    const img = document.createElement("img");
    img.loading = "lazy";
    img.src = tUrl;
    img.alt = `thumb ${i+1}`;
    img.addEventListener("click", ()=> setIndex(i));
    gThumbs.appendChild(img);
  });

  // Swipe navigation on mobile
  let x0 = null;
  const onTouchStart = (e)=>{ x0 = e.touches && e.touches[0] ? e.touches[0].clientX : null; };
  const onTouchEnd = (e)=>{
    if(x0 === null) return;
    const x1 = e.changedTouches && e.changedTouches[0] ? e.changedTouches[0].clientX : null;
    if(x1 === null) return;
    const dx = x1 - x0;
    if(Math.abs(dx) > 35){
      if(dx < 0) setIndex(cur + 1);
      else setIndex(cur - 1);
    }
    x0 = null;
  };
  gMain.addEventListener('touchstart', onTouchStart, { passive: true });
  gMain.addEventListener('touchend', onTouchEnd, { passive: true });
  const onKey = (e)=>{
    if(e.key === 'ArrowRight') setIndex(cur + 1);
    if(e.key === 'ArrowLeft') setIndex(cur - 1);
  };
  window.addEventListener('keydown', onKey);
  dlg.addEventListener('close', ()=>{
    window.removeEventListener('keydown', onKey);
    gMain.removeEventListener('touchstart', onTouchStart);
    gMain.removeEventListener('touchend', onTouchEnd);
  }, { once: true });

  dlg.showModal();
}

function bindGallery(){
  document.addEventListener("click", (e)=>{
    const el = e.target?.closest?.("[data-gallery]");
    if(!el) return;
    const id = el.getAttribute("data-gallery");
    if(id) openGalleryFor(id);
  });
  const dlg = $("galleryDlg");
  $("gClose").addEventListener("click", ()=>dlg.close());
}

function handleRoute(){
  const r = routePath();
  if(r.mode === "part"){
    // Save scroll position when leaving list
    if(CURRENT_MODE === "list"){
      const st = loadUiState();
      st.scrollY = window.scrollY || 0;
      saveUiState(st);
    }
    CURRENT_MODE = "part";
    const rec = findById(r.id);
    if(rec){
      renderDetail(rec);
      setPageMetaPart(rec);
    }else{
      $("stats").textContent = I18N[LANG].notFound;
      $("cards").innerHTML = "";
    }
  }else{
    CURRENT_MODE = "list";
    render(currentFiltered());
    setPageMetaList();
    // Restore scroll position after render
    const st = loadUiState();
    if(st && typeof st.scrollY === "number" && st.scrollY > 0){
      setTimeout(()=>{ window.scrollTo(0, st.scrollY); }, 0);
    }
  }
}


async function main(){
  setLang(langFromStorageOrQuery());
  applyI18n();

  // Render skeletons immediately (better perceived performance)
  renderSkeletons(12);

  const res = await fetch(url("data.json"));
  const loaded = await res.json();
  // Support either array OR {items:[...]}
  DATA = Array.isArray(loaded) ? loaded : (loaded.items || []);
  BY_ID = {};
  for(const r of DATA){
    BY_ID[String(r._id)] = r;
  }

  buildSections(DATA);

  fuse = new Fuse(DATA, {
    keys: [
      { name: "Номер", weight: 3 },
      { name: "Номер запчасти", weight: 3 },
      // RU
      { name: "Название", weight: 2 },
      { name: "Нормализованное название", weight: 2 },
      { name: "Каталожное название", weight: 2 },
      { name: "Детальная категория", weight: 1.5 },
      { name: "Раздел", weight: 1.2 },
      { name: "Описание", weight: 1.2 },
      // HY (optional)
      { name: "Название_hy", weight: 2 },
      { name: "Нормализованное название_hy", weight: 2 },
      { name: "Каталожное название_hy", weight: 2 },
      { name: "Детальная категория_hy", weight: 1.5 },
      { name: "Раздел_hy", weight: 1.2 },
      { name: "Описание_hy", weight: 1.2 },
      { name: "_search", weight: 0.5 },
    ],
    includeScore: true,
    threshold: 0.35,
    ignoreLocation: true,
    minMatchCharLength: 2,
  });

  await loadPhotosIndex();

  // Restore UI state (filters/search/sort) for list view
  const st = loadUiState();
  const qEl = $("q");
  const secEl = $("section");
  const sortEl = $("sort");
  const photoEl = $("onlyWithPhoto");
  if(qEl && typeof st.q === "string") qEl.value = st.q;
  if(secEl && typeof st.section === "string") secEl.value = st.section;
  if(sortEl && typeof st.sort === "string") sortEl.value = st.sort;
  if(photoEl && typeof st.onlyWithPhoto === "boolean") photoEl.checked = st.onlyWithPhoto;

  const saveStateFromInputs = () => {
    try{
      saveUiState({
        q: normalizeStr($("q")?.value),
        section: normalizeStr($("section")?.value),
        sort: normalizeStr($("sort")?.value || "num_asc"),
        onlyWithPhoto: !!$("onlyWithPhoto")?.checked,
        // scrollY is saved when leaving list
        scrollY: loadUiState().scrollY || 0,
      });
    }catch(e){}
  };

  const rerender = () => {
    saveStateFromInputs();
    handleRoute();
  };

  $("q").addEventListener("input", rerender);
  $("section").addEventListener("change", rerender);
  if(sortEl) sortEl.addEventListener("change", rerender);
  $("onlyWithPhoto").addEventListener("change", rerender);
  $("clear").addEventListener("click", () => {
    $("q").value="";
    $("section").value="";
    if(sortEl) sortEl.value="num_asc";
    $("onlyWithPhoto").checked=false;
    rerender();
  });

  interceptLinks();

  // Mobile header collapse
  const ft = $("filtersToggle");
  const topbar = document.querySelector('.topbar');
  if(ft && topbar){
    ft.addEventListener('click', (e)=>{
      e.preventDefault();
      topbar.classList.toggle('open');
    });
  }

  // Auto-open filters on larger screens
  const syncHeaderMode = ()=>{
    if(!topbar) return;
    if(window.innerWidth > 640) topbar.classList.add('open');
    else topbar.classList.remove('open');
  };
  window.addEventListener('resize', syncHeaderMode);
  syncHeaderMode();


  // Language toggle (reloads with correct prefix)
  const lt = $("langToggle");
  if(lt){
    lt.addEventListener("click", (e)=>{
      e.preventDefault();
      switchLanguage();
    });
  }

  handleRoute();
}

main().catch(err => {
  console.error(err);
  $("stats").textContent = I18N[LANG].loadError;
});
