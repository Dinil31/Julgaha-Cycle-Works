// js/ui.js
import { getRawData, setActiveContext, getActiveTable } from "./data.js";

let charts = {};
let currentMode = "past";
let currentLang = "en"; // 'en' or 'si'

// --- TRANSLATIONS ---
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
    "coming-soon": "ළඟදීම බලාපොරොත්තු වන්න",
    developing: "සකස් කරමින් පවතී",
  },
};

// --- HELPER: SHOW/HIDE DASHBOARD SECTIONS ---
function toggleDataView(show) {
  const ids = [
    "controls-section",
    "kpi-section",
    "charts-section-1",
    "charts-section-2",
  ];
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = show ? "" : "none";
  });
  const msgContainer = document.getElementById("coming-soon-container");
  if (show && msgContainer) msgContainer.innerHTML = "";
}

// --- RENDER COMING SOON SCREEN ---
export function renderComingSoon(title, iconClass = "fa-hard-hat") {
  toggleDataView(false);

  const container = document.getElementById("coming-soon-container");
  if (container) {
    const t = translations[currentLang];
    container.innerHTML = `
            <div class="flex flex-col items-center justify-center h-96 fade-in text-center mt-10">
                <div class="relative">
                    <div class="absolute inset-0 bg-blue-500 rounded-full opacity-20 animate-ping"></div>
                    <div class="bg-white dark:bg-slate-800 p-8 rounded-full shadow-lg relative z-10 animate-bounce">
                        <i class="fas ${iconClass} text-6xl text-blue-600 dark:text-blue-400"></i>
                    </div>
                </div>
                <h2 class="text-3xl font-bold text-slate-800 dark:text-white mt-8 mb-2">${title}</h2>
                <p class="text-gray-500 dark:text-gray-400 text-lg max-w-md">
                   CycleSense AI is processing... 
                </p>
                <div class="mt-6 flex gap-2">
                    <span class="px-4 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-bold uppercase tracking-wide">${t["developing"]}</span>
                    <span class="px-4 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold uppercase tracking-wide">${t["coming-soon"]}</span>
                </div>
            </div>
        `;
  }
}

// --- NAVIGATION HANDLER ---
export function switchContext(mode) {
  toggleDataView(true);
  currentMode = mode;

  const toggleContainer = document.getElementById("btn-past")?.parentElement;
  if (toggleContainer)
    toggleContainer.style.display = mode === "service" ? "none" : "flex";

  const btnPast = document.getElementById("btn-past");
  const btnPred = document.getElementById("btn-pred");
  const activeClass =
    "px-4 py-1 bg-slate-800 text-white rounded shadow transition-all";
  const inactiveClass =
    "px-4 py-1 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-700 rounded transition-all";

  if (btnPast)
    btnPast.className = mode === "past" ? activeClass : inactiveClass;
  if (btnPred)
    btnPred.className = mode === "predicted" ? activeClass : inactiveClass;

  setActiveContext(mode);
}

// --- TRANSLATION LOGIC ---
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

// --- SLICER LOGIC (FIXED) ---
export function populateSlicers() {
  const rawData = getRawData();
  const selMonth = document.getElementById("slicer-month");
  const selDay = document.getElementById("slicer-day");

  if (!selMonth || !selDay) return;

  // 1. Populate Months
  selMonth.innerHTML = '<option value="all">All Months</option>';
  const uniqueMonths = new Set();

  // Sort data to keep months in order
  const sortedData = [...rawData].sort((a, b) => a._date - b._date);

  sortedData.forEach((r) => {
    if (r._date)
      uniqueMonths.add(
        r._date.toLocaleString("default", { month: "long", year: "numeric" }),
      );
  });

  Array.from(uniqueMonths).forEach(
    (m) => (selMonth.innerHTML += `<option value="${m}">${m}</option>`),
  );

  // 2. Populate Days (Default to All)
  updateDaySlicer();
}

// Function to update Day Dropdown based on selected Month
function updateDaySlicer() {
  const rawData = getRawData();
  const selMonth = document.getElementById("slicer-month").value;
  const selDay = document.getElementById("slicer-day");

  // Save current selection if possible
  const currentDay = selDay.value;

  selDay.innerHTML = '<option value="all">All Days</option>';
  const uniqueDays = new Set();

  rawData.forEach((r) => {
    if (!r._date) return;
    const mStr = r._date.toLocaleString("default", {
      month: "long",
      year: "numeric",
    });

    // Only show days that belong to the selected month (or all if 'all' is selected)
    if (selMonth === "all" || mStr === selMonth) {
      uniqueDays.add(r._date.getDate());
    }
  });

  // Sort days numerically
  Array.from(uniqueDays)
    .sort((a, b) => a - b)
    .forEach((d) => {
      selDay.innerHTML += `<option value="${d}">${d}</option>`;
    });

  // Restore selection if valid, otherwise reset to 'all'
  if (currentDay !== "all" && uniqueDays.has(parseInt(currentDay))) {
    selDay.value = currentDay;
  } else {
    selDay.value = "all";
  }
}

export function handleMonthChange() {
  updateDaySlicer(); // Update days when month changes
  updateDashboard();
}

export function switchCat(cat) {
  updateDashboard();
}
export function toggleTheme() {
  document.documentElement.classList.toggle("dark");
  updateDashboard();
}

// --- DASHBOARD UPDATE ---
export function updateDashboard() {
  const rawData = getRawData();
  const activeTable = getActiveTable();
  const m = document.getElementById("slicer-month")?.value || "all";
  const d = document.getElementById("slicer-day")?.value || "all";

  let filtered = rawData.filter((r) => {
    if (!r._date) return false;
    // Filter by Month
    if (
      m !== "all" &&
      r._date.toLocaleString("default", { month: "long", year: "numeric" }) !==
        m
    )
      return false;
    // Filter by Day
    if (d !== "all" && r._date.getDate() != d) return false;
    return true;
  });

  if (activeTable === "service_logs") {
    renderServiceDashboard(filtered);
  } else {
    renderFinancialDashboard(filtered, m === "all");
  }
}

// --- FINANCIAL DASHBOARD ---
function renderFinancialDashboard(data, isYearView) {
  const t = translations[currentLang];

  setText("kpi-1-label", t["kpi-rev"]);
  setText("kpi-2-label", t["kpi-exp"]);
  setText("kpi-3-label", t["kpi-prof"]);

  let rev = 0,
    exp = 0;
  const comps = {};
  const cats = {};

  data.forEach((r) => {
    const rv = parseFloat(r.revenue) || 0;
    const ex = parseFloat(r.expense_amount) || 0;
    rev += rv;
    exp += ex;

    let k;
    // If showing specific month/day, group by Day. If showing All Time, group by Month.
    if (!isYearView) k = r._date.getDate();
    else {
      const y = r._date.getFullYear();
      const m = String(r._date.getMonth() + 1).padStart(2, "0");
      k = `${y}-${m}`;
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

  document.getElementById("val-rev").innerText = fmt(rev);
  document.getElementById("val-exp").innerText = fmt(exp);
  document.getElementById("val-prof").innerText = fmt(rev - exp);

  const labels = Object.keys(comps).sort();
  const dsRev = labels.map((k) => comps[k].r);
  const dsExp = labels.map((k) => comps[k].e);
  const commonOptions = {
    maintainAspectRatio: false,
    plugins: { legend: { labels: { color: "#9ca3af" } } },
    scales: {
      x: { ticks: { color: "#9ca3af" } },
      y: { ticks: { color: "#9ca3af" } },
    },
  };

  const ctx1 = document.getElementById("mainChart");
  if (charts.main) charts.main.destroy();
  charts.main = new Chart(ctx1, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
          label: t["kpi-rev"],
          data: dsRev,
          borderColor: "#3b82f6",
          backgroundColor: "rgba(59,130,246,0.1)",
          fill: true,
        },
        {
          label: t["kpi-exp"],
          data: dsExp,
          borderColor: "#ef4444",
          backgroundColor: "rgba(239,68,68,0.1)",
          fill: true,
        },
      ],
    },
    options: commonOptions,
  });

  const ctx2 = document.getElementById("subChart");
  if (charts.sub) charts.sub.destroy();
  if (currentMode === "past") {
    charts.sub = new Chart(ctx2, {
      type: "doughnut",
      data: {
        labels: Object.keys(cats),
        datasets: [
          {
            data: Object.values(cats),
            backgroundColor: [
              "#3b82f6",
              "#ef4444",
              "#f59e0b",
              "#10b981",
              "#8b5cf6",
            ],
          },
        ],
      },
      options: {
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "right", labels: { color: "#9ca3af" } },
        },
      },
    });
  } else {
    const profitData = labels.map((k) => comps[k].r - comps[k].e);
    const profitColors = profitData.map((p) =>
      p >= 0 ? "#10b981" : "#ef4444",
    );
    charts.sub = new Chart(ctx2, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Profit",
            data: profitData,
            backgroundColor: profitColors,
            borderRadius: 2,
          },
        ],
      },
      options: { ...commonOptions, plugins: { legend: { display: false } } },
    });
  }

  const ctx3 = document.getElementById("compChart");
  if (charts.comp) charts.comp.destroy();
  charts.comp = new Chart(ctx3, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [
        {
          label: t["kpi-rev"],
          data: dsRev,
          backgroundColor: "#3b82f6",
          borderRadius: 2,
        },
        {
          label: t["kpi-exp"],
          data: dsExp,
          backgroundColor: "#ef4444",
          borderRadius: 2,
        },
      ],
    },
    options: {
      ...commonOptions,
      plugins: {
        legend: { display: true, labels: { color: "#9ca3af" } },
        title: { display: false },
      },
    },
  });
}

// --- SERVICE DASHBOARD ---
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
  const formatK = (val) =>
    val >= 1000 ? (val / 1000).toFixed(2) + "K" : val.toFixed(0);

  document.getElementById("val-rev").innerText = formatK(avgService) + " LKR";
  document.getElementById("val-exp").innerText = formatK(avgTotal) + " LKR";
  document.getElementById("val-prof").innerText = jobCount;

  const sortedCycles = Object.keys(cycleStats).sort(
    (a, b) => cycleStats[b].total - cycleStats[a].total,
  );
  const topCycles = sortedCycles.slice(0, 15);
  const labels = topCycles;
  const dataService = topCycles.map((c) => cycleStats[c].service);
  const dataTotal = topCycles.map((c) => cycleStats[c].total);

  const commonOptions = {
    maintainAspectRatio: false,
    plugins: { legend: { labels: { color: "#9ca3af" } } },
    scales: {
      x: { ticks: { color: "#9ca3af" }, grid: { color: "#334155" } },
      y: { ticks: { color: "#9ca3af" }, grid: { color: "#334155" } },
    },
  };

  const ctx1 = document.getElementById("mainChart");
  if (charts.main) charts.main.destroy();
  charts.main = new Chart(ctx1, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Service",
          data: dataService,
          borderColor: "#3b82f6",
          backgroundColor: "rgba(59, 130, 246, 0.0)",
          tension: 0.1,
          borderWidth: 2,
        },
        {
          label: "Total",
          data: dataTotal,
          borderColor: "#1e3a8a",
          backgroundColor: "rgba(30, 58, 138, 0.0)",
          tension: 0.1,
          borderWidth: 2,
        },
      ],
    },
    options: {
      ...commonOptions,
      interaction: { mode: "index", intersect: false },
    },
  });

  const ctx2 = document.getElementById("subChart");
  if (charts.sub) charts.sub.destroy();
  charts.sub = new Chart(ctx2, {
    type: "bar",
    indexAxis: "y",
    data: {
      labels: labels.slice(0, 10),
      datasets: [
        {
          label: "Total",
          data: dataTotal.slice(0, 10),
          backgroundColor: "#3b82f6",
          borderRadius: 4,
        },
      ],
    },
    options: { ...commonOptions, plugins: { legend: { display: false } } },
  });

  const ctx3 = document.getElementById("compChart");
  if (charts.comp) charts.comp.destroy();
  charts.comp = new Chart(ctx3, {
    type: "bar",
    indexAxis: "y",
    data: {
      labels: labels.slice(0, 10),
      datasets: [
        {
          label: "Service",
          data: dataService.slice(0, 10),
          backgroundColor: "#10b981",
          borderRadius: 4,
        },
      ],
    },
    options: { ...commonOptions, plugins: { legend: { display: false } } },
  });
}
