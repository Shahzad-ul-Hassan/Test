/* DecisionLens Phase-2 Updated JS
   - Weekend close rule for Forex/Stock sessions
   - Crypto remains 24/7
   - Paid locks modal active
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
    return {
      label:"Closed (Weekend)",
      dot:"closed",
      countdown:"Opens Monday",
      openUser:"—",
      closeUser:"—"
    };
  }

  const openDate = new Date(now);
  openDate.setHours(s.open.h, s.open.m, 0, 0);

  const closeDate = new Date(now);
  closeDate.setHours(s.close.h, s.close.m, 0, 0);

  if(now >= openDate && now < closeDate){
    return {
      label:"Open",
      dot:"open",
      countdown:"Closes in " + humanDur(minutesUntil(now, closeDate)),
      openUser: fmtTime12(openDate, TZ_USER),
      closeUser: fmtTime12(closeDate, TZ_USER)
    };
  } else {
    return {
      label:"Closed",
      dot:"closed",
      countdown:"Opens in " + humanDur(minutesUntil(now, openDate)),
      openUser: fmtTime12(openDate, TZ_USER),
      closeUser: fmtTime12(closeDate, TZ_USER)
    };
  }
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

function initLocks(){
  const modal = document.getElementById("lockModal");
  if(!modal) return;

  document.querySelectorAll(".locked-card").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      modal.setAttribute("aria-hidden","false");
    });
  });

  modal.querySelectorAll("[data-close]").forEach(el=>{
    el.addEventListener("click", ()=>{
      modal.setAttribute("aria-hidden","true");
    });
  });
}

document.addEventListener("DOMContentLoaded", ()=>{
  renderSessions();
  initLocks();
  setInterval(renderSessions, 15000);
});
