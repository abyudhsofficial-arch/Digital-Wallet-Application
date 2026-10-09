const STORAGE = { user: "novapay_user", balance: "novapay_balance", transactions: "novapay_transactions", notifications: "novapay_notifications" };
const money = n => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(Number(n) || 0);
const read = (key, fallback) => { try { const v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); } catch { return fallback; } };
const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));
const getBalance = () => Number(read(STORAGE.balance, 10000));
const getTransactions = () => read(STORAGE.transactions, []);
const getNotifications = () => read(STORAGE.notifications, []);
function notify(title, message) {
  const items = getNotifications(); items.unshift({ title, message, date: new Date().toISOString() }); write(STORAGE.notifications, items.slice(0, 50));
}
function addTransaction({ title, detail, amount, type }) {
  const items = getTransactions(); items.unshift({ id: Date.now(), title, detail, amount: Number(amount), type, date: new Date().toISOString(), status: "Completed (demo)" }); write(STORAGE.transactions, items.slice(0, 100));
}
function setBalance(value) { write(STORAGE.balance, Math.round(value * 100) / 100); }
function currentUser() { return read(STORAGE.user, null); }
function requireUser() {
  if (!currentUser()) { window.location.href = "login.html"; return false; }
  return true;
}
function updateProfile() {
  const user = currentUser(); if (!user) return;
  document.querySelectorAll("#sidebarName").forEach(el => el.textContent = user.name);
  document.querySelectorAll("#avatarInitial").forEach(el => el.textContent = (user.name || "A").trim().charAt(0).toUpperCase());
}
function txRow(tx) {
  const outgoing = tx.type === "sent" || tx.type === "bill";
  const icon = tx.type === "received" ? "↙" : tx.type === "bill" ? "▤" : tx.type === "topup" ? "＋" : "↗";
  const sign = outgoing ? "−" : "+";
  return `<div class="transaction-row"><span class="tx-icon">${icon}</span><div class="tx-main"><strong>${escapeHTML(tx.title)}</strong><small>${escapeHTML(tx.detail || "")} · ${new Date(tx.date).toLocaleString()}</small></div><div class="tx-amount ${outgoing ? "" : "positive"}">${sign}${money(tx.amount)}<small>${escapeHTML(tx.status || "Completed (demo)")}</small></div></div>`;
}
function escapeHTML(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function renderWallet() {
  const balance = getBalance(), txs = getTransactions();
  const sent = txs.filter(t => t.type === "sent" || t.type === "bill").reduce((s, t) => s + t.amount, 0);
  const received = txs.filter(t => t.type === "received" || t.type === "topup").reduce((s, t) => s + t.amount, 0);
  const bal = document.getElementById("balanceAmount"); if (bal) bal.textContent = money(balance);
  const sentEl = document.getElementById("sentAmount"); if (sentEl) sentEl.textContent = money(sent);
  const recEl = document.getElementById("receivedAmount"); if (recEl) recEl.textContent = money(received);
  const recent = document.getElementById("recentTransactions"); if (recent) recent.innerHTML = txs.length ? txs.slice(0, 5).map(txRow).join("") : '<div class="empty-state">No transactions yet. Try adding demo money or sending a transfer.</div>';
  const available = document.getElementById("availableBalance"); if (available) available.textContent = money(balance);
  const all = document.getElementById("allTransactions"); if (all) all.innerHTML = txs.length ? txs.map(txRow).join("") : '<div class="empty-state">No transaction records yet.</div>';
  const notes = document.getElementById("notificationList"); if (notes) { const items = getNotifications(); notes.innerHTML = items.length ? items.map(n => `<div class="notification"><span class="note-icon">♧</span><div><strong>${escapeHTML(n.title)}</strong><p>${escapeHTML(n.message)}</p><small>${new Date(n.date).toLocaleString()}</small></div></div>`).join("") : '<div class="empty-state">You’re all caught up. Notifications will appear here after demo activity.</div>'; }
}
function setupAuth() {
  const register = document.getElementById("registerForm");
  if (register) register.addEventListener("submit", e => {
    e.preventDefault(); const name = document.getElementById("name").value.trim(), email = document.getElementById("email").value.trim().toLowerCase(), password = document.getElementById("password").value;
    if (password.length < 6) return alert("Use at least 6 characters for this demo password.");
    write(STORAGE.user, { name, email }); if (read(STORAGE.balance, null) === null) setBalance(10000);
    notify("Welcome to NovaPay", "Your demo wallet has been created."); window.location.href = "wallet.html";
  });
  const login = document.getElementById("loginForm");
  if (login) login.addEventListener("submit", e => {
    e.preventDefault(); const email = document.getElementById("email").value.trim().toLowerCase(), password = document.getElementById("password").value;
    const user = currentUser();
    if (user && user.email === email && password.length >= 1) { window.location.href = "wallet.html"; return; }
    if (!user) { alert("No demo account found in this browser. Create an account first."); return; }
    alert("Email does not match the demo account saved in this browser.");
  });
}
function setupDashboard() {
  const protectedPages = ["wallet.html", "transfer.html", "bills.html", "transactions.html", "notifications.html"];
  if (protectedPages.some(p => location.pathname.endsWith("/" + p)) && !requireUser()) return;
  updateProfile(); renderWallet();
  document.getElementById("logoutBtn")?.addEventListener("click", () => { localStorage.removeItem(STORAGE.user); window.location.href = "index.html"; });
  document.getElementById("addMoneyBtn")?.addEventListener("click", () => {
    const raw = prompt("Enter an amount to add to your DEMO wallet (₹):"); if (raw === null) return;
    const amount = Number(raw); if (!Number.isFinite(amount) || amount <= 0 || amount > 1000000) return alert("Enter a valid amount between ₹1 and ₹10,00,000.");
    setBalance(getBalance() + amount); addTransaction({ title: "Demo wallet top-up", detail: "Added by you", amount, type: "topup" }); notify("Wallet topped up", `${money(amount)} was added to your demo balance.`); renderWallet();
  });
  const transfer = document.getElementById("transferForm");
  if (transfer) transfer.addEventListener("submit", e => {
    e.preventDefault(); const name = document.getElementById("recipient").value.trim(), email = document.getElementById("recipientEmail").value.trim(), amount = Number(document.getElementById("transferAmount").value), note = document.getElementById("transferNote").value.trim(), msg = document.getElementById("formMessage");
    if (!Number.isFinite(amount) || amount <= 0) return showMessage(msg, "Enter a valid amount greater than zero.", true);
    if (amount > getBalance()) return showMessage(msg, "Insufficient demo balance. Add money or enter a smaller amount.", true);
    if (!confirm(`Send ${money(amount)} to ${name} (${email}) in the demo?`)) return;
    setBalance(getBalance() - amount); addTransaction({ title: "Money sent", detail: `To ${name}${note ? " · " + note : ""}`, amount, type: "sent" }); notify("Demo transfer completed", `${money(amount)} was sent to ${name}. This was not a real payment.`);
    showMessage(msg, `Demo transfer recorded. ${money(amount)} was sent to ${escapeHTML(name)}.`, false); transfer.reset(); renderWallet();
  });
  document.querySelectorAll("[data-bill]").forEach(btn => btn.addEventListener("click", () => {
    const cat = document.getElementById("billCategory"); if (cat) cat.value = btn.dataset.bill;
    const title = document.getElementById("billFormTitle"); if (title) title.textContent = `${btn.dataset.bill} payment`;
    document.querySelector(".bill-form-panel")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }));
  const bill = document.getElementById("billForm");
  if (bill) bill.addEventListener("submit", e => {
    e.preventDefault(); const category = document.getElementById("billCategory").value, consumer = document.getElementById("consumerId").value.trim(), amount = Number(document.getElementById("billAmount").value), msg = document.getElementById("formMessage");
    if (!consumer) return showMessage(msg, "Enter the consumer or account number.", true);
    if (!Number.isFinite(amount) || amount <= 0) return showMessage(msg, "Enter a valid amount greater than zero.", true);
    if (amount > getBalance()) return showMessage(msg, "Insufficient demo balance.", true);
    if (!confirm(`Record a DEMO ${category} payment of ${money(amount)}?`)) return;
    setBalance(getBalance() - amount); addTransaction({ title: `${category} bill`, detail: `Account ${consumer}`, amount, type: "bill" }); notify("Demo bill paid", `${money(amount)} ${category} payment was recorded. No provider was contacted.`);
    showMessage(msg, "Demo bill payment recorded. No real payment was made.", false); bill.reset(); document.getElementById("billCategory").value = category; renderWallet();
  });
  document.getElementById("clearHistory")?.addEventListener("click", () => { if (confirm("Delete all demo transaction history? Your balance will not change.")) { write(STORAGE.transactions, []); renderWallet(); } });
}
function showMessage(el, text, error) { if (!el) return; el.className = "message " + (error ? "error" : "success"); el.textContent = text; }
document.addEventListener("DOMContentLoaded", () => { setupAuth(); setupDashboard(); });
