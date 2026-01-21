window.__DISABLE_IMG_HOVER_SLIDESHOW = true;


async function initThemeFromConfig(){
  try{
    const res = await fetch("./config.json", { cache: "no-store" });
    const cfg = await res.json();
    const def = (cfg?.ui?.theme_default || "dark").toLowerCase();
    const saved = localStorage.getItem("theme");
    const theme = (saved || def);
    document.documentElement.setAttribute("data-theme", theme === "light" ? "light" : "dark");
  }catch(e){
    // fallback
    document.documentElement.setAttribute("data-theme", localStorage.getItem("theme") || "dark");
  }
}

function toggleTheme(){
  haptic("light");
const cur = document.documentElement.getAttribute("data-theme") || "dark";
  const next = (cur === "light") ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("theme", next);
  gaEvent("theme_change", { to: next });
}

async function initAnalyticsFromConfig(){
  try{
    const res = await fetch("./config.json", { cache: "no-store" });
    const cfg = await res.json();
    const gaId = cfg?.analytics?.ga4;
    if(!gaId) return;

    const s = document.createElement("script");
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
    document.head.appendChild(s);

    window.dataLayer = window.dataLayer || [];
    window.gtag = function(){ dataLayer.push(arguments); };

    gtag("js", new Date());
    gtag("config", gaId, { send_page_view: false });

    trackPageView();
    window.addEventListener("hashchange", trackPageView);
  }catch(e){
    console.warn("Analytics init failed", e);
  }
}


function gaEvent(name, params = {}){
  try{
    if(typeof window.gtag === "function"){
      window.gtag("event", name, params);
    }
  }catch(e){}
}


function trackPageView(){
  if(typeof window.gtag !== "function") return;
  const page_path = location.pathname + location.search + location.hash;
  const page_title = document.title || "toyo-parts";
  window.gtag("event", "page_view", { page_path, page_title });
}




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
  haptic("light");
try{ gaEvent("language_change", { from: LANG, to: (LANG === "ru") ? "hy" : "ru" }); }catch(e){}

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
    if(opts.detail){
    const mainThumb = (thumbs && thumbs.length) ? thumbs[0] : imgUrl;
    const mainFull = (fulls && fulls.length) ? fulls[0] : (imagesFullFor(r["_id"])[0] || "");
    const thumbsHtml = (thumbs && thumbs.length) ? thumbs.map((t,i)=>(
      `<div class="thumb" data-i="${i}"><img src="${t}" alt="thumb ${i+1}" loading="lazy"></div>`
    )).join("") : "";
    return `
  <article class="card detail detail-page" data-id="${escapeHtml(r['_id'])}">
    <div class="detail-wrap">
      <div class="detail-left">
        <div class="photo-row">
          <div class="main-photo-wrap">
            ${imgUrl ? `<img class="detail-main" id="detailMain" src="${escapeHtml(mainThumb)}" data-full="${escapeHtml(mainFull)}" alt="${escapeHtml(name)}" loading="eager">`
                     : `<div class="nop">${escapeHtml(I18N[LANG].noPhoto)}</div>`}
            ${badges.length ? `<div class="badges">${badges.join("")}</div>` : ""}
          </div>
          <div class="zoom-view" aria-hidden="true">
            ${imgUrl ? `<img id="zoomImg" src="${escapeHtml(mainFull || mainThumb)}" alt="">` : ``}
          </div>
        </div>
        ${thumbsHtml ? `<div class="thumbs-row">${thumbsHtml}</div>` : ``}
      </div>
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
    </div>
  </article>
  `;
  }

  return `
  <article class="${cls} is-clickable" data-id="${escapeHtml(r['_id'])}" data-href="${partHref(r['_id'])}" tabindex="0" role="link">
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

    const mainImg = card.querySelector('.main-photo-wrap img');
    const thumbsWrap = card.querySelector('.thumbs-row');
    if(!mainImg || !thumbsWrap) return;

    const thumbs = imagesThumbFor(id);
    const full = imagesFullFor(id);
    if(!thumbs.length && !full.length) return;

    const items = Array.from(thumbsWrap.querySelectorAll('.thumb'));
    if(!items.length) return;

    const setActive = (i)=>{
      gaEvent("photo_change",{part_id:String(id), index:i, via:"thumb"});
      items.forEach((el, idx)=> el.classList.toggle('is-active', idx===i));

      const fullUrl = (full && full[i]) ? full[i] : (full && full[0]) ? full[0] : '';
      const thumbUrl = (thumbs && thumbs[i]) ? thumbs[i] : fullUrl;

      // show thumb fast
      if(thumbUrl) mainImg.src = thumbUrl;

      // set data-full so zoom pane tracks the true full image
      if(fullUrl){
        mainImg.dataset.full = fullUrl;
        // swap to full when loaded
        if(fullUrl !== thumbUrl){
          const pre = new Image();
          pre.onload = ()=> { mainImg.src = fullUrl; };
          pre.src = fullUrl;
        }
      }
    };

    items.forEach((el, i)=>{
      gaEvent("photo_thumb_click",{part_id:String(id), index:i});
      el.addEventListener('click', (e)=>{
        e.preventDefault();
        setActive(i);
      });
    });

    // initial
    items[0].classList.add('is-active');
    const firstFull = (full && full[0]) ? full[0] : '';
    if(firstFull) mainImg.dataset.full = firstFull;

  }catch(e){
    // ignore
  }
}

function bindDetailZoom(id){
  // Amazon-like hover zoom on desktop: pan a magnified image in the right pane.
  try{
    const card = document.querySelector('.card.detail[data-id="'+CSS.escape(String(id))+'"]');
    if(!card) return;

    // Only enable on devices that support hover & fine pointer.
    if(window.matchMedia && !window.matchMedia('(hover: hover) and (pointer: fine)').matches){
      const zv = card.querySelector('.zoom-view');
      if(zv) zv.style.display = 'none';
      return;
    }

    const mainWrap = card.querySelector('.main-photo-wrap');
    const mainImg = card.querySelector('.main-photo-wrap img');
    const zoomWrap = card.querySelector('.zoom-view');
    const zoomImg = card.querySelector('.zoom-view img');

    if(!mainWrap || !mainImg || !zoomWrap || !zoomImg) return;

    const ZOOM = 2.2;

    function ensureZoomSrc(){
      const fullUrl = mainImg.dataset.full || mainImg.getAttribute('data-full') || mainImg.src || '';
      if(fullUrl && zoomImg.src !== fullUrl){
        zoomImg.src = fullUrl;
      }
    }

    function update(clientX, clientY){
      const rect = mainWrap.getBoundingClientRect();
      const x = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
      const y = Math.min(Math.max((clientY - rect.top) / rect.height, 0), 1);
      const tx = -(x * (ZOOM - 1)) * rect.width;
      const ty = -(y * (ZOOM - 1)) * rect.height;
      zoomImg.style.transform = `translate(${tx}px, ${ty}px) scale(${ZOOM})`;
    }

    const onEnter = ()=>{
      gaEvent("photo_zoom_hover",{part_id:String(id)});
      ensureZoomSrc();
      zoomImg.style.transform = `scale(${ZOOM})`;
      zoomWrap.classList.add('on');
    };

    const onLeave = ()=>{
      zoomWrap.classList.remove('on');
      zoomImg.style.transform = 'none';
    };

    const onMove = (e)=> update(e.clientX, e.clientY);

    // Keep zoom in sync when main changes (thumb click swaps src/data-full)
    const obs = new MutationObserver(()=> ensureZoomSrc());
    obs.observe(mainImg, { attributes: true, attributeFilter: ['src','data-full'] });

    mainWrap.addEventListener('mouseenter', onEnter);
    mainWrap.addEventListener('mousemove', onMove);
    mainWrap.addEventListener('mouseleave', onLeave);
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
  try{ stopAllSlideshows(); }catch(e){}
  try{ startDetailSession(rec["_id"], rec); }catch(e){}
  // GA: view part
  try{
    const meta = {
      part_id: rec["_id"],
      number: rec["Номер"] ?? rec["_id"],
      category: rec["Детальная категория"] || rec["Раздел"] || "",
      name_ru: rec["Название"] || ""
    };
    gaEvent("view_part", meta);
  }catch(e){}

  const cards = $("cards");
  cards.innerHTML = "";
  const imgUrl = coverImageFor(rec["_id"]);
  const wrap = document.createElement("div");
  wrap.innerHTML = cardHtml(rec, imgUrl, { detail: true });
  cards.appendChild(wrap.firstElementChild);
  try{ initMobileDetailZoom(); }catch(e){}
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
          endDetailSession();
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

function bindCardClicks(){
  document.addEventListener("click", (e)=>{
    const card = e.target?.closest?.("article.card.is-clickable[data-id]");
    if(!card) return;
    if(CURRENT_MODE !== "list") return;

    // Don't hijack clicks on interactive elements.
    if(e.target.closest("a, button, input, select, textarea, label")) return;

    const href = card.getAttribute("data-href") || partHref(card.getAttribute("data-id"));
    if(!href) return;

    // Navigate via hash route
    location.hash = href;
  });

  // Keyboard accessibility
  document.addEventListener("keydown", (e)=>{
    if(e.key !== "Enter" && e.key !== " ") return;
    const card = document.activeElement?.closest?.("article.card.is-clickable[data-id]");
    if(!card) return;
    if(CURRENT_MODE !== "list") return;
    e.preventDefault();
    const href = card.getAttribute("data-href") || partHref(card.getAttribute("data-id"));
    if(href) location.hash = href;
  });
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
      // Always start detail page at the top (SPA keeps previous scroll otherwise)
      setTimeout(()=>{ try{ window.scrollTo(0,0); }catch(e){} }, 0);
    }else{
      $("stats").textContent = I18N[LANG].notFound;
      $("cards").innerHTML = "";
      setTimeout(()=>{ try{ window.scrollTo(0,0); }catch(e){} }, 0);
    }
    }else{
    const prevMode = CURRENT_MODE;
    CURRENT_MODE = "list";
    render(currentFiltered());
    setPageMetaList();

    // Restore scroll ONLY when returning from the detail page.
    if(prevMode === "part"){
      const st = loadUiState();
      if(st && typeof st.scrollY === "number" && st.scrollY > 0){
        const y = st.scrollY;
        // Clear stored scroll so refresh/open doesn't jump down unexpectedly.
        st.scrollY = 0;
        saveUiState(st);
        setTimeout(()=>{ window.scrollTo(0, y); }, 0);
      }else{
        setTimeout(()=>{ window.scrollTo(0, 0); }, 0);
      }
    }else{
      // New visit or reload: stay at the top.
      setTimeout(()=>{ window.scrollTo(0, 0); }, 0);
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

  $("q").addEventListener("input", (e)=>{ gaEvent("search", { q: e.target.value }); rerender(); });
  $("section").addEventListener("change", (e)=>{ gaEvent("filter_section", { value: e.target.value }); rerender(); });
  if(sortEl) sortEl.addEventListener("change", (e)=>{ gaEvent("sort_change", { value: e.target.value }); rerender(); });
  $("onlyWithPhoto").addEventListener("change", (e)=>{ gaEvent("toggle_only_with_photo", { value: e.target.checked }); rerender(); });
  $("clear").addEventListener("click", () => { gaEvent("clear_filters");
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


window.addEventListener("DOMContentLoaded", ()=>{
  const c = $("callBtn"); if(c) c.addEventListener("click", ()=>gaEvent("contact_call", { from: String(location.hash||""), part_id: (String(location.hash||"").startsWith("#/part/") ? String(location.hash).split("/").pop() : "") }));
  const w = $("waBtn"); if(w) w.addEventListener("click", ()=>gaEvent("contact_whatsapp", { from: String(location.hash||""), part_id: (String(location.hash||"").startsWith("#/part/") ? String(location.hash).split("/").pop() : "") }));
  const t = $("tgBtn"); if(t) t.addEventListener("click", ()=>gaEvent("contact_telegram", { from: String(location.hash||""), part_id: (String(location.hash||"").startsWith("#/part/") ? String(location.hash).split("/").pop() : "") }));
  const h = $("homeBtn"); if(h) h.addEventListener("click", ()=>{ gaEvent("home_click", { from: String(location.hash||"") }); endDetailSession(); });
});

window.addEventListener('DOMContentLoaded', ()=>{ try{ initThemeFromConfig(); }catch(e){} const tb=document.getElementById('themeBtn'); if(tb) tb.addEventListener('click', toggleTheme); });


async function initClarityFromConfig(){
  try{
    const res = await fetch("./config.json", { cache: "no-store" });
    const cfg = await res.json();
    const id = cfg?.analytics?.clarity;
    if(!id) return;

    (function(c,l,a,r,i,t,y){
      c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
      t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
      y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
    })(window, document, "clarity", "script", id);

    gaEvent("clarity_loaded");
  }catch(e){
    console.warn("Clarity init failed", e);
  }
}

window.addEventListener('DOMContentLoaded', ()=>{ initAnalyticsFromConfig(); });

window.addEventListener('DOMContentLoaded', ()=>{ initClarityFromConfig(); });


function normalizeQuery(q){
  q = String(q||"").trim().toLowerCase();
  // basic translit (ru->latin & latin->ru partial) for common car part searches
  const map = {
    "a":"а","b":"в","c":"с","e":"е","h":"н","k":"к","m":"м","o":"о","p":"р","t":"т","x":"х","y":"у",
    "r":"р","n":"п","u":"и","s":"с","v":"в"
  };
  let swapped = "";
  for(const ch of q){
    swapped += (map[ch] || ch);
  }
  return { q, swapped };
}

function saveSearchHistory(q){
  q = String(q||"").trim();
  if(!q) return;
  let arr = [];
  try{ arr = JSON.parse(localStorage.getItem("search_history")||"[]"); }catch(e){ arr=[]; }
  arr = arr.filter(x => x !== q);
  arr.unshift(q);
  arr = arr.slice(0, 8);
  localStorage.setItem("search_history", JSON.stringify(arr));
}

function getSearchHistory(){
  try{ return JSON.parse(localStorage.getItem("search_history")||"[]"); }catch(e){ return []; }
}

function populateSearchDatalist(){
  const dl = document.getElementById("searchDatalist");
  if(!dl) return;
  const hist = getSearchHistory();
  dl.innerHTML = hist.map(h=>`<option value="${escapeHtml(h)}"></option>`).join("");
}
window.addEventListener("DOMContentLoaded", ()=>{ populateSearchDatalist(); });

function bindSearchHistory(){
  const q = document.getElementById("q");
  if(!q) return;
  q.addEventListener("keydown", (e)=>{
    if(e.key === "Enter"){
      saveSearchHistory(q.value);
      populateSearchDatalist();
      gaEvent("search_submit", { q: q.value });
    }
  });
  q.addEventListener("blur", ()=>{
    saveSearchHistory(q.value);
    populateSearchDatalist();
  });
}
window.addEventListener("DOMContentLoaded", ()=>{ bindSearchHistory(); });

function mergeFuseResults(a,b){
  const seen = new Set();
  const out = [];
  for(const r of (a||[])){
    const id = r?.item?._id || r?.item?.["Номер"] || JSON.stringify(r.item||r);
    if(seen.has(id)) continue;
    seen.add(id); out.push(r);
  }
  for(const r of (b||[])){
    const id = r?.item?._id || r?.item?.["Номер"] || JSON.stringify(r.item||r);
    if(seen.has(id)) continue;
    seen.add(id); out.push(r);
  }
  return out;
}

function initKeyboardNav(){
  document.addEventListener("keydown", (e)=>{
    const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : "";
    const typing = (tag === "input" || tag === "textarea");

    if(e.key === "/" && !typing){
      const q = document.getElementById("q");
      if(q){ e.preventDefault(); q.focus(); }
      return;
    }

    if(e.key === "Escape"){
      // close focus / go home from detail
      if(!typing && String(location.hash||"").startsWith("#/part/")){
        gaEvent("kbd_escape_home");
        endDetailSession();
        location.hash = "#/";
      }
      return;
    }

    // Detail next/prev with arrows
    if(!typing && String(location.hash||"").startsWith("#/part/")){
      if(e.key === "ArrowLeft" || e.key === "ArrowRight"){
        const curId = String(location.hash||"").split("/").pop();
        const ids = (window.__lastListIds || []);
        const idx = ids.indexOf(curId);
        if(idx !== -1){
          const nextIdx = (e.key === "ArrowRight") ? Math.min(ids.length-1, idx+1) : Math.max(0, idx-1);
          const nid = ids[nextIdx];
          if(nid && nid !== curId){
            gaEvent("kbd_part_nav", { dir: e.key === "ArrowRight" ? "next" : "prev" });
            location.hash = "#/part/" + encodeURIComponent(nid);
          }
        }
      }
    }
  });
}
window.addEventListener("DOMContentLoaded", ()=>{ initKeyboardNav(); });

function initQuickPreview(){
  const qp = document.getElementById("quickPreview");
  const qpImg = document.getElementById("qpImg");
  const qpTitle = document.getElementById("qpTitle");
  const qpMeta = document.getElementById("qpMeta");
  if(!qp || !qpImg || !qpTitle || !qpMeta) return;

  const enabled = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if(!enabled) return;

  let t = null;
  function showFor(card, e){
    if(!card) return;
    const id = card.getAttribute("data-id");
    const rec = window.DB && window.DB[String(id)];
    if(!rec) return;

    const thumbs = imagesThumbFor(id);
    const fulls = imagesFullFor(id);
    const img = (thumbs && thumbs[0]) || (fulls && fulls[0]) || "";
    if(img) qpImg.src = img;

    qpTitle.textContent = (rec["Название"] || "").toString();
    const sec = (rec["Раздел"] || "").toString();
    const cat = (rec["Детальная категория"] || "").toString();
    qpMeta.innerHTML = `${escapeHtml(sec)} ${cat ? "• "+escapeHtml(cat) : ""} • #${escapeHtml(rec["Номер"] ?? id)}`;

    const x = Math.min(window.innerWidth - qp.offsetWidth - 12, e.clientX + 16);
    const y = Math.min(window.innerHeight - qp.offsetHeight - 12, e.clientY + 16);
    qp.style.left = x + "px";
    qp.style.top = y + "px";
    qp.classList.add("on");
  }
  function hide(){
    qp.classList.remove("on");
  }

  document.addEventListener("mousemove", (e)=>{
    const card = e.target && e.target.closest ? e.target.closest(".card[data-id]") : null;
    if(!card){ hide(); return; }
    // only when hovering over the image area
    if(!e.target.closest(".img, .imgwrap, img")){ hide(); return; }
    if(t) clearTimeout(t);
    t = setTimeout(()=>showFor(card, e), 120);
  });
  document.addEventListener("mouseleave", hide);
}
window.addEventListener("DOMContentLoaded", ()=>{ initQuickPreview(); });

function renderSkeletonHome(){
  const root = document.getElementById("root");
  if(!root) return;
  const n = 10;
  root.innerHTML = `<div class="grid">` + Array.from({length:n}).map(()=>`
    <div class="skel-card">
      <div class="skel-img skeleton"></div>
      <div class="skel-line w90 skeleton"></div>
      <div class="skel-line w70 skeleton"></div>
      <div class="skel-line w50 skeleton"></div>
    </div>
  `).join("") + `</div>`;
}

function updateMobileActionsLabels(){
  const dict = I18N[LANG] || I18N.ru;
  const c = document.getElementById("mCall");
  const w = document.getElementById("mWa");
  const t = document.getElementById("mTg");
  if(c) c.textContent = (LANG==="hy" ? "📞 Զանգել" : "📞 Позвонить");
  if(w) w.textContent = (LANG==="hy" ? "💬 WhatsApp" : "💬 WhatsApp");
  if(t) t.textContent = (LANG==="hy" ? "✈️ Telegram" : "✈️ Telegram");
}
window.addEventListener("DOMContentLoaded", ()=>{ updateMobileActionsLabels(); });

function initMobileCenterSlideshow(){
  // Disabled on detail pages
  if(String(location.hash||"").startsWith("#/part/")) return;
  // On touch devices: automatically slideshow the card closest to viewport center.
  const mq = window.matchMedia && window.matchMedia('(hover: none) and (pointer: coarse)');
  if(!mq || !mq.matches) return;

  let activeId = null;
  let timer = null;

  function stop(){
    if(timer){ clearInterval(timer); timer = null; }
    activeId = null;
  }

  function startForCard(card){
    const id = card.getAttribute("data-id");
    if(!id) return;
    if(activeId === id) return;

    stop();
    activeId = id;

    const imgs = imagesThumbFor(id) || [];
    if(!imgs.length) return;

    const imgEl = card.querySelector("img");
    if(!imgEl) return;

    let i = 0;
    imgEl.src = imgs[0];
    // preload next to avoid black flash
    const preload = (k)=>{ try{ const im=new Image(); im.src=imgs[k%imgs.length]; }catch(e){} };

    preload(1);

    timer = setInterval(()=>{
      i = (i + 1) % imgs.length;
      imgEl.src = imgs[i];
      preload(i+1);
    }, 1200);
  }

  function pickCenter(){
    const cards = Array.from(document.querySelectorAll(".card[data-id]"));
    if(!cards.length) return;
    const cy = window.innerHeight * 0.5;
    let best = null;
    let bestDist = 1e9;
    for(const c of cards){
      const r = c.getBoundingClientRect();
      if(r.bottom < 0 || r.top > window.innerHeight) continue;
      const mid = (r.top + r.bottom) / 2;
      const d = Math.abs(mid - cy);
      if(d < bestDist){
        bestDist = d;
        best = c;
      }
    }
    if(best) startForCard(best);
  }

  window.addEventListener("scroll", ()=>{ pickCenter(); }, { passive:true });
  window.addEventListener("resize", pickCenter);
  window.addEventListener("hashchange", stop);

  // initial
  setTimeout(pickCenter, 400);
}
window.addEventListener("DOMContentLoaded", ()=>{ initMobileCenterSlideshow(); });

function initDesktopHoverSlideshow(){
  // Disabled on detail pages
  if(String(location.hash||"").startsWith("#/part/")) return;
  const enabled = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if(!enabled) return;

  let activeId = null;
  let timer = null;
  let imgs = [];
  let imgEl = null;
  let i = 0;

  function stop(){
    if(timer){ clearInterval(timer); timer = null; }
    activeId = null; imgs = []; imgEl = null; i = 0;
  }

  function start(card){
    const id = card.getAttribute("data-id");
    if(!id) return;
    if(activeId === id) return;

    stop();
    activeId = id;
    imgs = imagesThumbFor(id) || [];
    if(!imgs.length) return;

    imgEl = card.querySelector("img");
    if(!imgEl) return;

    i = 0;
    // preload first 2 to avoid black
    try{ const p1=new Image(); p1.src=imgs[0]; }catch(e){}
    try{ const p2=new Image(); p2.src=imgs[1%imgs.length]; }catch(e){}

    imgEl.src = imgs[0];

    timer = setInterval(()=>{
      i = (i + 1) % imgs.length;
      imgEl.src = imgs[i];
      try{ const p=new Image(); p.src=imgs[(i+1)%imgs.length]; }catch(e){}
    }, 1200);
  }

  document.addEventListener("mouseover", (e)=>{
    const card = e.target && e.target.closest ? e.target.closest(".card[data-id]") : null;
    if(!card) return;
    start(card);
  });

  document.addEventListener("mouseout", (e)=>{
    // stop when leaving the card entirely
    const from = e.target && e.target.closest ? e.target.closest(".card[data-id]") : null;
    const to = e.relatedTarget && e.relatedTarget.closest ? e.relatedTarget.closest(".card[data-id]") : null;
    if(from && from !== to){
      stop();
    }
  });
}
window.addEventListener("DOMContentLoaded", ()=>{ initDesktopHoverSlideshow(); });

function haptic(type="light"){
  // Best-effort: vibration on supported browsers (Android). iOS Safari doesn't expose vibration.
  try{
    const map = { light: 10, medium: 20, heavy: 30 };
    if(navigator.vibrate){
      navigator.vibrate(map[type] || 10);
    }
  }catch(e){}
}

function initBottomSheet(){ /* removed */ }

function adjustMobileActionsSpacer(){
  const bar = document.getElementById("mobileActions");
  if(!bar) return;
  const h = bar.getBoundingClientRect().height || bar.offsetHeight || 0;
  if(h>0){
    document.documentElement.style.setProperty("--mobile-actions-h", `${Math.ceil(h)}px`);
  }
}

function setupMobileActionsSpacer(){
  adjustMobileActionsSpacer();
  window.addEventListener("resize", adjustMobileActionsSpacer, {passive:true});
  if(window.visualViewport){
    window.visualViewport.addEventListener("resize", adjustMobileActionsSpacer, {passive:true});
  }
  try{
    const bar = document.getElementById("mobileActions");
    if(bar && "ResizeObserver" in window){
      const ro = new ResizeObserver(()=>adjustMobileActionsSpacer());
      ro.observe(bar);
    }
  }catch(e){}
}
window.addEventListener("DOMContentLoaded", setupMobileActionsSpacer);

function initCardClickOpen(){
  // On touch devices: tap anywhere on a card to open detail (except controls)
  const mq = window.matchMedia && window.matchMedia('(hover: none) and (pointer: coarse)');
  if(!mq || !mq.matches) return;

  document.addEventListener("click", (e)=>{
    const card = e.target && e.target.closest ? e.target.closest(".card[data-id]") : null;
    if(!card) return;

    // ignore interactive elements
    if(e.target.closest("a, button, input, select, textarea, label")) return;

    const id = card.getAttribute("data-id");
    if(!id) return;
    haptic("light");
    gaEvent("card_tap_open", { id: String(id) });
    location.hash = "#/part/" + encodeURIComponent(id);
  });
}
window.addEventListener("DOMContentLoaded", ()=>{ initCardClickOpen(); });

function stopMobileSlideshowOnDetail(){
  if(String(location.hash||"").startsWith("#/part/")){
    if(window.__mobileSlideshowStop) window.__mobileSlideshowStop();
  }
}
window.addEventListener("hashchange", stopMobileSlideshowOnDetail);

function stopAllSlideshows(){
  if(window.__stopDesktopSlideshow) window.__stopDesktopSlideshow();
  if(window.__mobileSlideshowStop) window.__mobileSlideshowStop();
}

function initMobileDetailZoom(){
  const mq = window.matchMedia && window.matchMedia('(hover: none) and (pointer: coarse)');
  if(!mq || !mq.matches) return;

  const img = document.querySelector(".detail-page img.detail-main");
  const wrap = document.querySelector(".detail-page .main-photo-wrap");
  if(!img || !wrap) return;

  // Add a small hint once per device
  if(!wrap.querySelector(".zoom-hint")){
    const h = document.createElement("div");
    h.className = "zoom-hint";
    h.textContent = (LANG === "hy") ? "Կրկնակի թափ՝ զում" : "Двойной тап — зум";
    wrap.appendChild(h);
    setTimeout(()=>{ try{ h.style.opacity = "0"; }catch(e){} }, 2500);
    setTimeout(()=>{ try{ h.remove(); }catch(e){} }, 3300);
  }

  let zoomed = false;
  let scale = 2.2;
  let tx = 0, ty = 0;
  let startX = 0, startY = 0;
  let startTx = 0, startTy = 0;
  let dragging = false;
  let lastTap = 0;

  function apply(){
    img.style.transform = `translate(${tx}px, ${ty}px) scale(${zoomed ? scale : 1})`;
    img.style.transformOrigin = "center center";
  }

  function clamp(){
    // limit panning based on container size
    const rW = wrap.clientWidth || 1;
    const rH = wrap.clientHeight || 1;
    const maxX = (rW * (scale - 1)) / 2;
    const maxY = (rH * (scale - 1)) / 2;
    tx = Math.max(-maxX, Math.min(maxX, tx));
    ty = Math.max(-maxY, Math.min(maxY, ty));
  }

  function setZoom(on){
    zoomed = on;
    if(!zoomed){ tx = 0; ty = 0; dragging = false; }
    wrap.classList.toggle("zoomed", zoomed);
    apply();
    gaEvent("mobile_zoom_toggle", { on: zoomed, part_id: String(location.hash||"").split("/").pop() || "" });
  }

  function onTap(e){
    const now = Date.now();
    const dt = now - lastTap;
    lastTap = now;
    if(dt < 280){
      e.preventDefault();
      haptic("light");
      setZoom(!zoomed);
    }
  }

  function onStart(e){
    if(!zoomed) return;
    dragging = true;
    const t = e.touches ? e.touches[0] : e;
    startX = t.clientX;
    startY = t.clientY;
    startTx = tx;
    startTy = ty;
    img.style.transition = "none";
  }
  function onMove(e){
    if(!zoomed || !dragging) return;
    const t = e.touches ? e.touches[0] : e;
    const dx = t.clientX - startX;
    const dy = t.clientY - startY;
    tx = startTx + dx;
    ty = startTy + dy;
    clamp();
    apply();
  }
  function onEnd(e){
    if(!zoomed) return;
    dragging = false;
    img.style.transition = "";
    clamp(); apply();
  }

  img.addEventListener("touchend", onTap, { passive: false });
  img.addEventListener("touchstart", onStart, { passive: true });
  img.addEventListener("touchmove", onMove, { passive: true });
  img.addEventListener("touchend", onEnd, { passive: true });
  img.addEventListener("touchcancel", onEnd, { passive: true });

  // Reset zoom when image changes (thumb click changes src) - observe attribute changes
  const obs = new MutationObserver(()=>{ if(zoomed) setZoom(false); });
  obs.observe(img, { attributes: true, attributeFilter: ["src"] });

  // cleanup on route change
  const onHash = ()=>{ try{ obs.disconnect(); }catch(e){} };
  window.addEventListener("hashchange", onHash, { once: true });

  apply();
}
