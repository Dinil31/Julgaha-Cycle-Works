import { initSupabase, getSupabase } from "./config.js";
import { switchContext, renderComingSoon, toggleTheme, toggleLang, handleMonthChange, updateDashboard } from "./ui.js";
import { handleLogin, handleLogout, handleResetPassword, checkSession } from "./auth.js";
import { uploadToSupabase, clearDatabase } from "./data.js"; 
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
        
        // Fetch fresh data for the dashboard and populate the advanced filters
        await fetchDashboardData();
        
        if (typeof switchContext === 'function') switchContext('past'); 
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


// ============================================================================
// 2. DASHBOARD ADVANCED FILTERING SYSTEM
// ============================================================================

window.currentDashboardData = []; // Store raw data globally for filtering

async function fetchDashboardData() {
    try {
        const sb = getSupabase();
        // Fetch all sales for the dashboard calculations
        const { data: sales, error } = await sb.from('sales').select('*');
        
        if (error) throw error;
        
        window.currentDashboardData = sales || [];
        
        // Populate the Year dropdown based on actual data
        window.populateYearDropdown(window.currentDashboardData);
        
        // Trigger the filter to update the UI cards and charts
        window.handleFilterChange();

    } catch (err) {
        console.error("Error fetching dashboard data:", err);
    }
}

/**
 * Dynamically builds the Year dropdown based on the dates in the database
 */
window.populateYearDropdown = function(data) {
    const yearSelect = document.getElementById('slicer-year');
    if (!yearSelect) return;

    const uniqueYears = new Set();
    data.forEach(row => {
        const d = new Date(row.date || row._date);
        if (!isNaN(d.getFullYear())) {
            uniqueYears.add(d.getFullYear());
        }
    });

    let html = '<option value="all">All Years</option>';
    
    // Sort years highest to lowest (e.g., 2026, 2025, 2024)
    [...uniqueYears].sort((a,b) => b - a).forEach(year => {
        html += `<option value="${year}">${year}</option>`;
    });
    
    const currentSelection = yearSelect.value;
    yearSelect.innerHTML = html;
    
    if ([...uniqueYears].includes(parseInt(currentSelection))) {
        yearSelect.value = currentSelection;
    }
};

/**
 * Main function to filter data by Year, Month, and Exact Day.
 */
window.handleFilterChange = function() {
    if (!window.currentDashboardData) return; 
    
    const yearVal = document.getElementById('slicer-year').value;
    const monthVal = document.getElementById('slicer-month').value;
    const dayVal = document.getElementById('slicer-day').value;

    let filteredData = window.currentDashboardData;

    // 1. Filter by Year
    if (yearVal !== 'all') {
        filteredData = filteredData.filter(row => {
            const d = new Date(row.date || row._date);
            return d.getFullYear() === parseInt(yearVal);
        });
    }

    // 2. Filter by Month (0 = Jan, 11 = Dec)
    if (monthVal !== 'all') {
        filteredData = filteredData.filter(row => {
            const d = new Date(row.date || row._date);
            return d.getMonth() === parseInt(monthVal);
        });
    }

    // 3. Filter by Exact Day (YYYY-MM-DD)
    if (dayVal) {
        filteredData = filteredData.filter(row => {
            const d = new Date(row.date || row._date);
            const localDateStr = d.getFullYear() + '-' + 
                                 String(d.getMonth() + 1).padStart(2, '0') + '-' + 
                                 String(d.getDate()).padStart(2, '0');
            return localDateStr === dayVal;
        });
    }

    // --- UPDATE UI CARDS ---
    let totalRev = 0;
    filteredData.forEach(sale => {
        totalRev += Number(sale.total_amount || 0);
    });

    const formatCurrency = (val) => new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR' }).format(val);
    
    const revEl = document.getElementById('val-rev');
    const profEl = document.getElementById('val-prof');
    
    if (revEl) revEl.innerText = formatCurrency(totalRev);
    // Simple profit estimation for demo (Assuming 30% margin)
    if (profEl) profEl.innerText = formatCurrency(totalRev * 0.30);

    // Call your Chart.js update function if it exists in ui.js
    if (typeof window.updateDashboard === 'function') {
        window.updateDashboard(filteredData);
    }
};

/**
 * Resets all filters back to default
 */
window.clearFilters = function() {
    document.getElementById('slicer-year').value = 'all';
    document.getElementById('slicer-month').value = 'all';
    document.getElementById('slicer-day').value = '';
    window.handleFilterChange();
};


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
            
            // Show success message using Custom Modal
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
            
            // Reload the inventory to show the new A/B/C badges
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
        
        window.switchContext = (mode) => { 
            hideAllSections(); 
            document.getElementById('dashboard-view').classList.remove('hidden'); 
            setActiveNav('nav-dashboard'); 
            if (typeof switchContext === 'function') switchContext(mode); 
        };
        
        checkSession();
        
        // Initial fetch for dashboard data if the user is already logged in
        if (sessionStorage.getItem('cycleSenseUser')) {
            await fetchDashboardData();
        }

    } catch (err) { 
        console.error(err); 
        alert("Startup Error: " + err.message); 
    }
};
