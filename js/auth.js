// js/auth.js
import { getSupabase } from "./config.js";
import { fetchData } from "./data.js";
import { showCustomPrompt, showCustomConfirm } from "./ui.js";

// --- LOGOUT LOGIC ---
export async function handleLogout() {
  const sb = getSupabase();
  await sb.auth.signOut();
  localStorage.removeItem("loginTime");
  window.location.reload();
}

// --- LOGIN LOGIC ---
export async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const btn = document.getElementById("login-btn");
  const msg = document.getElementById("status-msg");

  if (!email || !password) {
    msg.innerText = "Please enter both fields.";
    msg.style.display = "block";
    return;
  }

  btn.disabled = true;
  btn.innerText = "Verifying...";
  msg.style.display = "none";

  const sb = getSupabase();
  const { data, error } = await sb.auth.signInWithPassword({ email, password });

  if (error) {
    msg.innerText = "Error: " + error.message;
    msg.style.display = "block";
    btn.disabled = false;
    btn.innerText = "Sign In";
  } else {
    localStorage.setItem("loginTime", Date.now());
    checkSession();
  }
}

// --- PASSWORD RESET ---
export async function handleResetPassword() {
  const email = await showCustomPrompt(
    "Reset Password",
    "Please enter your email address to receive a reset link:",
    "name@example.com",
  );
  if (!email) return;
  const sb = getSupabase();
  const { error } = await sb.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.href,
  });
  if (error) await showCustomConfirm("Error", error.message, true);
  else
    await showCustomConfirm(
      "Success",
      "Check your email inbox for the password reset link!",
    );
}

// --- CHECK SESSION ---
export async function checkSession() {
  const sb = getSupabase();
  const {
    data: { session },
  } = await sb.auth.getSession();

  if (session) {
    const loginTime = localStorage.getItem("loginTime");
    const oneDay = 24 * 60 * 60 * 1000;
    if (loginTime && Date.now() - parseInt(loginTime) > oneDay) {
      console.log("Session expired. Logging out...");
      handleLogout();
      return;
    }

    document.getElementById("login-section").classList.add("hidden");
    document.getElementById("dashboard-section").classList.remove("hidden");
    document.getElementById("dashboard-section").classList.add("fade-in");

    // --- UPDATED: FORCE NAME TO 'ADMIN' ---
    document.getElementById("user-display").innerText = "Admin";

    fetchData();
  } else {
    document.getElementById("login-section").classList.remove("hidden");
    document.getElementById("dashboard-section").classList.add("hidden");
  }
}
