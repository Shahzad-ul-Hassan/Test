// DecisionLens Phase-2: Subscription submission (manual verification)
const $ = (id) => document.getElementById(id);

function setMsg(text, ok=false){
  const el = $("msg");
  el.textContent = text;
  el.style.color = ok ? "#7ee787" : "#ff6b6b";
}

function requireAuth(){
  auth.onAuthStateChanged((user) => {
    if(!user){
      window.location.href = "login.html";
      return;
    }
    $("who").textContent = user.email;
  });
}

$("btnLogout").addEventListener("click", async () => {
  await auth.signOut();
  window.location.href = "index.html";
});

$("btnSubmit").addEventListener("click", async () => {
  const user = auth.currentUser;
  if(!user) return setMsg("Please login first.");

  const plan = $("plan").value;
  const txHash = $("tx").value.trim();

  if(txHash.length < 12) return setMsg("Please paste a valid transaction hash (TxID).");

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
    $("tx").value = "";
  }catch(e){
    setMsg(e.message || "Submission failed.");
  }
});

requireAuth();
