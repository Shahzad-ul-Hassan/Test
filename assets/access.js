// DecisionLens Phase-2: Dashboard Access Control (Firebase)
// - Requires login to view dashboard
// - Reads /users/{uid} to determine paid access (active + expiry)
// - Updates UI + handles premium clicks

window.DL_ACCESS = { paid:false, plan:null, expiry:null, email:null };

const $ = (id) => document.getElementById(id);

function nowISO(){ return new Date().toISOString(); }

function isExpired(expiryISO){
  if(!expiryISO) return false;
  try{
    return new Date() > new Date(expiryISO);
  }catch(e){
    return false;
  }
}

function setStatus(text, ok=true){
  const el = $("dlStatus");
  if(!el) return;
  el.textContent = text;
  el.style.color = ok ? "" : "#ff6b6b";
}

function openPremiumModal(title, body, showSubscribe=true){
  const modal = $("premiumModal");
  if(!modal) return;
  $("pmTitle").textContent = title || "Premium";
  $("pmBody").textContent = body || "";
  const link = $("pmSubscribeLink");
  if(link) link.style.display = showSubscribe ? "inline-flex" : "none";
  modal.setAttribute("aria-hidden","false");
}

function closePremiumModal(){
  const modal = $("premiumModal");
  if(!modal) return;
  modal.setAttribute("aria-hidden","true");
}

function bindModal(){
  const modal = $("premiumModal");
  if(!modal) return;
  modal.querySelectorAll("[data-close]").forEach(el=>{
    el.addEventListener("click", closePremiumModal);
  });
}

window.DL_handlePremiumClick = function(panelName){
  const paid = !!window.DL_ACCESS.paid;
  if(!paid){
    openPremiumModal(
      "Premium (Locked)",
      "This panel is available for subscribers only. Submit your USDT (TRC20) TxID and get manual approval to unlock.",
      true
    );
    return;
  }

  // Paid: panel is unlocked, but feature data will be connected in Phase-3+
  openPremiumModal(
    "Premium (Unlocked)",
    (panelName ? panelName + " is unlocked. " : "") + "Data wiring will be added next. For now, access is confirmed.",
    false
  );
};

async function loadAccess(uid, email){
  // default unpaid
  window.DL_ACCESS = { paid:false, plan:null, expiry:null, email };

  try{
    const doc = await db.collection("users").doc(uid).get();
    if(doc.exists){
      const d = doc.data() || {};
      const expired = isExpired(d.expiry);
      const paid = !!d.active && !expired;
      window.DL_ACCESS = { paid, plan:d.plan || null, expiry:d.expiry || null, email };

      if(paid){
        setStatus(`Active • ${d.plan === "yearly" ? "Yearly" : "Monthly"}${d.expiry ? " • until " + new Date(d.expiry).toLocaleDateString() : ""}`);
        const sb = $("dlSubscribeBtn");
        if(sb) sb.style.display = "none";
      }else{
        const why = expired ? "Expired" : "Not active";
        setStatus(`Free view • ${why}`, false);
        const sb = $("dlSubscribeBtn");
        if(sb) sb.style.display = "inline-flex";
      }
    }else{
      setStatus("Free view • Not subscribed", false);
      const sb = $("dlSubscribeBtn");
      if(sb) sb.style.display = "inline-flex";
    }

    // Update premium header text
    const premMuted = document.querySelector(".locked-grid")?.closest(".card")?.querySelector(".tiny.muted");
    if(premMuted){
      premMuted.textContent = window.DL_ACCESS.paid ? "Unlocked for your account." : "Visible but locked until subscription approval.";
    }

  }catch(e){
    setStatus("Access check failed (Firestore).", false);
    const sb = $("dlSubscribeBtn");
    if(sb) sb.style.display = "inline-flex";
  }
}

function bindLogout(){
  const btn = $("dlLogoutBtn");
  if(!btn) return;
  btn.addEventListener("click", async ()=>{
    try{ await auth.signOut(); }catch(e){}
    window.location.href = "login.html";
  });
}

function attachPremiumHandlers(){
  document.querySelectorAll(".locked-card").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const name = btn.getAttribute("data-locked") || btn.querySelector(".locked-title")?.textContent || "Premium Panel";
      window.DL_handlePremiumClick(name);
    });
  });
}

function requireAuth(){
  auth.onAuthStateChanged(async (user)=>{
    bindModal();
    attachPremiumHandlers();
    bindLogout();

    if(!user){
      // Free (guest) access: allow Phase-1 panels.
      window.DL_ACCESS.paid = false;
      window.DL_ACCESS.plan = null;
      window.DL_ACCESS.expiry = null;
      window.DL_ACCESS.email = null;

      const s = $("dlStatus");
      if(s) s.textContent = "Free";
      const u = $("dlUser");
      if(u) u.textContent = "";

      // Show subscribe/login entry point (optional)
      const sub = $("dlSubscribeBtn");
      if(sub){
        sub.style.display = "";
        sub.textContent = "Login";
        sub.onclick = ()=> window.location.href = "login.html";
      }
      const lo = $("dlLogoutBtn");
      if(lo) lo.style.display = "none";

      // Keep premium panels locked for guests
      setPaidUI(false);
      return;
    }

    const u = $("dlUser");
    if(u) u.textContent = user.email || "";

    const lo = $("dlLogoutBtn");
    if(lo) lo.style.display = "inline-flex";

    await loadAccess(user.uid, user.email || "");
  });
}

document.addEventListener("DOMContentLoaded", requireAuth);
