// js/app.js
import { initSupabase } from "./config.js";
import { switchContext, renderComingSoon, toggleTheme, toggleLang, switchCat, handleMonthChange, updateDashboard } from "./ui.js";
import { handleLogin, handleLogout, handleResetPassword, checkSession } from "./auth.js";
import { uploadToSupabase, clearDatabase } from "./data.js"; 
import { toggleAI, handleUserQuery, clearAIChat, triggerAIQuery } from "./ai.js";
// NEW: Import POS Logic
import { loadInventory, addProduct, initPOS, addToCart, processSale, loadRepairs, addRepair, loadHR, addWorker } from "./pos_module.js";

// --- NAVIGATION ---
function setActiveNav(activeId) {
    const navs = ['nav-revenue', 'nav-service', 'nav-inventory', 'nav-supplier', 'nav-pos', 'nav-repairs', 'nav-hr'];
    navs.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.className = (id === activeId) 
                ? "group flex items-center justify-center space-x-2 p-3 rounded-xl cursor-pointer bg-slate-800 text-white shadow-lg transform scale-105 transition-all"
                : "group flex items-center justify-center space-x-2 p-3 rounded-xl cursor-pointer bg-white dark:bg-darkcard text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition-all hover:scale-105 border border-transparent hover:border-gray-200 dark:hover:border-gray-600";
        }
    });
}

function hideAllSections() {
    const sections = ['dashboard-view', 'pos-view', 'inventory-view', 'repairs-view', 'hr-view'];
    sections.forEach(id => {
        const el = document.getElementById(id);
        if(el) el.classList.add('hidden');
    });
}

window.handleNavClick = function(tabName) {
    hideAllSections();
    
    if (tabName === 'dashboard') {
        setActiveNav('nav-revenue'); // Default
        document.getElementById('dashboard-view').classList.remove('hidden');
        switchContext('past');
    }
    else if (tabName === 'pos') {
        setActiveNav('nav-pos');
        document.getElementById('pos-view').classList.remove('hidden');
        initPOS();
    }
    else if (tabName === 'inventory') {
        setActiveNav('nav-inventory');
        document.getElementById('inventory-view').classList.remove('hidden');
        loadInventory();
    }
    else if (tabName === 'repairs') {
        setActiveNav('nav-repairs');
        document.getElementById('repairs-view').classList.remove('hidden');
        loadRepairs();
    }
    else if (tabName === 'hr') {
        setActiveNav('nav-hr');
        document.getElementById('hr-view').classList.remove('hidden');
        loadHR();
    }
    else if (tabName === 'ai') {
        toggleAI(); 
        // Don't hide the current view for AI
        const current = document.querySelector('div[id$="-view"]:not(.hidden)');
        if(current) current.classList.remove('hidden');
    }
}

// --- EXPOSE FUNCTIONS ---
window.toggleAI = toggleAI;
window.clearAIChat = clearAIChat;
window.handleAIKey = handleUserQuery;
window.triggerAIQuery = triggerAIQuery;
window.triggerAISend = () => handleUserQuery({ key: 'Enter' });

// POS Functions
window.addProduct = addProduct;
window.addToCart = addToCart;
window.processSale = processSale;
window.addRepair = addRepair;
window.addWorker = addWorker;

window.onload = function () {
  try {
    initSupabase();
    
    // Attach Global Auth
    window.handleLogin = handleLogin;
    window.handleLogout = handleLogout;
    window.handleResetPassword = handleResetPassword;
    
    // Attach Dashboard Logic
    window.uploadToSupabase = uploadToSupabase;
    window.clearDatabase = clearDatabase;
    window.toggleTheme = toggleTheme;
    window.toggleLang = toggleLang;
    window.switchContext = (mode) => {
        hideAllSections();
        document.getElementById('dashboard-view').classList.remove('hidden');
        if (mode === 'past') setActiveNav('nav-revenue');
        if (mode === 'service') setActiveNav('nav-service');
        switchContext(mode);
    };
    
    window.renderComingSoon = renderComingSoon; 
    window.handleMonthChange = handleMonthChange;
    window.updateDashboard = updateDashboard;

    checkSession();
  } catch (err) {
    console.error(err);
    alert("Startup Error: " + err.message);
  }
};
