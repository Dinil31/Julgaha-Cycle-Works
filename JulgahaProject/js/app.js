// js/app.js
import { initSupabase } from "./config.js";
import {
  switchContext,
  renderComingSoon,
  toggleTheme,
  toggleLang,
  switchCat,
  handleMonthChange,
  updateDashboard,
} from "./ui.js";
import {
  handleLogin,
  handleLogout,
  handleResetPassword,
  checkSession,
} from "./auth.js";
import { uploadToSupabase, clearDatabase } from "./data.js";

function setActiveNav(activeId) {
  const navs = [
    "nav-revenue",
    "nav-service",
    "nav-inventory",
    "nav-supplier",
    "nav-ai",
  ];
  navs.forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      // Reset all to default style
      el.className =
        id === activeId
          ? "flex items-center justify-center space-x-2 p-3 rounded-lg cursor-pointer bg-slate-800 text-white shadow-md transition-all"
          : "flex items-center justify-center space-x-2 p-3 rounded-lg cursor-pointer bg-white dark:bg-darkcard text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition-all border border-transparent";
    }
  });
}

window.switchContext = function (mode) {
  if (mode === "past") setActiveNav("nav-revenue");
  if (mode === "service") setActiveNav("nav-service");
  switchContext(mode);
};

window.handleNavClick = function (tabName) {
  if (tabName === "inventory") {
    setActiveNav("nav-inventory");
    renderComingSoon("Inventory Management");
  }
  if (tabName === "supplier") {
    setActiveNav("nav-supplier");
    renderComingSoon("Procurement & Supply");
  }
  // NEW: CycleSense AI Trigger
  if (tabName === "ai") {
    // Just unhighlight others, or highlight AI button if you add one to the nav grid
    // For header button, we just run the function:
    renderComingSoon("CycleSense AI", "fa-robot");
  }
};

window.onload = function () {
  try {
    initSupabase();

    window.handleLogin = handleLogin;
    window.handleLogout = handleLogout;
    window.handleResetPassword = handleResetPassword;
    window.uploadToSupabase = uploadToSupabase;
    window.clearDatabase = clearDatabase;
    window.toggleTheme = toggleTheme;
    window.toggleLang = toggleLang;
    window.switchCat = switchCat;

    window.renderComingSoon = renderComingSoon;

    window.handleMonthChange = handleMonthChange;
    window.updateDashboard = updateDashboard;

    const btn = document.getElementById("login-btn");
    if (btn) {
      btn.disabled = false;
      btn.innerText = "Sign In";
    }
    const status = document.getElementById("status-msg");
    if (status) status.style.display = "none";

    checkSession();
  } catch (err) {
    console.error(err);
    alert("Startup Error: " + err.message);
  }
};
