import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";

const app = getApp();
const auth = getAuth(app);
const db = getFirestore(app);

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  try {
    const usersSnapshot = await getDocs(collection(db, "users"));

    let total = 0;
    let active = 0;
    let expired = 0;
    let admins = 0;

    const now = Date.now();
    let tableRows = "";

    usersSnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      total++;

      if (data.role === "admin") admins++;

      if (data.active === true) {
        const expMs =
          data.expiry && data.expiry.toMillis ? data.expiry.toMillis() : null;

        if (expMs && expMs < now) expired++;
        else active++;
      }

      tableRows += `
        <tr>
          <td>${data.email || ""}</td>
          <td>${data.role || "user"}</td>
          <td>${data.active ? "Active" : "Inactive"}</td>
          <td>${data.plan || "-"}</td>
          <td>${
            data.expiry && data.expiry.toDate
              ? data.expiry.toDate().toLocaleDateString()
              : "-"
          }</td>
        </tr>
      `;
    });

    document.getElementById("admin-content").innerHTML = `
      <h2>System Overview</h2>
      <div style="display:flex; gap:20px; margin-bottom:30px;">
        <div>Total Users: <strong>${total}</strong></div>
        <div>Active Paid: <strong>${active}</strong></div>
        <div>Expired: <strong>${expired}</strong></div>
        <div>Admins: <strong>${admins}</strong></div>
      </div>

      <h2>User Management</h2>
      <table border="1" cellpadding="8" cellspacing="0" width="100%">
        <thead>
          <tr>
            <th>Email</th>
            <th>Role</th>
            <th>Status</th>
            <th>Plan</th>
            <th>Expiry</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
    `;
  } catch (error) {
    console.error("Admin load error:", error);
    document.getElementById("admin-content").innerHTML =
      `<p style="color:red;">Error loading users. Check console.</p>`;
  }
});
