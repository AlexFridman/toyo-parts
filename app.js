

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
  }
};

let LANG = "ru";

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

function partHref(id){
  return url(`part/${encodeURIComponent(String(id))}`);
}

function switchLanguage(){
  const next = (LANG === "ru") ? "hy" : "ru";
  setLang(next);
  applyI18n();
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
  const set = new Set();
  for(const r of records){
    const sec = getField(r, "Раздел");
    if(sec) set.add(sec);
  }
  const sections = Array.from(set).sort((a,b)=>a.localeCompare(b,'ru'));
  const sel = $("section");
  for(const s of sections){
    const opt = document.createElement("option");
    opt.value = s;
    opt.textContent = s;
    sel.appendChild(opt);
  }
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
  return `
  <article class="${cls}" data-id="${escapeHtml(r['_id'])}">
    <div class="img" role="button" tabindex="0" data-gallery="${escapeHtml(r['_id'])}">
      ${imgUrl ? `<img loading="lazy" src="${imgUrl}" alt="${name}">` : `<div>${escapeHtml(I18N[LANG].noPhoto)}</div>`}
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

function bindHoverSlides(){
  // Clean previous listeners by replacing nodes? We'll just attach once per render
  document.querySelectorAll(".card:not(.detail) .img").forEach((box)=>{
    const card = box.closest(".card");
    const id = card?.getAttribute("data-id");
    const img = box.querySelector("img");
    if(!id || !img) return;

    const thumbs = imagesThumbFor(id);
    if(!thumbs || thumbs.length < 2) return;

    // Avoid duplicate binding
    if(box.dataset.hoverBound === "1") return;
    box.dataset.hoverBound = "1";

    let t = null;
    let idx = 0;
    const first = thumbs[0];

    const stop = ()=>{
      if(t){ clearInterval(t); t = null; }
      idx = 0;
      img.src = first;
    };

    const start = ()=>{
      if(t) return;
      t = setInterval(()=>{
        idx = (idx + 1) % thumbs.length;
        img.src = thumbs[idx];
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
    base = base.filter(r => normalizeStr(getField(r, "Раздел")) === section);
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
  const p = window.location.pathname;
  const m = p.match(/\/part\/([^\/?#]+)/);
  if(m){
    return { mode:"part", id: decodeURIComponent(m[1]) };
  }
  return { mode:"list" };
}

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
  if(st) { st.classList.add("detail"); st.textContent = I18N[LANG].position(rec["Номер"] ?? rec["_id"]); }
  bindDetailThumbs(rec["_id"]);
}

function interceptLinks(){
  document.addEventListener("click", (e)=>{
    const a = e.target?.closest?.("a");
    if(!a) return;
    const href = a.getAttribute("href") || "";
    if(href.includes("/part/") || href.startsWith("part/")){
      e.preventDefault();
      history.pushState({}, "", href);
      handleRoute();
    }
  });
  window.addEventListener("popstate", ()=>handleRoute());
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

  const firstThumb = (thumbs && thumbs.length) ? thumbs[0] : null;
  setMain(firstThumb, full[0]);

  const tlist = (thumbs.length === full.length) ? thumbs : full;
  tlist.forEach((tUrl, i)=>{
    const img = document.createElement("img");
    img.loading = "lazy";
    img.src = tUrl;
    img.alt = `thumb ${i+1}`;
    img.addEventListener("click", ()=> setMain(tUrl, (full[i] ?? full[0])));
    gThumbs.appendChild(img);
  });

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
    const rec = findById(r.id);
    if(rec){
      renderDetail(rec);
      // reset filters
      $("section").value = "";
      $("onlyWithPhoto").checked = false;
      $("q").value = "";
    }else{
      $("stats").textContent = I18N[LANG].notFound;
      $("cards").innerHTML = "";
    }
  }else{
    render(currentFiltered());
  }
}


async function main(){
  setLang(langFromStorageOrQuery());
  applyI18n();

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

  const rerender = () => handleRoute();
  $("q").addEventListener("input", rerender);
  $("section").addEventListener("change", rerender);
  const sortEl = $("sort");
  if(sortEl) sortEl.addEventListener("change", rerender);
  $("onlyWithPhoto").addEventListener("change", rerender);
  $("clear").addEventListener("click", () => { $("q").value=""; $("section").value=""; if(sortEl) sortEl.value="num_asc"; $("onlyWithPhoto").checked=false; rerender(); });

  interceptLinks();
  bindGallery();


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
