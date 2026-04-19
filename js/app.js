import { initSupabase } from "./config.js";
import { switchContext as uiSwitchContext, renderComingSoon, toggleTheme, toggleLang, updateDashboard } from "./ui.js";
import { handleLogin, handleLogout, handleResetPassword, checkSession } from "./auth.js";
import { uploadToSupabase, clearDatabase, getRawData } from "./data.js"; 
import { toggleAI, handleUserQuery, clearAIChat, triggerAIQuery } from "./ai.js";
import * as posModule from "./pos_module.js";

// ============================================================================
// 1. NAVIGATION SYSTEM
// ============================================================================

function setActiveNav(activeId) {
    const navs = [
        'nav-dashboard', 
        'nav-pos', 
        'nav-showroom', 
        'nav-inventory', 
        'nav-repairs', 
        'nav-hr', 
        'nav-calendar', 
        'nav-data'
    ];
    
    navs.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            if (id === activeId) {
                el.className = "flex-shrink-0 flex items-center justify-center space-x-2 px-5 py-2.5 rounded-xl cursor-pointer bg-slate-800 text-white shadow-md transition font-bold text-sm";
            } else {
                el.className = "flex-shrink-0 flex items-center justify-center space-x-2 px-5 py-2.5 rounded-xl cursor-pointer bg-white dark:bg-darkcard text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-slate-700 transition font-bold text-sm";
            }
        }
    });
}

function hideAllSections() {
    const sections = [
        'dashboard-view', 
        'pos-view', 
        'showroom-view',
        'inventory-view', 
        'repairs-view', 
        'hr-view', 
        'calendar-view', 
        'data-view'
    ];
    
    sections.forEach(id => { 
        const el = document.getElementById(id); 
        if (el) {
            el.classList.add('hidden'); 
        }
    });
}

window.handleNavClick = async function(tabName) {
    hideAllSections();
    
    if (tabName === 'dashboard') { 
        setActiveNav('nav-dashboard'); 
        document.getElementById('dashboard-view').classList.remove('hidden'); 
        window.switchContext('past'); 
    }
    else if (tabName === 'pos') { 
        setActiveNav('nav-pos'); 
        document.getElementById('pos-view').classList.remove('hidden'); 
        if (posModule.initPOS) await posModule.initPOS(); 
    }
    else if (tabName === 'showroom') { 
        setActiveNav('nav-showroom'); 
        document.getElementById('showroom-view').classList.remove('hidden'); 
        if (posModule.loadShowroom) await posModule.loadShowroom(); 
    }
    else if (tabName === 'inventory') { 
        setActiveNav('nav-inventory'); 
        document.getElementById('inventory-view').classList.remove('hidden'); 
        if (posModule.loadInventory) await posModule.loadInventory(); 
    }
    else if (tabName === 'repairs') { 
        setActiveNav('nav-repairs'); 
        document.getElementById('repairs-view').classList.remove('hidden'); 
        if (posModule.loadRepairs) await posModule.loadRepairs(); 
    }
    else if (tabName === 'hr') { 
        setActiveNav('nav-hr'); 
        document.getElementById('hr-view').classList.remove('hidden'); 
        if (posModule.loadHR) await posModule.loadHR(); 
    }
    else if (tabName === 'calendar') { 
        setActiveNav('nav-calendar'); 
        document.getElementById('calendar-view').classList.remove('hidden'); 
        if (posModule.initCalendar) await posModule.initCalendar(); 
    }
    else if (tabName === 'data') { 
        setActiveNav('nav-data'); 
        document.getElementById('data-view').classList.remove('hidden'); 
    }
    else if (tabName === 'ai') { 
        toggleAI(); 
        const current = document.querySelector('div[id$="-view"]:not(.hidden)'); 
        if (current) {
            current.classList.remove('hidden'); 
        }
    }
}

// Wrapper to handle the Past/Predicted buttons while triggering our new filters
window.switchContext = (mode) => {
    if (typeof uiSwitchContext === 'function') {
        uiSwitchContext(mode);
    }
    
    // Give data.js a tiny fraction of a second to fetch the active array, then filter and render
    setTimeout(() => {
        window.handleFilterChange();
    }, 150);
};


// ============================================================================
// 2. DASHBOARD FILTERING & CHART RENDERING
// ============================================================================

/**
 * Main function to filter data by Month and Exact Day.
 * It safely extracts the raw data, filters it, and redraws the UI.
 */
window.handleFilterChange = function() {
    let rawData = [];
    if (typeof getRawData === 'function') {
        rawData = getRawData() || [];
    }

    if (rawData.length === 0) {
        forceUpdateDashboardUI([]);
        return;
    }
    
    const monthSelect = document.getElementById('slicer-month');
    const daySelect = document.getElementById('slicer-day');
    
    const monthVal = monthSelect ? monthSelect.value : 'all';
    const dayVal = daySelect ? daySelect.value : '';

    let filteredData = rawData.filter(row => {
        const rowDate = row._date || row.date;
        if (!rowDate) return false;
        
        const d = new Date(rowDate);
        if (isNaN(d.getTime())) return false;

        let match = true;

        // 1. Filter by Month ONLY (0 = Jan, 11 = Dec) - Ignores the Year!
        if (monthVal !== 'all') {
            match = match && (d.getMonth() === parseInt(monthVal));
        }

        // 2. Filter by Exact Day (YYYY-MM-DD)
        if (dayVal) {
            const localDateStr = d.getFullYear() + '-' + 
                                 String(d.getMonth() + 1).padStart(2, '0') + '-' + 
                                 String(d.getDate()).padStart(2, '0');
            match = match && (localDateStr === dayVal);
        }

        return match;
    });

    // Force the UI and Charts to update immediately with the perfectly filtered data
    forceUpdateDashboardUI(filteredData);
};

/**
 * Resets all filters back to default
 */
window.clearFilters = function() {
    const monthSelect = document.getElementById('slicer-month');
    const daySelect = document.getElementById('slicer-day');
    
    if (monthSelect) monthSelect.value = 'all';
    if (daySelect) daySelect.value = '';
    
    window.handleFilterChange();
};

/**
 * Calculates Revenue/Expenses manually and forces the Chart.js canvases to re-render
 * bypassing any broken logic inside ui.js
 */
function forceUpdateDashboardUI(data) {
    let totalRev = 0;
    let totalExp = 0;
    const formatCurrency = (val) => new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR' }).format(val);

    const categoryExp = {};
    const trendData = {};

    data.forEach(row => {
        const rev = Number(row.revenue || row.total_amount || 0);
        const exp = Number(row.expense_amount || 0);
        
        totalRev += rev;
        totalExp += exp;

        // Group Categories for the Pie Chart
        if (exp > 0) {
            const cat = row.expense_desc || 'General Expenses';
            categoryExp[cat] = (categoryExp[cat] || 0) + exp;
        } else if (rev > 0 && row.customer_name) {
            const cat = 'Retail Sales';
            categoryExp[cat] = (categoryExp[cat] || 0) + rev;
        }

        // Group Dates for the Line/Bar Chart
        const rowDate = row._date || row.date;
        if (rowDate) {
            const d = new Date(rowDate);
            const key = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            
            if (!trendData[key]) trendData[key] = { rev: 0, exp: 0 };
            trendData[key].rev += rev;
            trendData[key].exp += exp;
        }
    });

    // Update Top Cards
    const revEl = document.getElementById('val-rev');
    const expEl = document.getElementById('val-exp');
    const profEl = document.getElementById('val-prof');

    if (revEl) revEl.innerText = formatCurrency(totalRev);
    if (expEl) expEl.innerText = formatCurrency(totalExp);
    if (profEl) profEl.innerText = formatCurrency(totalRev - totalExp);

    // Force Chart.js Updates safely
    if (window.Chart) {
        const mainChart = Chart.getChart("mainChart");
        if (mainChart) {
            mainChart.data.labels = Object.keys(trendData);
            
            // Assume Dataset 0 is Revenue, Dataset 1 is Expenses
            if (mainChart.data.datasets.length > 0) {
                mainChart.data.datasets[0].data = Object.values(trendData).map(t => t.rev);
            }
            if (mainChart.data.datasets.length > 1) {
                mainChart.data.datasets[1].data = Object.values(trendData).map(t => t.exp);
            }
            mainChart.update();
        }

        const subChart = Chart.getChart("subChart");
        if (subChart) {
            subChart.data.labels = Object.keys(categoryExp);
            if (subChart.data.datasets.length > 0) {
                subChart.data.datasets[0].data = Object.values(categoryExp);
            }
            subChart.update();
        }
    }
}


// ============================================================================
// 3. LIVE CLOCK & QUOTE SYSTEM
// ============================================================================

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
        if (clockEl) {
            clockEl.innerText = now.toLocaleString('en-US', { 
                weekday: 'short', 
                month: 'short', 
                day: 'numeric', 
                hour: '2-digit', 
                minute: '2-digit', 
                second: '2-digit' 
            });
        }
    }, 1000);
    
    const quoteEl = document.getElementById('daily-quote');
    if (quoteEl) {
        const todayDay = new Date().getDay(); 
        quoteEl.innerText = `"${quotes[todayDay % quotes.length]}"`;
    }
}


// ============================================================================
// 4. DATA SYNC & AI CLASSIFICATION
// ============================================================================

window.uploadAIClassification = async () => {
    const fileInput = document.getElementById('file-ai-class');
    const file = fileInput.files[0];
    
    if (!file) {
        return alert("Please select the Industry_ABC_Classification.xlsx file first!");
    }

    const loader = document.getElementById('loader');
    if(loader) {
        loader.classList.remove('hidden');
        setTimeout(() => loader.classList.remove('opacity-0'), 10);
    }

    const reader = new FileReader();
    
    reader.onload = async (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            
            const jsonRows = XLSX.utils.sheet_to_json(worksheet);
            const supabaseClient = getSupabase();
            
            if (!supabaseClient) {
                throw new Error("Could not connect to Supabase database.");
            }

            let successCount = 0;

            for (let row of jsonRows) {
                const partName = row['Spare Part Name'];
                const aiClass = row['AI_Classification'];

                if (partName && aiClass) {
                    const { error } = await supabaseClient.from('products')
                        .update({ ai_class: aiClass })
                        .eq('name', partName.trim());
                    
                    if (!error) {
                        successCount++;
                    } else {
                        console.error(`Failed to update ${partName}:`, error.message);
                    }
                }
            }

            if(loader) {
                loader.classList.add('opacity-0');
                setTimeout(() => loader.classList.add('hidden'), 300);
            }
            
            fileInput.value = ''; 
            
            const modal = document.getElementById('custom-modal');
            if (modal) {
                document.getElementById('modal-title').innerText = "AI Sync Complete";
                document.getElementById('modal-msg').innerText = `Successfully synced ${successCount} AI inventory labels to the cloud.`;
                document.getElementById('modal-icon').className = "fas fa-check-circle text-2xl text-green-500";
                document.getElementById('modal-icon-bg').className = "mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4 pulse-green";
                document.getElementById('modal-btn-cancel').classList.add('hidden');
                const confirmBtn = document.getElementById('modal-btn-confirm');
                confirmBtn.innerText = "Awesome!";
                confirmBtn.onclick = () => { modal.classList.add('hidden'); };
                modal.classList.remove('hidden');
            } else {
                alert(`Successfully synced ${successCount} AI inventory labels!`);
            }
            
            if (window.posModule && window.posModule.loadInventory) {
                await window.posModule.loadInventory();
            }

        } catch (err) {
            if(loader) {
                loader.classList.add('opacity-0');
                setTimeout(() => loader.classList.add('hidden'), 300);
            }
            alert("Error processing Excel file: " + err.message);
        }
    };
    
    reader.readAsArrayBuffer(file);
};


// ============================================================================
// 5. GLOBAL EXPOSURES & INITIALIZATION
// ============================================================================

window.toggleAI = toggleAI; 
window.clearAIChat = clearAIChat; 
window.handleAIKey = handleUserQuery; 
window.triggerAIQuery = triggerAIQuery; 
window.triggerAISend = () => handleUserQuery({ key: 'Enter' });

window.posModule = posModule;

// Map the dropdown onChange events to our robust filtering function
window.handleMonthChange = window.handleFilterChange;

window.onload = async function () {
    try {
        initSupabase();
        startClock();
        
        window.handleLogin = handleLogin; 
        window.handleLogout = handleLogout; 
        window.handleResetPassword = handleResetPassword;
        window.uploadToSupabase = uploadToSupabase;
        window.clearDatabase = clearDatabase;
        window.toggleTheme = toggleTheme; 
        
        checkSession();
        
        // Give the UI time to build charts, then force fetch and filter the data
        setTimeout(() => {
            if (document.getElementById('dashboard-view') && !document.getElementById('dashboard-view').classList.contains('hidden')) {
                 window.switchContext('past');
            }
        }, 500);

    } catch (err) { 
        console.error(err); 
        alert("Startup Error: " + err.message); 
    }
};
