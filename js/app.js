import { initSupabase } from "./config.js";
import { switchContext, renderComingSoon, toggleTheme, toggleLang, handleMonthChange, updateDashboard } from "./ui.js";
import { handleLogin, handleLogout, handleResetPassword, checkSession } from "./auth.js";
import { uploadToSupabase, clearDatabase } from "./data.js"; 
import { toggleAI, handleUserQuery, clearAIChat, triggerAIQuery } from "./ai.js";
import * as posModule from "./pos_module.js";

// --- NAVIGATION ---
function setActiveNav(activeId) {
    const navs = [
        'nav-revenue', 
        'nav-pos', 
        'nav-showroom', // Added Showroom
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
        'showroom-view', // Added Showroom
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

window.handleNavClick = function(tabName) {
    hideAllSections();
    
    if (tabName === 'dashboard') { 
        setActiveNav('nav-revenue'); 
        document.getElementById('dashboard-view').classList.remove('hidden'); 
        switchContext('past'); 
    }
    else if (tabName === 'pos') { 
        setActiveNav('nav-pos'); 
        document.getElementById('pos-view').classList.remove('hidden'); 
        posModule.initPOS(); 
    }
    else if (tabName === 'showroom') { // Added Showroom Logic
        setActiveNav('nav-showroom'); 
        document.getElementById('showroom-view').classList.remove('hidden'); 
        posModule.loadShowroom(); 
    }
    else if (tabName === 'inventory') { 
        setActiveNav('nav-inventory'); 
        document.getElementById('inventory-view').classList.remove('hidden'); 
        posModule.loadInventory(); 
    }
    else if (tabName === 'repairs') { 
        setActiveNav('nav-repairs'); 
        document.getElementById('repairs-view').classList.remove('hidden'); 
        posModule.loadRepairs(); 
    }
    else if (tabName === 'hr') { 
        setActiveNav('nav-hr'); 
        document.getElementById('hr-view').classList.remove('hidden'); 
        posModule.loadHR(); 
    }
    else if (tabName === 'calendar') { 
        setActiveNav('nav-calendar'); 
        document.getElementById('calendar-view').classList.remove('hidden'); 
        posModule.initCalendar(); 
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
        window.uploadToSupabase = uploadToSupabase;
        window.clearDatabase = clearDatabase;
        window.toggleTheme = toggleTheme; 
        
        window.switchContext = (mode) => { 
            hideAllSections(); 
            document.getElementById('dashboard-view').classList.remove('hidden'); 
            setActiveNav('nav-revenue'); 
            switchContext(mode); 
        };
        
        window.handleMonthChange = handleMonthChange; 
        window.updateDashboard = updateDashboard;
        
        checkSession();
    } catch (err) { 
        console.error(err); 
        alert("Startup Error: " + err.message); 
    }
};

// Add this to the very bottom of js/app.js
window.uploadAIClassification = async () => {
    const fileInput = document.getElementById('file-ai-class');
    const file = fileInput.files[0];
    
    if (!file) {
        return alert("Please select the Industry_ABC_Classification.xlsx file first!");
    }

    // Show loading screen
    const loader = document.getElementById('loader');
    if(loader) loader.classList.remove('hidden');

    const reader = new FileReader();
    
    reader.onload = async (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            
            // Convert Excel to JSON array
            const jsonRows = XLSX.utils.sheet_to_json(worksheet);
            
            // --- THE BULLETPROOF FIX ---
            // Dynamically load the config file to guarantee we get the database connection
            const configModule = await import('./config.js');
            const supabaseClient = configModule.getSupabase();
            
            if (!supabaseClient) {
                throw new Error("Could not connect to Supabase database.");
            }
            // ---------------------------

            let successCount = 0;

            // Loop through the Excel rows and update Supabase
            for (let row of jsonRows) {
                const partName = row['Spare Part Name'];
                const aiClass = row['AI_Classification'];

                if (partName && aiClass) {
                    // Update the product in Supabase where the name matches exactly
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

            // Hide loader and show success!
            if(loader) loader.classList.add('hidden');
            fileInput.value = ''; // Reset file input
            
            // Show success message
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
            
            // Reload the inventory to show the badges instantly
            if (window.posModule && window.posModule.loadInventory) {
                await window.posModule.loadInventory();
            }

        } catch (err) {
            if(loader) loader.classList.add('hidden');
            alert("Error processing Excel file: " + err.message);
        }
    };
    
    reader.readAsArrayBuffer(file);
};
