// js/auth.js
import { getSupabase } from "./config.js";
import { fetchData } from "./data.js";

export async function handleLogin(e) {
  e.preventDefault();
  const sb = getSupabase();
  const email = document.getElementById("email").value;
  const pass = document.getElementById("password").value;
  const btn = document.getElementById("login-btn");

  btn.innerText = "Verifying...";

  try {
    const { data, error } = await sb.auth.signInWithPassword({
      email,
      password: pass,
    });
    if (error) throw error;
    initApp(data.user);
  } catch (err) {
    alert("Login Failed: " + err.message);
    btn.innerText = "Sign In";
  }
}

export async function handleLogout() {
  const sb = getSupabase();
  await sb.auth.signOut();
  location.reload();
}

export async function handleResetPassword() {
  const sb = getSupabase();
  const email = prompt("Enter email:");
  if (email) {
    const { error } = await sb.auth.resetPasswordForEmail(email);
    alert(error ? error.message : "Reset link sent!");
  }
}

export function initApp(user) {
  document.getElementById("login-section").classList.add("hidden");
  document.getElementById("dashboard-section").classList.remove("hidden");
  fetchData();
}

export async function checkSession() {
  const sb = getSupabase();
  if (!sb) return;
  const { data } = await sb.auth.getSession();
  if (data.session) initApp(data.session.user);
}
