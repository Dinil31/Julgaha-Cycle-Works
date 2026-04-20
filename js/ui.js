// js/ui.js
import { getRawData, setActiveContext, getActiveTable } from "./data.js";

let charts = {};
let currentMode = "past";
let currentLang = "en";

const translations = {
  en: {
    "nav-revenue": "Financials",
    "nav-service": "Service Cost",
    "nav-inventory": "Inventory",
    "nav-supplier": "Procurement",
    "kpi-rev": "Revenue",
    "kpi-exp": "Expenses",
    "kpi-prof": "Net Profit",
    "kpi-svc-cost": "Average Service Cost",
    "kpi-tot-cost": "Average Total Cost",
    "kpi-repairs": "Total Repairs",
    "btn-past": "Past",
    "btn-pred": "Predicted",
    "coming-soon": "Coming Soon",
    developing: "Still Developing",
  },
  si: {
    "nav-revenue": "මූල්‍ය කාර්ය සාධනය",
    "nav-service": "සේවා පිරිවැය",
    "nav-inventory": "තොග",
    "nav-supplier": "මිලදී ගැනීම්",
    "kpi-rev": "ආදායම",
    "kpi-exp": "වියදම්",
    "kpi-prof": "ශුද්ධ ලාභය",
    "kpi-svc-cost": "සාමාන්‍ය සේවා පිරිවැය",
    "kpi-tot-cost": "සාමාන්‍ය මුළු පිරිවැය",
    "kpi-repairs": "මුළු අලුත්වැඩියා",
    "btn-past": "පසුගිය",
    "btn-pred": "අනාවැකි",
    "coming-soon": "ළඟදීම",
    developing: "සකස් කරමින් පවතී",
  },
};

// --- CONFETTI MAKER ---
function fireConfetti() {
  const colors = ["#ef4444", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6"];
  for (let i = 0; i < 60; i++) {
    const c = document.createElement("div");
    c.className = "confetti-piece";
    c.style.left = Math.random() * 100 + "vw";
    c.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    c.style.animationDuration = Math.random() * 2 + 1.5 + "s";
    document.body.appendChild(c);
    setTimeout(() => c.remove(), 3500);
  }
}

// --- SMART MODAL FUNCTION ---
export function showCustomConfirm(title, message, type = "confirm") {
  return new Promise((resolve) => {
    const modal = document.getElementById("custom-modal");
    const box = document.getElementById("modal-box");
    const iconBg = document.getElementById("modal-icon-bg");
    const icon = document.getElementById("modal-icon");
    const h3 = document.getElementById("modal-title");
    const p = document.getElementById("modal-msg");
    const btnYes = document.getElementById("modal-btn-confirm");
    const btnNo = document.getElementById("modal-btn-cancel");

    h3.innerText = title;
    p.innerText = message;

    iconBg.className = "mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4";
    btnNo.style.display = "block"; 
    btnYes.innerText = "Confirm";

    if (type === "danger") {
      iconBg.classList.add("bg-red-100", "animate-bounce");
      icon.className = "fas fa-exclamation-triangle text-2xl text-red-600";
      btnYes.className = "px-5 py-2 rounded-xl bg-red-600 text-white hover:bg-red-700 font-bold shadow-lg shadow-red-500/30";
      btnYes.innerText = "Yes, Delete";
    } else if (type === "success-green") {
      fireConfetti(); 
      iconBg.classList.add("bg-green-100", "pulse-green");
      icon.className = "fas fa-check-circle text-3xl text-green-600";
      btnYes.className = "w-full px-5 py-2 rounded-xl bg-green-600 text-white hover:bg-green-700 font-bold shadow-lg shadow-green-500/30 transform hover:scale-105 transition";
      btnYes.innerText = "Done";
      btnNo.style.display = "none"; 
    } else if (type === "success-red") {
      iconBg.classList.add("bg-red-100", "pulse-red");
      icon.className = "fas fa-trash-check text-3xl text-red-600"; 
      if (!icon.className.includes("fa-")) icon.className = "fas fa-check text-3xl text-red-600";
      btnYes.className = "w-full px-5 py-2 rounded-xl bg-red-600 text-white hover:bg-red-700 font-bold shadow-lg shadow-red-500/30 transform hover:scale-105 transition";
      btnYes.innerText = "Done";
      btnNo.style.display = "none"; 
    } else {
      iconBg.classList.add("bg-blue-100", "animate-bounce");
      icon.className = "fas fa-info-circle text-2xl text-blue-600";
      btnYes.className = "px-5 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 font-bold shadow-lg shadow-blue-500/30";
    }

    modal.classList.remove("hidden");
    box.classList.add("animate-pop-in");

    const close = (val) => {
      modal.classList.add("hidden");
      box.classList.remove("animate-pop-in");
      resolve(val);
    };

    btnYes.onclick = () => close(true);
    btnNo.onclick = () => close(false);
  });
}

export function showCustomPrompt(title, message, placeholder = "") {
  return new Promise((resolve) => {
    const modal = document.getElementById("input-modal");
    const box = document.getElementById("input-modal-box");
    const titleEl = document.getElementById("input-title");
    const msgEl = document.getElementById("input-msg");
    const inputEl = document.getElementById("modal-input-field");
    const btnYes = document.getElementById("input-btn-confirm");
    const btnNo = document.getElementById("input-btn-cancel");
    
    titleEl.innerText = title;
    msgEl.innerText = message;
    inputEl.placeholder = placeholder;
    inputEl.value = "";
    
    modal.classList.remove("hidden");
    box.classList.add("animate-pop-in");
    inputEl.focus();
    
    const close = (val) => {
      modal.classList.add("hidden");
      box.classList.remove("animate-pop-in");
      resolve(val);
    };
    
    btnYes.onclick = () => close(inputEl.value);
    btnNo.onclick = () => close(null);
    inputEl.onkeydown = (e) => {
      if (e.key === "Enter") close(inputEl.value);
      if (e.key === "Escape") close(null);
    };
  });
}

function toggleDataView(show) {
  const ids = ["controls-section", "kpi-section", "charts-section-1", "charts-section-2"];
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = show ? "" : "none";
  });
  const msgContainer = document.getElementById("coming-soon-container");
  if (show && msgContainer) msgContainer.innerHTML = "";
}

export function renderComingSoon(title, iconClass = "fa-hard-hat") {
  toggleDataView(false);
  const container = document.getElementById("coming-soon-container");
  if (container) {
    const t = translations[currentLang];
    container.innerHTML = `<div class="flex flex-col items-center justify-center h-96 fade-in text-center mt-10"><div class="relative"><div class="absolute inset-0 bg-blue-500 rounded-full opacity-20 animate-ping"></div><div class="bg-white dark:bg-slate-800 p-8 rounded-full shadow-lg relative z-10 animate-bounce"><i class="fas ${iconClass} text-6xl text-blue-600 dark:text-blue-400"></i></div></div><h2 class="text-3xl font-bold text-slate-800 dark:text-white mt-8 mb-2">${title}</h2><p class="text-gray-500 dark:text-gray-400 text-lg max-w-md">CycleSense AI is processing...</p><div class="mt-6 flex gap-2"><span class="px-4 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-bold uppercase tracking-wide">${t["developing"]}</span><span class="px-4 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold uppercase tracking-wide">${t["coming-soon"]}</span></div></div>`;
  }
}

export function switchContext(mode) {
  toggleDataView(true);
  currentMode = mode;
  const toggleContainer = document.getElementById("btn-past")?.parentElement;
  if (toggleContainer) toggleContainer.style.display = mode === "service" ? "none" : "flex";
  
  const btnPast = document.getElementById("btn-past");
  const btnPred = document.getElementById("btn-pred");
  const activeClass = "px-4 py-1 bg-slate-800 text-white rounded shadow transition-all";
  const inactiveClass = "px-4 py-1 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-700 rounded transition-all";
  
  if (btnPast) btnPast.className = mode === "past" ? activeClass : inactiveClass;
  if (btnPred) btnPred.className = mode === "predicted" ? activeClass : inactiveClass;
  
  setActiveContext(mode);
}

export function toggleLang() {
  currentLang = currentLang === "en" ? "si" : "en";
  const btn = document.getElementById("lang-btn");
  if (btn) btn.innerText = currentLang === "en" ? "SIN" : "ENG";
  const t = translations[currentLang];
  setText("nav-revenue-text", t["nav-revenue"]);
  setText("nav-service-text", t["nav-service"]);
  setText("nav-inventory-text", t["nav-inventory"]);
  setText("nav-supplier-text", t["nav-supplier"]);
  setText("btn-past", t["btn-past"]);
  setText("btn-pred", t["btn-pred"]);
  updateDashboard();
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.innerText = text;
}

// --- DYNAMICALLY BUILD SLICERS WITH CORRECT NUMERICAL VALUES ---
export function populateSlicers() {
  const rawData = getRawData();
  const yearSelect = document.getElementById("slicer-year");
  const monthSelect = document.getElementById("slicer-month");
  
  if (!rawData || rawData.length === 0) return;

  const uniqueYears = new Set();
  const uniqueMonths = new Set();

  // Extract available years and months from database
  rawData.forEach((r) => {
    if (r._date) {
        uniqueYears.add(r._date.getFullYear());
        uniqueMonths.add(r._date.getMonth()); // 0 to 11
    }
  });

  // 1. Build Year Dropdown
  if (yearSelect) {
      const currentYear = yearSelect.value;
      yearSelect.innerHTML = '<option value="all">All Years</option>';
      [...uniqueYears].sort((a, b) => b - a).forEach((y) => {
        yearSelect.innerHTML += `<option value="${y}">${y}</option>`;
      });
      if ([...uniqueYears].includes(parseInt(currentYear))) {
        yearSelect.value = currentYear;
      }
  }

  // 2. Build Month Dropdown (Matching numerical values to names)
  if (monthSelect) {
      const currentMonth = monthSelect.value;
      monthSelect.innerHTML = '<option value="all">All Months</option>';
      
      const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      
      [...uniqueMonths].sort((a, b) => a - b).forEach((mIndex) => {
        // IMPORTANT: Value is the number (e.g., "7"), Text is "August"
        monthSelect.innerHTML += `<option value="${mIndex}">${monthNames[mIndex]}</option>`;
      });
      
      if ([...uniqueMonths].includes(parseInt(currentMonth))) {
        monthSelect.value = currentMonth;
      }
  }
}

export function handleMonthChange() {
  updateDashboard();
}

export function toggleTheme() {
  document.documentElement.classList.toggle("dark");
  updateDashboard();
}

// --- ADVANCED DASHBOARD FILTERING ---
export function updateDashboard() {
  const rawData = getRawData();
  const activeTable = getActiveTable();

  // Get values from UI inputs (Handle multiple possible IDs just in case)
  const y = document.getElementById("slicer-year")?.value || "all";
  const m = document.getElementById("slicer-month")?.value || "all";
  const dStr = document.getElementById("slicer-date")?.value || document.getElementById("slicer-day")?.value || "";

  let filtered = rawData.filter((r) => {
    if (!r._date) return false;

    // 1. Exact Date overrides Year/Month
    if (dStr) {
        const localDateStr = r._date.getFullYear() + '-' + String(r._date.getMonth() + 1).padStart(2, '0') + '-' + String(r._date.getDate()).padStart(2, '0');
        if (localDateStr !== dStr) return false;
    } else {
        // 2. Filter by Year & Month
        if (y !== "all" && r._date.getFullYear().toString() !== y) return false;
        if (m !== "all" && r._date.getMonth().toString() !== m) return false;
    }

    return true;
  });

  // If a specific month is selected (and no exact day), show days on the chart instead of the whole year
  const isSummaryView = (m === "all" && !dStr);

  if (activeTable === "service_logs") {
    renderServiceDashboard(filtered);
  } else {
    renderFinancialDashboard(filtered, isSummaryView);
  }
}

function renderFinancialDashboard(data, isYearView) {
  const t = translations[currentLang];
  setText("kpi-1-label", t["kpi-rev"]);
  setText("kpi-2-label", t["kpi-exp"]);
  setText("kpi-3-label", t["kpi-prof"]);
  
  let rev = 0, exp = 0;
  const comps = {};
  const cats = {};
  
  data.forEach((r) => {
    const rv = parseFloat(r.revenue) || parseFloat(r.total_amount) || 0;
    const ex = parseFloat(r.expense_amount) || 0;
    rev += rv;
    exp += ex;
    
    let k;
    if (!isYearView) {
        k = r._date.getDate(); // Group by Day (1, 2, 3...)
    } else {
        const y = r._date.getFullYear();
        const m = String(r._date.getMonth() + 1).padStart(2, "0");
        k = `${y}-${m}`; // Group by Year-Month (2024-10)
    }
    
    if (!comps[k]) comps[k] = { r: 0, e: 0 };
    comps[k].r += rv;
    comps[k].e += ex;
    
    if (ex > 0) {
      const desc = r.expense_desc || "Other";
      cats[desc] = (cats[desc] || 0) + ex;
    }
  });

  const fmt = (v) =>
    isYearView
      ? (v / 1000000).toFixed(2) + "M"
      : new Intl.NumberFormat("en-LK", {
          style: "currency",
          currency: "LKR",
        }).format(v);
        
  const elRev = document.getElementById("val-rev");
  const elExp = document.getElementById("val-exp");
  const elProf = document.getElementById("val-prof");
  
  if (elRev) elRev.innerText = fmt(rev);
  if (elExp) elExp.innerText = fmt(exp);
  if (elProf) elProf.innerText = fmt(rev - exp);

  // FIX: Ensure Days (1, 2, 10, 11) sort numerically, and Dates (2024-10) sort alphabetically
  const labels = Object.keys(comps).sort((a, b) => {
      if (!isNaN(a) && !isNaN(b)) return Number(a) - Number(b);
      return a.localeCompare(b);
  });
  
  const dsRev = labels.map((k) => comps[k].r);
  const dsExp = labels.map((k) => comps[k].e);
  
  const commonOptions = {
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: "#9ca3af" } },
      title: {
        display: true,
        text: "Revenue & Expenses Trend",
        color: "#6b7280",
      },
    },
    scales: {
      x: {
        ticks: { color: "#9ca3af" },
        title: { display: true, text: "Time Period", color: "#9ca3af" },
      },
      y: {
        ticks: { color: "#9ca3af" },
        title: { display: true, text: "Amount (LKR)", color: "#9ca3af" },
      },
    },
  };

  const ctx1 = document.getElementById("mainChart");
  if (charts.main) charts.main.destroy();
  if (ctx1) {
      charts.main = new Chart(ctx1, {
        type: "line",
        data: {
          labels: labels,
          datasets: [
            {
              label: t["kpi-rev"] || "Revenue",
              data: dsRev,
              borderColor: "#3b82f6",
              backgroundColor: "rgba(59,130,246,0.1)",
              fill: true,
            },
            {
              label: t["kpi-exp"] || "Expenses",
              data: dsExp,
              borderColor: "#ef4444",
              backgroundColor: "rgba(239,68,68,0.1)",
              fill: true,
            },
          ],
        },
        options: commonOptions,
      });
  }

  const ctx2 = document.getElementById("subChart");
  if (charts.sub) charts.sub.destroy();
  if (ctx2) {
      if (currentMode === "past") {
        charts.sub = new Chart(ctx2, {
          type: "doughnut",
          data: {
            labels: Object.keys(cats),
            datasets: [
              {
                data: Object.values(cats),
                backgroundColor: ["#3b82f6", "#ef4444", "#f59e0b", "#10b981", "#8b5cf6"],
              },
            ],
          },
          options: {
            maintainAspectRatio: false,
            plugins: {
              legend: { position: "right", labels: { color: "#9ca3af" } },
              title: { display: true, text: "Expense Breakdown", color: "#6b7280" },
            },
          },
        });
      } else {
        const profitData = labels.map((k) => comps[k].r - comps[k].e);
        const profitColors = profitData.map((p) => p >= 0 ? "#10b981" : "#ef4444");
        charts.sub = new Chart(ctx2, {
          type: "bar",
          data: {
            labels: labels,
            datasets: [{ label: "Profit", data: profitData, backgroundColor: profitColors, borderRadius: 2 }],
          },
          options: {
            ...commonOptions,
            plugins: {
              legend: { display: false },
              title: { display: true, text: "Net Profit", color: "#6b7280" },
            },
          },
        });
      }
  }
}

function renderServiceDashboard(data) {
  const t = translations[currentLang];
  setText("kpi-1-label", t["kpi-svc-cost"]);
  setText("kpi-2-label", t["kpi-tot-cost"]);
  setText("kpi-3-label", t["kpi-repairs"]);
  let jobCount = 0;
  let grandTotalService = 0;
  let grandTotalCost = 0;
  const cycleStats = {};
  
  data.forEach((r) => {
    jobCount++;
    const svc = parseFloat(r.service_cost) || 0;
    const tot = parseFloat(r.total_cost) || 0;
    grandTotalService += svc;
    grandTotalCost += tot;
    const bike = r.cycle_name || "Unknown";
    if (!cycleStats[bike])
      cycleStats[bike] = { service: 0, total: 0, count: 0 };
    cycleStats[bike].service += svc;
    cycleStats[bike].total += tot;
    cycleStats[bike].count += 1;
  });

  const avgService = jobCount > 0 ? grandTotalService / jobCount : 0;
  const avgTotal = jobCount > 0 ? grandTotalCost / jobCount : 0;
  const formatK = (val) => val >= 1000 ? (val / 1000).toFixed(2) + "K" : val.toFixed(0);
  
  document.getElementById("val-rev").innerText = formatK(avgService) + " LKR";
  document.getElementById("val-exp").innerText = formatK(avgTotal) + " LKR";
  document.getElementById("val-prof").innerText = jobCount;
  
  const sortedCycles = Object.keys(cycleStats).sort((a, b) => cycleStats[b].total - cycleStats[a].total);
  const topCycles = sortedCycles.slice(0, 15);
  const labels = topCycles;
  const dataService = topCycles.map((c) => cycleStats[c].service);
  const dataTotal = topCycles.map((c) => cycleStats[c].total);
  
  const commonOptions = {
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: "#9ca3af" } },
      title: { display: true, text: "Service Cost Trends", color: "#6b7280" },
    },
    scales: {
      x: { ticks: { color: "#9ca3af" }, grid: { color: "#334155" }, title: { display: true, text: "Cycle Model", color: "#9ca3af" } },
      y: { ticks: { color: "#9ca3af" }, grid: { color: "#334155" }, title: { display: true, text: "Cost (LKR)", color: "#9ca3af" } },
    },
  };
  
  const ctx1 = document.getElementById("mainChart");
  if (charts.main) charts.main.destroy();
  if (ctx1) {
      charts.main = new Chart(ctx1, {
        type: "line",
        data: {
          labels: labels,
          datasets: [
            { label: "Service", data: dataService, borderColor: "#3b82f6", backgroundColor: "rgba(59, 130, 246, 0.0)", tension: 0.1, borderWidth: 2 },
            { label: "Total", data: dataTotal, borderColor: "#1e3a8a", backgroundColor: "rgba(30, 58, 138, 0.0)", tension: 0.1, borderWidth: 2 },
          ],
        },
        options: { ...commonOptions, interaction: { mode: "index", intersect: false } },
      });
  }

  const ctx2 = document.getElementById("subChart");
  if (charts.sub) charts.sub.destroy();
  if (ctx2) {
      charts.sub = new Chart(ctx2, {
        type: "bar",
        indexAxis: "y",
        data: {
          labels: labels.slice(0, 10),
          datasets: [{ label: "Total Cost", data: dataTotal.slice(0, 10), backgroundColor: "#3b82f6", borderRadius: 4 }],
        },
        options: { ...commonOptions, plugins: { legend: { display: false }, title: { display: true, text: "Top 10 Models by Total Cost", color: "#6b7280" } } },
      });
  }
}
