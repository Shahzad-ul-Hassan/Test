// DecisionLens Phase-2: Subscription submission (manual verification)
const $ = (id) => document.getElementById(id);

function setMsg(text, ok=false){
  const el = $("msg");
  if(!el) return;
  el.textContent = text;
  el.style.color = ok ? "#7ee787" : "#ff6b6b";
}

function setCopyMsg(text, ok=false){
  const el = $("copyMsg");
  if(!el) return;
  el.textContent = text;
  el.style.color = ok ? "#7ee787" : "#ff6b6b";
}

function bindUI(){
  const btnLogout = $("btnLogout");
  if(btnLogout){
    btnLogout.addEventListener("click", async () => {
      try{ await auth.signOut(); }catch(e){}
      window.location.href = "login.html";
    });
  }

  const btnCopy = $("btnCopyAddr");
  if(btnCopy){
    btnCopy.addEventListener("click", async () => {
      const addr = ($("walletBox")?.textContent || "").trim();
      try{
        await navigator.clipboard.writeText(addr);
        setCopyMsg("Copied.", true);
        setTimeout(()=>setCopyMsg(""), 1500);
      }catch(e){
        setCopyMsg("Copy failed. Select and copy manually.", false);
      }
    });
  }

  const btnSubmit = $("btnSubmit");
  if(btnSubmit){
    btnSubmit.addEventListener("click", submitPayment);
  }
}

function requireAuth(){
  auth.onAuthStateChanged((user) => {
    const who = $("who");
    const btnLogin = $("btnLogin");
    const btnLogout = $("btnLogout");

    if(!user){
      if(who) who.textContent = "Not logged in";
      if(btnLogin) btnLogin.style.display = "inline-flex";
      if(btnLogout) btnLogout.style.display = "none";
      return;
    }

    if(who) who.textContent = user.email;
    if(btnLogin) btnLogin.style.display = "none";
    if(btnLogout) btnLogout.style.display = "inline-flex";
  });
}

async function submitPayment(){
  const user = auth.currentUser;
  if(!user) return setMsg("Please login first.", false);

  const plan = ($("plan")?.value || "monthly");
  const txHash = ($("tx")?.value || "").trim();

  if(txHash.length < 12) return setMsg("Please paste a valid transaction hash (TxID).", false);

  const payload = {
    uid: user.uid,
    email: user.email,
    plan,
    network: "USDT-TRC20",
    txHash,
    status: "pending",
    createdAt: new Date().toISOString()
  };

  try{
    await db.collection("payments").add(payload);
    setMsg("Submitted. Verification pending. You will be activated after approval.", true);
    if($("tx")) $("tx").value = "";
  }catch(e){
    setMsg(e?.message || "Submission failed.", false);
  }
}

document.addEventListener("DOMContentLoaded", ()=>{
  bindUI();
  requireAuth();
});
