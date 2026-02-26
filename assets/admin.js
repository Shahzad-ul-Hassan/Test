// DecisionLens Phase-2: Admin approvals
const $ = (id) => document.getElementById(id);

function setMsg(text, ok=false){
  const el = $("msg");
  el.textContent = text;
  el.style.color = ok ? "#7ee787" : "#ff6b6b";
}


function bindPreviewButtons(){
  const setMode = (mode) => {
    try{
      if(!mode) localStorage.removeItem("DL_PREVIEW_MODE");
      else localStorage.setItem("DL_PREVIEW_MODE", mode);
    }catch(e){}
  };

  const goDash = () => window.open("dashboard.html", "_blank");

  const n = $("pvNormal");
  if(n) n.addEventListener("click", ()=>{ setMode(""); setMsg("Preview cleared. Open dashboard.", true); goDash(); });

  const g = $("pvGuest");
  if(g) g.addEventListener("click", ()=>{ setMode("guest"); setMsg("Preview: Guest (Free). Open dashboard.", true); goDash(); });

  const p = $("pvPaid");
  if(p) p.addEventListener("click", ()=>{ setMode("paid"); setMsg("Preview: Paid. Open dashboard.", true); goDash(); });

  const x = $("pvExpired");
  if(x) x.addEventListener("click", ()=>{ setMode("expired"); setMsg("Preview: Expired. Open dashboard.", true); goDash(); });
}


function requireAdmin(){
  auth.onAuthStateChanged(async (user) => {
    if(!user){
      window.location.href = "login.html";
      return;
    }
    $("who").textContent = user.email;

    let isAdmin = false;

    try{
      const uref = db.collection("users").doc(user.uid);
      const usnap = await uref.get();
      const udata = usnap.exists ? (usnap.data() || {}) : {};
      // Allow admin if role is admin OR fallback to ADMIN_EMAIL
      isAdmin = (udata.role === "admin") || (user.email === ADMIN_EMAIL);

      // If this is the ADMIN_EMAIL but role is missing, self-heal (best-effort)
      if(!usnap.exists && user.email === ADMIN_EMAIL){
        await uref.set({
          email: user.email,
          role: "admin",
          active: true,
          plan: "yearly",
          expiry: null,
          createdAt: new Date().toISOString()
        }, { merge:true });
        isAdmin = true;
      }else if(usnap.exists && user.email === ADMIN_EMAIL && udata.role !== "admin"){
        await uref.set({ role:"admin" }, { merge:true });
        isAdmin = true;
      }
    }catch(e){
      // Fallback to email-only if rules block read
      isAdmin = (user.email === ADMIN_EMAIL);
    }

    if(!isAdmin){
      setMsg("Access denied: Admin only.", false);
      setTimeout(()=>window.location.href="dashboard.html", 1200);
      return;
    }

    bindPreviewButtons();
    loadPending();
  });
}


$("btnLogout").addEventListener("click", async () => {
  await auth.signOut();
  window.location.href = "index.html";
});

function card(payId, p){
  const div = document.createElement("div");
  div.className = "admin-card";
  div.innerHTML = `
    <div class="admin-row">
      <div>
        <div class="mono">${p.email}</div>
        <div class="tiny muted">Plan: ${p.plan} • ${p.network}</div>
        <div class="tiny muted">Tx: <span class="mono">${p.txHash}</span></div>
        <div class="tiny muted">Submitted: ${p.createdAt || ""}</div>
      </div>
      <div class="admin-actions">
        <button class="btn btn-primary small" data-approve="${payId}">Approve</button>
        <button class="btn ghost small" data-reject="${payId}">Reject</button>
      </div>
    </div>
  `;
  return div;
}

async function loadPending(){
  $("list").innerHTML = "";
  setMsg("Loading pending submissions…", true);

  try{
    const snap = await db.collection("payments").where("status","==","pending").get();
    if(snap.empty){
      setMsg("No pending payments.", true);
      return;
    }

    setMsg("Pending payments loaded.", true);
    snap.forEach(doc => {
      const p = doc.data();
      $("list").appendChild(card(doc.id, p));
    });

    document.querySelectorAll("[data-approve]").forEach(btn=>{
      btn.addEventListener("click", async ()=> approve(btn.getAttribute("data-approve")));
    });
    document.querySelectorAll("[data-reject]").forEach(btn=>{
      btn.addEventListener("click", async ()=> reject(btn.getAttribute("data-reject")));
    });

  }catch(e){
    setMsg(e.message || "Failed to load.", false);
  }
}

function addDays(days){
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

async function approve(payId){
  setMsg("Approving…", true);
  const ref = db.collection("payments").doc(payId);
  const doc = await ref.get();
  if(!doc.exists) return setMsg("Not found.", false);

  const p = doc.data();
  const expiry = (p.plan === "yearly") ? addDays(365) : addDays(31);

  try{
    await ref.update({ status:"approved", approvedAt:new Date().toISOString() });
    await db.collection("users").doc(p.uid).set({
      email: p.email,
      active: true,
      plan: p.plan,
      expiry
    }, { merge:true });

    setMsg("Approved. User activated.", true);
    loadPending();
  }catch(e){
    setMsg(e.message || "Approve failed.", false);
  }
}

async function reject(payId){
  setMsg("Rejecting…", true);
  try{
    await db.collection("payments").doc(payId).update({ status:"rejected", rejectedAt:new Date().toISOString() });
    setMsg("Rejected.", true);
    loadPending();
  }catch(e){
    setMsg(e.message || "Reject failed.", false);
  }
}

requireAdmin();
