/* DecisionLens Dashboard JS (Phase-2)
   - Renders Market Sessions with weekend rules (forex/stocks closed Sat/Sun)
   - Premium clicks handled by assets/access.js (DL_handlePremiumClick)
*/

const TZ_USER = Intl.DateTimeFormat().resolvedOptions().timeZone;

function fmtInTZ(date, timeZone, opts){
  return new Intl.DateTimeFormat("en-US", { timeZone, ...opts }).format(date);
}
function fmtTime12(date, timeZone){
  return fmtInTZ(date, timeZone, { hour:"numeric", minute:"2-digit", hour12:true });
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
  if(isWeekend(now, s.tz)){
    return { label:"Closed (Weekend)", dot:"closed", countdown:"Opens Monday", openUser:"—", closeUser:"—" };
  }
  const openDate = new Date(now); openDate.setHours(s.open.h, s.open.m, 0, 0);
  const closeDate = new Date(now); closeDate.setHours(s.close.h, s.close.m, 0, 0);

  if(now >= openDate && now < closeDate){
    return {
      label:"Open",
      dot:"open",
      countdown:"Closes in " + humanDur(minutesUntil(now, closeDate)),
      openUser: fmtTime12(openDate, TZ_USER),
      closeUser: fmtTime12(closeDate, TZ_USER)
    };
  }
  return {
    label:"Closed",
    dot:"closed",
    countdown:"Opens in " + humanDur(minutesUntil(now, openDate)),
    openUser: fmtTime12(openDate, TZ_USER),
    closeUser: fmtTime12(closeDate, TZ_USER)
  };
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


// -------------------------------
// Phase-1 FREE: News + Watchlist
// -------------------------------
let DL_NEWS = [];
let DL_NEWS_PAGE = 1;
const DL_NEWS_PER_PAGE = 5;

function qs(sel){ return document.querySelector(sel); }

function escapeHtml(s){
  return String(s ?? "").replace(/[&<>"']/g, (c)=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
}

function impactClass(impact){
  const v = String(impact||"").toLowerCase();
  if(v.includes("high")) return "impact-high";
  if(v.includes("med")) return "impact-med";
  return "impact-low";
}

function renderNews(){
  const list = document.getElementById("newsList");
  const pageInfo = document.getElementById("pageInfo");
  if(!list) return;

  if(!Array.isArray(DL_NEWS) || DL_NEWS.length===0){
    list.innerHTML = `<div class="tiny muted">No news items available.</div>`;
    if(pageInfo) pageInfo.textContent = "";
    return;
  }

  const totalPages = Math.max(1, Math.ceil(DL_NEWS.length / DL_NEWS_PER_PAGE));
  DL_NEWS_PAGE = Math.min(Math.max(1, DL_NEWS_PAGE), totalPages);

  const start = (DL_NEWS_PAGE-1) * DL_NEWS_PER_PAGE;
  const items = DL_NEWS.slice(start, start + DL_NEWS_PER_PAGE);

  if(pageInfo) pageInfo.textContent = `Page ${DL_NEWS_PAGE} / ${totalPages}`;

  list.innerHTML = items.map((n)=>{
    const headline = escapeHtml(n.headline);
    const meta = [n.market, n.session, n.timePKT].filter(Boolean).map(escapeHtml).join(" • ");
    const summary = escapeHtml(n.summary);
    const why = escapeHtml(n.whyItMatters);
    const srcText = escapeHtml(n.source?.name || n.source || "Source");
    const srcUrl = escapeHtml(n.source?.url || "");
    const kp = Array.isArray(n.keyPoints) ? n.keyPoints : [];
    const kpHtml = kp.slice(0,6).map(p=>`<li>${escapeHtml(p)}</li>`).join("");
    const impact = escapeHtml(n.impact || "Low");
    return `
      <div class="news-item">
        <div class="news-head">
          <div class="news-title">${headline}</div>
          <span class="badge ${impactClass(impact)}">${impact}</span>
        </div>
        <div class="tiny muted mt6">${meta}</div>
        <div class="news-body mt10">${summary}</div>
        ${kpHtml ? `<ul class="news-kp mt10">${kpHtml}</ul>` : ``}
        ${why ? `<div class="news-why mt10"><span class="tiny muted">Why it matters:</span> ${why}</div>` : ``}
        <div class="news-src mt10 tiny">
          ${srcUrl ? `<a href="${srcUrl}" target="_blank" rel="noopener noreferrer">${srcText}</a>` : srcText}
        </div>
      </div>
    `;
  }).join("");
}

async function loadNews(){
  try{
    const res = await fetch("data/news.sample.json", { cache: "no-store" });
    if(!res.ok) throw new Error(`News fetch failed (${res.status})`);
    const data = await res.json();
    DL_NEWS = Array.isArray(data) ? data : [];
  }catch(e){
    DL_NEWS = [];
    console.warn("DecisionLens: news load error:", e);
  }
  DL_NEWS_PAGE = 1;
  renderNews();
}

function bindNewsControls(){
  const prev = document.getElementById("prevPage");
  const next = document.getElementById("nextPage");
  const archive = document.getElementById("archiveDate");

  if(prev) prev.addEventListener("click", ()=>{
    DL_NEWS_PAGE = Math.max(1, DL_NEWS_PAGE-1);
    renderNews();
  });
  if(next) next.addEventListener("click", ()=>{
    const totalPages = Math.max(1, Math.ceil((DL_NEWS?.length||0)/DL_NEWS_PER_PAGE));
    DL_NEWS_PAGE = Math.min(totalPages, DL_NEWS_PAGE+1);
    renderNews();
  });

  // Archive hook (Phase-1 sample): keep UI responsive even if sample data has no exact ISO dates
  if(archive){
    archive.addEventListener("change", ()=>{
      // Future: filter by selected date once real news has ISO timestamps
      renderNews();
    });
  }
}

function initWatchlist(){
  const el = document.getElementById("watchlist");
  if(!el) return;

  const data = {
    btc: [
      { symbol:"BTC", note:"Benchmark / liquidity anchor" },
      { symbol:"SOL", note:"High beta proxy" },
      { symbol:"AVAX", note:"Volatility follower" },
      { symbol:"ARB", note:"Risk-on rotation watch" },
    ],
    eth: [
      { symbol:"ETH", note:"Fee + L2 ecosystem proxy" },
      { symbol:"OP", note:"L2 rotation watch" },
      { symbol:"LDO", note:"Staking narrative proxy" },
      { symbol:"ENS", note:"Speculative follower" },
    ],
    ind: [
      { symbol:"LINK", note:"Independent narrative cycles" },
      { symbol:"RUNE", note:"Liquidity-driven spikes possible" },
      { symbol:"GMX", note:"Perps sentiment proxy" },
      { symbol:"TIA", note:"New supply / unlock awareness" },
    ],
  };

  function renderTab(key){
    const items = data[key] || [];
    el.innerHTML = items.map(x=>`
      <div class="wl-item">
        <div class="wl-sym">${escapeHtml(x.symbol)}</div>
        <div class="wl-note tiny muted">${escapeHtml(x.note)}</div>
      </div>
    `).join("") || `<div class="tiny muted">No items.</div>`;
  }

  const tabs = document.querySelectorAll(".tab");
  if(tabs && tabs.length){
    tabs.forEach(t=>{
      t.addEventListener("click", ()=>{
        tabs.forEach(a=>a.classList.remove("active"));
        t.classList.add("active");
        renderTab(t.getAttribute("data-tab"));
      });
    });
  }
  renderTab("btc");
}


document.addEventListener("DOMContentLoaded", ()=>{
  renderSessions();
  setInterval(renderSessions, 15000);
  bindNewsControls();
  loadNews();
  initWatchlist();
});
