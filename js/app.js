// js/app.js
import { initSupabase } from "./config.js";
import { switchContext, renderComingSoon, toggleTheme, toggleLang, handleMonthChange, updateDashboard } from "./ui.js";
import { handleLogin, handleLogout, handleResetPassword, checkSession } from "./auth.js";
import { uploadToSupabase, clearDatabase } from "./data.js"; 
import { toggleAI, handleUserQuery, clearAIChat, triggerAIQuery } from "./ai.js";
import * as posModule from "./pos_module.js";

// --- NAVIGATION ---
function setActiveNav(activeId) {
    // ADDED 'nav-data' to the array
    const navs = ['nav-revenue', 'nav-pos', 'nav-inventory', 'nav-repairs', 'nav-hr', 'nav-calendar', 'nav-data'];
    navs.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.className = (id === activeId) 
                ? "flex-shrink-0 flex items-center justify-center space-x-2 px-5 py-2.5 rounded-xl cursor-pointer bg-slate-800 text-white shadow-md transition font-bold text-sm"
                : "flex-shrink-0 flex items-center justify-center space-x-2 px-5 py-2.5 rounded-xl cursor-pointer bg-white dark:bg-darkcard text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-slate-700 transition font-bold text-sm";
        }
    });
}

function hideAllSections() {
    // ADDED 'data-view' to the array
    const sections = ['dashboard-view', 'pos-view', 'inventory-view', 'repairs-view', 'hr-view', 'calendar-view', 'data-view'];
    sections.forEach(id => { const el = document.getElementById(id); if(el) el.classList.add('hidden'); });
}

window.handleNavClick = function(tabName) {
    hideAllSections();
    if (tabName === 'dashboard') { setActiveNav('nav-revenue'); document.getElementById('dashboard-view').classList.remove('hidden'); switchContext('past'); }
    else if (tabName === 'pos') { setActiveNav('nav-pos'); document.getElementById('pos-view').classList.remove('hidden'); posModule.initPOS(); }
    else if (tabName === 'inventory') { setActiveNav('nav-inventory'); document.getElementById('inventory-view').classList.remove('hidden'); posModule.loadInventory(); }
    else if (tabName === 'repairs') { setActiveNav('nav-repairs'); document.getElementById('repairs-view').classList.remove('hidden'); posModule.loadRepairs(); }
    else if (tabName === 'hr') { setActiveNav('nav-hr'); document.getElementById('hr-view').classList.remove('hidden'); posModule.loadHR(); }
    else if (tabName === 'calendar') { setActiveNav('nav-calendar'); document.getElementById('calendar-view').classList.remove('hidden'); posModule.initCalendar(); }
    else if (tabName === 'data') { setActiveNav('nav-data'); document.getElementById('data-view').classList.remove('hidden'); } // ADDED DATA VIEW LOGIC
    else if (tabName === 'ai') { toggleAI(); const current = document.querySelector('div[id$="-view"]:not(.hidden)'); if(current) current.classList.remove('hidden'); }
}

// --- LIVE CLOCK & QUOTE ---
const quotes = [
    "Every ride is a tiny holiday.", 
    "Life is like riding a bicycle. To keep your balance, you must keep moving.", 
    "A bicycle ride around the world begins with a single pedal stroke.",
    "Nothing compares to the simple pleasure of riding a bike.",
    "Work hard, ride harder."
];

function startClock() {
    setInterval(() => {
        const now = new Date();
        const clockEl = document.getElementById('live-clock');
        if(clockEl) clockEl.innerText = now.toLocaleString('en-US', { weekday:'short', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit', second:'2-digit' });
    }, 1000);
    
    const quoteEl = document.getElementById('daily-quote');
    if(quoteEl) {
        const todayDay = new Date().getDay(); 
        quoteEl.innerText = `"${quotes[todayDay % quotes.length]}"`;
    }
}

// --- EXPOSURES ---
window.toggleAI = toggleAI; 
window.clearAIChat = clearAIChat; 
window.handleAIKey = handleUserQuery; 
window.triggerAIQuery = triggerAIQuery; 
window.triggerAISend = () => handleUserQuery({ key: 'Enter' });

window.posModule = posModule;

window.onload = function () {
  try {
    initSupabase();
    startClock();
    window.handleLogin = handleLogin; 
    window.handleLogout = handleLogout; 
    window.handleResetPassword = handleResetPassword;
    window.uploadToSupabase = uploadToSupabase; // Ensure Excel upload works
    window.clearDatabase = clearDatabase;       // Ensure Clear DB works
    window.toggleTheme = toggleTheme; 
    window.switchContext = (mode) => { hideAllSections(); document.getElementById('dashboard-view').classList.remove('hidden'); setActiveNav('nav-revenue'); switchContext(mode); };
    window.handleMonthChange = handleMonthChange; 
    window.updateDashboard = updateDashboard;
    checkSession();
  } catch (err) { console.error(err); alert("Startup Error: " + err.message); }
};
