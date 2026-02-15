import { initSupabase } from "./config.js";
import { switchContext, renderComingSoon, toggleTheme, toggleLang, handleMonthChange, updateDashboard } from "./ui.js";
import { handleLogin, handleLogout, handleResetPassword, checkSession } from "./auth.js";
import { uploadToSupabase, clearDatabase } from "./data.js"; 
import { toggleAI, handleUserQuery, clearAIChat, triggerAIQuery } from "./ai.js";
// NEW: Import Report Functions
import { loadInventory, addProduct, initPOS, addToCart, processSale, loadRepairs, addRepair, loadHR, addWorker, openReportModal, closeReportModal, filterSales } from "./pos_module.js";

function setActiveNav(activeId) {
    const navs = ['nav-revenue', 'nav-service', 'nav-inventory', 'nav-supplier', 'nav-pos', 'nav-repairs', 'nav-hr'];
    navs.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.className = (id === activeId) 
                ? "flex-shrink-0 flex items-center justify-center space-x-2 px-4 py-2 rounded-xl cursor-pointer bg-slate-800 text-white shadow-lg transform scale-105 transition-all border border-slate-700"
                : "flex-shrink-0 flex items-center justify-center space-x-2 px-4 py-2 rounded-xl cursor-pointer bg-white dark:bg-darkcard text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition-all border border-gray-200 dark:border-gray-700";
        }
    });
}

function hideAllSections() {
    const sections = ['dashboard-view', 'pos-view', 'inventory-view', 'repairs-view', 'hr-view'];
    sections.forEach(id => { const el = document.getElementById(id); if(el) el.classList.add('hidden'); });
}

window.handleNavClick = function(tabName) {
    hideAllSections();
    if (tabName === 'dashboard') { setActiveNav('nav-revenue'); document.getElementById('dashboard-view').classList.remove('hidden'); switchContext('past'); }
    else if (tabName === 'pos') { setActiveNav('nav-pos'); document.getElementById('pos-view').classList.remove('hidden'); initPOS(); }
    else if (tabName === 'inventory') { setActiveNav('nav-inventory'); document.getElementById('inventory-view').classList.remove('hidden'); loadInventory(); }
    else if (tabName === 'repairs') { setActiveNav('nav-repairs'); document.getElementById('repairs-view').classList.remove('hidden'); loadRepairs(); }
    else if (tabName === 'hr') { setActiveNav('nav-hr'); document.getElementById('hr-view').classList.remove('hidden'); loadHR(); }
    else if (tabName === 'ai') { toggleAI(); const current = document.querySelector('div[id$="-view"]:not(.hidden)'); if(current) current.classList.remove('hidden'); }
}

window.toggleAI = toggleAI; window.clearAIChat = clearAIChat; window.handleAIKey = handleUserQuery; window.triggerAIQuery = triggerAIQuery; window.triggerAISend = () => handleUserQuery({ key: 'Enter' });
window.addProduct = addProduct; window.addToCart = addToCart; window.processSale = processSale; window.addRepair = addRepair; window.addWorker = addWorker; window.removeCartItem = (idx) => { /* handled in module */ };

// Report Functions Exposed
window.openReportModal = openReportModal;
window.closeReportModal = closeReportModal;
window.filterSales = filterSales;

window.onload = function () {
  try {
    initSupabase();
    window.handleLogin = handleLogin; window.handleLogout = handleLogout; window.handleResetPassword = handleResetPassword;
    window.uploadToSupabase = uploadToSupabase; window.clearDatabase = clearDatabase; window.toggleTheme = toggleTheme; window.toggleLang = toggleLang;
    window.switchContext = (mode) => { hideAllSections(); document.getElementById('dashboard-view').classList.remove('hidden'); if (mode === 'past') setActiveNav('nav-revenue'); if (mode === 'service') setActiveNav('nav-service'); switchContext(mode); };
    window.renderComingSoon = renderComingSoon; window.handleMonthChange = handleMonthChange; window.updateDashboard = updateDashboard;
    checkSession();
  } catch (err) { console.error(err); alert("Startup Error: " + err.message); }
};
