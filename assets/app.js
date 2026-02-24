/* DecisionLens Dashboard JS (Phase-1 + Phase-2 compatible)
   - Phase‑1 free panels are always active (sessions, news, watchlist, time).
   - Phase‑2 premium gating is handled by assets/access.js (DL_handlePremiumClick).
   - No signals, no predictions; context-only UI.
*/

const TZ_USER = Intl.DateTimeFormat().resolvedOptions().timeZone;
const TZ_PKT  = "Asia/Karachi";

function fmtInTZ(date, timeZone, opts){
  return new Intl.DateTimeFormat("en-US", { timeZone, ...opts }).format(date);
}
function fmtTime12(date, timeZone){
  return fmtInTZ(date, timeZone, { hour:"numeric", minute:"2-digit", hour12:true });
}
function fmtDateShort(date, timeZone){
  return fmtInTZ(date, timeZone, { month:"short", day:"2-digit" });
}
function minutesUntil(a, b){
  return Math.floor((b.getTime() - a.getTime()) / 60000);
}
function humanDur(mins){
  const m = Math.max(0, mins);
  const h = Math.floor(m/60);
  const r = m%60;
  if(h<=0) return r + "m";
  return h + "h " + r + "m";
}

const sessions = [
  { key:"syd", title:"Sydney", country:"Australia", tz:"Australia/Sydney", open:{h:10,m:0}, close:{h:16,m:0} },
  { key:"tok", title:"Tokyo", country:"Japan", tz:"Asia/Tokyo", open:{h:9,m:0}, close:{h:15,m:0} },
  { key:"lon", title:"London", country:"UK", tz:"Europe/London", open:{h:8,m:0}, close:{h:16,m:30} },
  { key:"ny",  title:"New York", country:"USA", tz:"America/New_York", open:{h:9,m:30}, close:{h:16,m:0} },
  { key:"crypto", title:"Crypto", country:"24/7", tz:"UTC" }
];

function isWeekend(date, tz){
  const day = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday:"short" }).format(date);
  return day === "Sat" || day === "Sun";
}

function sessionState(now, s){
  if(s.key === "crypto"){
    return { label:"Open", dot:"open", countdown:"24/7", openUser:"—", closeUser:"—" };
  }

  // Weekend close logic
  if(isWeekend(now, s.tz)){
    return { label:"Closed (Weekend)", dot:"closed", countdown:"Opens Monday", openUser:"—", closeUser:"—" };
  }

  // IMPORTANT:
  // Open/Close are defined in each session's LOCAL timezone.
  // We'll compute "now" in that session tz by formatting components, to avoid DST errors.
  const y = fmtInTZ(now, s.tz, { year:"numeric" });
  const mo = fmtInTZ(now, s.tz, { month:"2-digit" });
  const d  = fmtInTZ(now, s.tz, { day:"2-digit" });

  // Create a Date object for open/close in the *session* local date, then format for user tz display.
  // We'll approximate by creating in UTC using the session local components; for countdown we use user's local clock.
  // (Countdown precision is sufficient for dashboard context.)
  const openDate = new Date(`${y}-${mo}-${d}T${String(s.open.h).padStart(2,"0")}:${String(s.open.m).padStart(2,"0")}:00`);
  const closeDate = new Date(`${y}-${mo}-${d}T${String(s.close.h).padStart(2,"0")}:${String(s.close.m).padStart(2,"0")}:00`);

  // Determine open/closed based on session-local time by comparing formatted HH:MM.
  const nowHM = fmtInTZ(now, s.tz, { hour:"2-digit", minute:"2-digit", hour12:false });
  const openHM = String(s.open.h).padStart(2,"0")+":"+String(s.open.m).padStart(2,"0");
  const closeHM = String(s.close.h).padStart(2,"0")+":"+String(s.close.m).padStart(2,"0");

  const openUser = fmtTime12(openDate, TZ_USER);
  const closeUser = fmtTime12(closeDate, TZ_USER);

  if(nowHM >= openHM && nowHM < closeHM){
    // Closes in (rough countdown)
    const mins = minutesUntil(now, closeDate);
    return { label:"Open", dot:"open", countdown:"Closes in " + humanDur(mins), openUser, closeUser };
  }

  const mins = minutesUntil(now, openDate);
  return { label:"Closed", dot:"closed", countdown:"Opens in " + humanDur(mins), openUser, closeUser };
}

function renderSessions(){
  const grid = document.getElementById("sessionsGrid");
  if(!grid) return;

  const now = new Date();
  grid.innerHTML = "";

  sessions.forEach(s => {
    const st = sessionState(now, s);
    const box = document.createElement("div");
    box.className = "session";
    box.innerHTML = `
      <div class="title">${s.title}</div>
      <div class="status"><span class="dot ${st.dot}"></span> ${st.label}</div>
      <div class="time">${st.countdown}</div>
      <div>Open: ${st.openUser} | Close: ${st.closeUser}</div>
    `;
    grid.appendChild(box);
  });
}

function renderNowPKT(){
  const el = document.getElementById("nowPtk");
  if(!el) return;
  const now = new Date();
  const t = fmtInTZ(now, TZ_PKT, { weekday:"short", month:"short", day:"2-digit", hour:"numeric", minute:"2-digit", hour12:true });
  el.textContent = t + " PKT";
}

/* -----------------------------
   News (Phase‑1 sample feed)
   - Reads /data/news.sample.json
   - Paginates + basic archive filter
-------------------------------- */

let DL_NEWS = [];
let DL_NEWS_PAGE = 1;
const DL_NEWS_PER_PAGE = 5;

function impactClass(impact){
  const v = String(impact || "").toLowerCase();
  if(v.includes("high")) return "impact-high";
  if(v.includes("med")) return "impact-med";
  return "impact-low";
}

function normalizeArchiveFilter(items){
  const picker = document.getElementById("archiveDate");
  if(!picker || !picker.value) return items;
  try{
    const d = new Date(picker.value);
    if(Number.isNaN(d.getTime())) return items;
    const key = fmtDateShort(d, TZ_PKT); // e.g., "Feb 13"
    return items.filter(it => String(it.timePKT || "").includes(key));
  }catch(e){
    return items;
  }
}

function renderNews(){
  const list = document.getElementById("newsList");
  if(!list) return;

  const items = normalizeArchiveFilter(DL_NEWS);
  const totalPages = Math.max(1, Math.ceil(items.length / DL_NEWS_PER_PAGE));
  DL_NEWS_PAGE = Math.min(DL_NEWS_PAGE, totalPages);

  const start = (DL_NEWS_PAGE - 1) * DL_NEWS_PER_PAGE;
  const page = items.slice(start, start + DL_NEWS_PER_PAGE);

  list.innerHTML = "";

  if(page.length === 0){
    list.innerHTML = `<div class="tiny muted">No items for this filter yet.</div>`;
  }else{
    page.forEach(n => {
      const card = document.createElement("div");
      card.className = "news-card";
      const sources = Array.isArray(n.sources) ? n.sources : [];
      const srcHTML = sources.map(s=>{
        const name = (s.name || "Source");
        const url = (s.url || "#");
        return `<a class="src" href="${url}" target="_blank" rel="noopener noreferrer">${name}</a>`;
      }).join(" ");

      const kps = Array.isArray(n.keyPoints) ? n.keyPoints : [];
      const kpHTML = kps.slice(0,5).map(x=>`<li>${x}</li>`).join("");

      card.innerHTML = `
        <div class="news-top">
          <div class="news-h">${n.headline || ""}</div>
          <div class="badge ${impactClass(n.impact)}">${n.impact || "Low"} impact</div>
        </div>
        <div class="news-meta tiny muted">${n.timePKT || ""}${n.session ? " • " + n.session : ""}${n.market ? " • " + n.market : ""}</div>
        <div class="news-sum">${n.summary || ""}</div>
        ${kpHTML ? `<ul class="news-kp">${kpHTML}</ul>` : ``}
        ${n.whyItMatters ? `<div class="news-why"><span class="tiny muted">Why it matters:</span> ${n.whyItMatters}</div>` : ``}
        ${srcHTML ? `<div class="news-src">${srcHTML}</div>` : ``}
      `;
      list.appendChild(card);
    });
  }

  const info = document.getElementById("pageInfo");
  if(info) info.textContent = `Page ${DL_NEWS_PAGE} / ${totalPages}`;

  const prev = document.getElementById("prevPage");
  const next = document.getElementById("nextPage");
  if(prev) prev.disabled = DL_NEWS_PAGE <= 1;
  if(next) next.disabled = DL_NEWS_PAGE >= totalPages;
}

async function loadNews(){
  try{
    const res = await fetch("data/news.sample.json", { cache:"no-store" });
    if(!res.ok) throw new Error("News feed not reachable.");
    const data = await res.json();
    DL_NEWS = Array.isArray(data) ? data : [];
  }catch(e){
    DL_NEWS = [];
  }
  DL_NEWS_PAGE = 1;
  renderNews();
}

function bindNewsUI(){
  const prev = document.getElementById("prevPage");
  const next = document.getElementById("nextPage");
  const picker = document.getElementById("archiveDate");

  if(prev) prev.addEventListener("click", ()=>{ DL_NEWS_PAGE = Math.max(1, DL_NEWS_PAGE - 1); renderNews(); });
  if(next) next.addEventListener("click", ()=>{ DL_NEWS_PAGE += 1; renderNews(); });

  if(picker) picker.addEventListener("change", ()=>{ DL_NEWS_PAGE = 1; renderNews(); });
}

/* -----------------------------
   Watchlist (Phase‑1 sample)
-------------------------------- */

const WATCH = {
  btc: [
    { sym:"BTC", name:"Bitcoin", px:"—", ch:"+0.0%" },
    { sym:"SOL", name:"Solana", px:"—", ch:"+0.0%" },
    { sym:"AVAX", name:"Avalanche", px:"—", ch:"+0.0%" },
    { sym:"MATIC", name:"Polygon", px:"—", ch:"+0.0%" },
  ],
  eth: [
    { sym:"ETH", name:"Ethereum", px:"—", ch:"+0.0%" },
    { sym:"ARB", name:"Arbitrum", px:"—", ch:"+0.0%" },
    { sym:"OP",  name:"Optimism", px:"—", ch:"+0.0%" },
    { sym:"LDO", name:"Lido", px:"—", ch:"+0.0%" },
  ],
  ind: [
    { sym:"LINK", name:"Chainlink", px:"—", ch:"+0.0%" },
    { sym:"XRP",  name:"XRP", px:"—", ch:"+0.0%" },
    { sym:"XMR",  name:"Monero", px:"—", ch:"+0.0%" },
    { sym:"TON",  name:"Toncoin", px:"—", ch:"+0.0%" },
  ]
};

let WATCH_TAB = "btc";

function renderWatch(){
  const box = document.getElementById("watchlist");
  if(!box) return;
  const items = WATCH[WATCH_TAB] || [];
  box.innerHTML = "";
  items.forEach(it=>{
    const row = document.createElement("div");
    row.className = "wrow";
    row.innerHTML = `
      <div>
        <div class="wname">${it.sym} <span class="tiny muted">${it.name}</span></div>
      </div>
      <div style="text-align:right">
        <div class="wpx">${it.px}</div>
        <div class="tiny muted">${it.ch}</div>
      </div>
    `;
    box.appendChild(row);
  });
}

function bindWatchTabs(){
  document.querySelectorAll(".tab").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      document.querySelectorAll(".tab").forEach(b=>b.classList.remove("active"));
      btn.classList.add("active");
      WATCH_TAB = btn.getAttribute("data-tab") || "btc";
      renderWatch();
    });
  });
}

/* -----------------------------
   Init
-------------------------------- */

document.addEventListener("DOMContentLoaded", async ()=>{
  renderNowPKT();
  renderSessions();
  setInterval(()=>{ renderNowPKT(); renderSessions(); }, 15000);

  bindNewsUI();
  await loadNews();

  bindWatchTabs();
  renderWatch();
});
