// DecisionLens Phase-2: Admin approvals
const $ = (id) => document.getElementById(id);

function setMsg(text, ok=false){
  const el = $("msg");
  el.textContent = text;
  el.style.color = ok ? "#7ee787" : "#ff6b6b";
}

function requireAdmin(){
  auth.onAuthStateChanged(async (user) => {
    if(!user){
      window.location.href = "login.html";
      return;
    }
    $("who").textContent = user.email;

    if(user.email !== ADMIN_EMAIL){
      setMsg("Access denied: Admin only.", false);
      setTimeout(()=>window.location.href="dashboard.html", 1200);
      return;
    }
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
