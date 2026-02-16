/* DecisionLens Phase-1 Static JS
   - Sessions (5) with PKT conversion + countdown
   - Paid locks modal (Phase-1)
   - News rendering from /data/news.sample.json (pagination 15/page)
   - Watchlist sample tabs (refresh hook ready)
*/

const TZ_PAK = "Asia/Karachi";

function fmtInTZ(date, timeZone, opts){
  return new Intl.DateTimeFormat("en-US", { timeZone, ...opts }).format(date);
}
function pad2(n){ return String(n).padStart(2,"0"); }
function fmtTime12(date, timeZone){
  return fmtInTZ(date, timeZone, { hour:"numeric", minute:"2-digit", hour12:true });
}
function fmtDateTimePKT(date){
  const d = fmtInTZ(date, TZ_PAK, { year:"numeric", month:"short", day:"2-digit" });
  const t = fmtInTZ(date, TZ_PAK, { hour:"numeric", minute:"2-digit", hour12:true });
  return `${d} • ${t} PKT`;
}
function minutesUntil(a, b){ // a->b
  const ms = b.getTime() - a.getTime();
  return Math.floor(ms / 60000);
}
function humanDur(mins){
  const m = Math.max(0, mins);
  const h = Math.floor(m/60);
  const r = m%60;
  if(h<=0) return `${r}m`;
  return `${h}h ${r}m`;
}

/* --- Session schedule definitions ---
   We define each market in its LOCAL timezone with local open/close hours.
   This is DST-safe because conversion uses IANA timezones.
*/
const sessions = [
  {
    key:"syd",
    title:"Sydney",
    country:"Australia",
    tz:"Australia/Sydney",
    open:{h:10,m:0},    // ASX approx 10:00
    close:{h:16,m:0},
    focus:"Volatility: Medium | Focus: AU/Asia open, risk tone"
  },
  {
    key:"tok",
    title:"Tokyo",
    country:"Japan",
    tz:"Asia/Tokyo",
    open:{h:9,m:0},
    close:{h:15,m:0},
    focus:"Volatility: Medium | Focus: JPY flows, Asia liquidity"
  },
  {
    key:"lon",
    title:"London",
    country:"UK",
    tz:"Europe/London",
    open:{h:8,m:0},
    close:{h:16,m:30},
    focus:"Volatility: High | Focus: FX, macro, risk repricing"
  },
  {
    key:"ny",
    title:"New York",
    country:"USA",
    tz:"America/New_York",
    open:{h:9,m:30},
    close:{h:16,m:0},
    focus:"Volatility: High | Focus: US data, Wall St, ETFs"
  },
  {
    key:"crypto",
    title:"Crypto",
    country:"24/7",
    tz:"UTC",
    open:null,
    close:null,
    focus:"Volatility: Varies | Focus: On-chain, funding, narratives"
  },
];

function getNow(){ return new Date(); }

function dateInMarketTZ(now, marketTZ){
  // Create a Date object representing "now" but we'll compute components in marketTZ.
  // We use Intl parts for marketTZ and then reconstruct UTC date.
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: marketTZ,
    year:"numeric", month:"2-digit", day:"2-digit",
    hour:"2-digit", minute:"2-digit", second:"2-digit", hour12:false
  }).formatToParts(now).reduce((acc,p)=>{ acc[p.type]=p.value; return acc; }, {});
  return {
    y: Number(parts.year),
    mo: Number(parts.month),
    d: Number(parts.day),
    hh: Number(parts.hour),
    mm: Number(parts.minute),
    ss: Number(parts.second)
  };
}

function toDateInTZ(y, mo, d, hh, mm, tz){
  // Build a Date corresponding to the given local time in tz by formatting and parsing via Intl trick:
  // Approach: create a Date from UTC components then adjust using timezone offset derived from formatting.
  const utcGuess = new Date(Date.UTC(y, mo-1, d, hh, mm, 0));
  // Find the tz offset at that moment: compare formatted parts vs UTC parts.
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, year:"numeric", month:"2-digit", day:"2-digit",
    hour:"2-digit", minute:"2-digit", second:"2-digit", hour12:false
  }).formatToParts(utcGuess).reduce((acc,p)=>{ acc[p.type]=p.value; return acc; }, {});
  const asUTC = Date.UTC(
    Number(parts.year), Number(parts.month)-1, Number(parts.day),
    Number(parts.hour), Number(parts.minute), Number(parts.second)
  );
  const offsetMs = asUTC - utcGuess.getTime();
  return new Date(utcGuess.getTime() - offsetMs);
}

function sessionState(now, s){
  if(s.key==="crypto"){
    return {
      state:"open",
      label:"Open",
      dot:"open",
      countdown:"24/7",
      openPKT:"—",
      closePKT:"—"
    };
  }
  const p = dateInMarketTZ(now, s.tz);

  const openDate = toDateInTZ(p.y, p.mo, p.d, s.open.h, s.open.m, s.tz);
  const closeDate = toDateInTZ(p.y, p.mo, p.d, s.close.h, s.close.m, s.tz);

  let state="closed";
  let label="Closed";
  let dot="closed";
  let countdown="";
  const preOpenStart = new Date(openDate.getTime() - 60*60000);

  if(now >= openDate && now < closeDate){
    state="open"; label="Open"; dot="open";
    countdown = `Closes in ${humanDur(minutesUntil(now, closeDate))}`;
  }else if(now >= preOpenStart && now < openDate){
    state="pre"; label="Pre‑Open"; dot="pre";
    countdown = `Opens in ${humanDur(minutesUntil(now, openDate))}`;
  }else{
    // Next open is tomorrow
    const nextDay = new Date(openDate.getTime() + 24*60*60000);
    const nextOpen = nextDay;
    countdown = `Opens in ${humanDur(minutesUntil(now, nextOpen))}`;
  }

  return {
    state, label, dot, countdown,
    openPKT: fmtTime12(openDate, TZ_PAK),
    closePKT: fmtTime12(closeDate, TZ_PAK)
  };
}

function renderSessions(){
  const grid = document.getElementById("sessionsGrid");
  if(!grid) return;

  const now = getNow();
  const nowEl = document.getElementById("nowPtk");
  if(nowEl) nowEl.textContent = `Now: ${fmtDateTimePKT(now)}`;

  // Order by next opening time (approx): compute next open moment for each.
  const scored = sessions.map(s=>{
    if(s.key==="crypto") return {s, score: Infinity};
    const p = dateInMarketTZ(now, s.tz);
    const openDate = toDateInTZ(p.y, p.mo, p.d, s.open.h, s.open.m, s.tz);
    let nextOpen = openDate;
    if(now >= openDate) nextOpen = new Date(openDate.getTime()+24*60*60000);
    const mins = minutesUntil(now, nextOpen);
    return {s, score: mins};
  }).sort((a,b)=>a.score-b.score);

  grid.innerHTML = "";
  scored.forEach(({s})=>{
    const st = sessionState(now, s);
    const box = document.createElement("div");
    box.className = "session";
    box.innerHTML = `
      <div class="title">${s.title}</div>
      <div class="sub">${s.country === "USA" ? "US" : s.country === "UK" ? "UK" : s.country}</div>
      <div class="status"><span class="dot ${st.dot}"></span> ${st.label}</div>
      <div class="time">${st.countdown}</div>
      <div class="meta">
        <div>Open: <span class="mono">${st.openPKT}</span> • Close: <span class="mono">${st.closePKT}</span></div>
        <div>${s.focus}</div>
      </div>
    `;
    grid.appendChild(box);
  });
}

/* ---- Paid locks modal ---- */
function initLocks(){
  const modal = document.getElementById("lockModal");
  if(!modal) return;

  const title = document.getElementById("lockTitle");

  document.querySelectorAll("[data-locked]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      title.textContent = btn.getAttribute("data-locked") || "Premium panel";
      modal.setAttribute("aria-hidden","false");
    });
  });

  modal.querySelectorAll("[data-close]").forEach(el=>{
    el.addEventListener("click", ()=>{
      modal.setAttribute("aria-hidden","true");
    });
  });
}

/* ---- News rendering ---- */
let NEWS = [];
let page = 1;
const pageSize = 15;

function formatMeta(n){
  // Meta line: Impact | Market | Session | Date & Time
  const impact = (n.impact || "Low");
  const market = (n.market || "Crypto");
  const session = (n.session || "—");
  const when = (n.timePKT || "—");
  return { impact, market, session, when };
}

function renderNews(){
  const list = document.getElementById("newsList");
  if(!list) return;

  const info = document.getElementById("pageInfo");
  const totalPages = Math.max(1, Math.ceil(NEWS.length / pageSize));
  page = Math.min(Math.max(1, page), totalPages);

  const start = (page-1)*pageSize;
  const slice = NEWS.slice(start, start+pageSize);

  if(info) info.textContent = `Page ${page} / ${totalPages} • ${NEWS.length} items`;

  list.innerHTML = "";
  if(slice.length === 0){
    list.innerHTML = `<div class="news-card"><div class="news-h">No news for this view.</div><div class="news-sum">Try another archive date.</div></div>`;
    return;
  }

  slice.forEach(n=>{
    const m = formatMeta(n);
    const card = document.createElement("div");
    card.className = "news-card";

    const kp = (n.keyPoints || []).slice(0,5).map(x=>`<li>${escapeHtml(x)}</li>`).join("");
    const srcs = (n.sources || []).slice(0,3).map(s=>`<a href="${escapeAttr(s.url)}" target="_blank" rel="noreferrer">${escapeHtml(s.name || "Source")}</a>`).join("");

    card.innerHTML = `
      <div class="news-h">${escapeHtml(n.headline || "")}</div>
      <div class="news-meta">
        <span class="badge impact-low">Impact: ${escapeHtml(m.impact)}</span>
        <span class="badge">Market: ${escapeHtml(m.market)}</span>
        <span class="badge">Session: ${escapeHtml(m.session)}</span>
        <span class="badge">${escapeHtml(m.when)}</span>
      </div>
      <div class="news-sum">${escapeHtml(n.summary || "")}</div>
      <ul class="news-kp">${kp}</ul>
      <div class="news-why"><strong>Why it matters:</strong> ${escapeHtml(n.whyItMatters || "")}</div>
      <div class="news-src">${srcs}</div>
    `;
    list.appendChild(card);
  });
}

function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, s=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[s]));
}
function escapeAttr(str){ return escapeHtml(str).replace(/"/g,"&quot;"); }

async function loadNews(){
  try{
    const res = await fetch("data/news.sample.json", { cache:"no-store" });
    if(!res.ok) throw new Error("news fetch failed");
    NEWS = await res.json();
  }catch(e){
    NEWS = [];
  }
  page = 1;
  renderNews();
}

function initNewsControls(){
  const prev = document.getElementById("prevPage");
  const next = document.getElementById("nextPage");
  const date = document.getElementById("archiveDate");

  if(prev) prev.addEventListener("click", ()=>{ page--; renderNews(); });
  if(next) next.addEventListener("click", ()=>{ page++; renderNews(); });

  if(date){
    date.addEventListener("change", ()=>{
      // Phase-1: archive is a UI hook only (calendar-ready). In real build, this would load date-specific news.
      // For now, we simply reset to first page.
      page = 1;
      renderNews();
    });
  }
}

/* ---- Watchlist sample ---- */
const watchlistData = {
  btc: [
    { sym:"SOL", name:"Solana", price: 102.42, chg: 1.9 },
    { sym:"AVAX", name:"Avalanche", price: 34.18, chg: -0.8 },
    { sym:"DOGE", name:"Dogecoin", price: 0.0812, chg: 0.4 },
  ],
  eth: [
    { sym:"ARB", name:"Arbitrum", price: 1.12, chg: -1.6 },
    { sym:"OP", name:"Optimism", price: 2.58, chg: 0.9 },
    { sym:"LDO", name:"Lido", price: 2.11, chg: 0.2 },
  ],
  ind: [
    { sym:"LINK", name:"Chainlink", price: 17.92, chg: 0.6 },
    { sym:"RNDR", name:"Render", price: 7.48, chg: -0.3 },
  ]
};

let activeTab = "btc";

function renderWatchlist(){
  const el = document.getElementById("watchlist");
  if(!el) return;

  const rows = watchlistData[activeTab] || [];
  el.innerHTML = "";

  if(rows.length === 0){
    el.innerHTML = `<div class="tiny muted">No symbols in this list yet.</div>`;
    return;
  }

  rows.forEach(r=>{
    const row = document.createElement("div");
    row.className = "wrow";
    const chgClass = r.chg >= 0 ? "chgpos" : "chgneg";
    const sign = r.chg >= 0 ? "+" : "";
    row.innerHTML = `
      <div class="wleft">
        <div class="wsym">${escapeHtml(r.sym)}</div>
        <div class="wname">${escapeHtml(r.name)}</div>
      </div>
      <div class="wright">
        <div class="wprice">${escapeHtml(r.price)}</div>
        <div class="wchg ${chgClass}">${sign}${escapeHtml(r.chg)}%</div>
      </div>
    `;
    el.appendChild(row);
  });
}

function initTabs(){
  const tabs = document.querySelectorAll(".tab");
  if(!tabs.length) return;

  tabs.forEach(t=>{
    t.addEventListener("click", ()=>{
      tabs.forEach(x=>x.classList.remove("active"));
      t.classList.add("active");
      activeTab = t.getAttribute("data-tab") || "btc";
      renderWatchlist();
    });
  });
}

/* ---- Refresh hooks ---- */
function tick(){
  renderSessions();
}
function start(){
  renderSessions();
  initLocks();

  loadNews();
  initNewsControls();

  initTabs();
  renderWatchlist();

  // Session countdown updates every 15 seconds
  setInterval(tick, 15000);

  // Watchlist refresh hook (Phase-1 sample)
  // In real build, replace with API poll (60s).
  setInterval(()=>{ /* placeholder */ }, 60000);
}
document.addEventListener("DOMContentLoaded", start);
