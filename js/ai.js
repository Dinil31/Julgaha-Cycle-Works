// js/ai.js
import { getRawData, getActiveTable } from "./data.js";

const chatHistory = document.getElementById("ai-chat-history");

// --- TOGGLE VISIBILITY ---
export function toggleAI() {
  const modal = document.getElementById("ai-modal");
  if (!modal) return;
  modal.classList.toggle("hidden");

  // Greeting if empty
  if (chatHistory && chatHistory.children.length === 0) {
    addBotMessage(
      "👋 Hi! I'm CycleSense Pro.<br>Ask me things like:<br>• 'Best month in 2025'<br>• 'Total profit'<br>• 'Most common repair'",
    );
  }
}

// --- CLEAR CHAT (Kept this feature) ---
export function clearAIChat() {
  if (chatHistory) {
    chatHistory.innerHTML = "";
    addBotMessage("Chat history cleared. Ready for new questions! 🗑️");
  }
}

// --- HANDLE USER INPUT ---
export function handleUserQuery(e) {
  if (e.key === "Enter") {
    const input = document.getElementById("ai-input");
    const text = input.value.trim();
    if (!text) return;

    addUserMessage(text);
    input.value = "";

    showTypingIndicator();
    setTimeout(() => {
      removeTypingIndicator();
      const response = generateResponse(text);
      addBotMessage(response);
    }, 600);
  }
}

// --- LOGIC (REVERTED TO THE "GOOD" VERSION) ---
function generateResponse(query) {
  let data = getRawData();
  const table = getActiveTable();
  const q = query.toLowerCase();

  if (!data || data.length === 0)
    return "I don't see any data. Please sync an Excel file first.";

  // 1. INTELLIGENT FILTERING: Check for Year (e.g., "in 2025")
  const yearMatch = q.match(/\b20\d{2}\b/);
  if (yearMatch) {
    const year = parseInt(yearMatch[0]);
    data = data.filter((r) => r._date && r._date.getFullYear() === year);
    if (data.length === 0)
      return `I couldn't find any records for the year ${year}.`;
  }

  // --- FINANCIAL CONTEXT ---
  if (table.includes("financial")) {
    // Q: Best/Highest Revenue Month? (This logic was missing in the 'bad' version)
    if (
      q.includes("month") &&
      (q.includes("best") ||
        q.includes("highest") ||
        q.includes("most") ||
        q.includes("revenue"))
    ) {
      return calculateBestMonth(data, "revenue");
    }

    // Q: Highest Single Day Revenue?
    if (
      q.includes("highest") &&
      q.includes("revenue") &&
      !q.includes("month")
    ) {
      const max = data.reduce((prev, current) =>
        prev.revenue > current.revenue ? prev : current,
      );
      return `The single highest revenue day was ${new Date(max.date).toLocaleDateString()} with ${formatCurrency(max.revenue)}.`;
    }

    // Q: Total Revenue?
    if (q.includes("total") && q.includes("revenue")) {
      const total = data.reduce((sum, r) => sum + (r.revenue || 0), 0);
      return `Total revenue ${yearMatch ? "for " + yearMatch[0] : ""} is ${formatCurrency(total)}.`;
    }

    // Q: Highest Expense Category?
    if (
      q.includes("highest") &&
      (q.includes("expense") || q.includes("cost")) &&
      (q.includes("type") || q.includes("category"))
    ) {
      return calculateTopCategory(data, "expense_desc", "expense_amount");
    }

    // Q: Total Profit?
    if (q.includes("profit") || q.includes("net")) {
      const rev = data.reduce((sum, r) => sum + (r.revenue || 0), 0);
      const exp = data.reduce((sum, r) => sum + (r.expense_amount || 0), 0);
      return `Net profit is ${formatCurrency(rev - exp)}.`;
    }
  }

  // --- SERVICE CONTEXT ---
  if (table.includes("service")) {
    // Q: Most Common Repair / Bike?
    if (
      q.includes("most") &&
      (q.includes("common") ||
        q.includes("popular") ||
        q.includes("bike") ||
        q.includes("model"))
    ) {
      return calculateMostFrequent(data, "cycle_name");
    }

    // Q: Total Repairs?
    if (
      q.includes("how many") ||
      q.includes("count") ||
      q.includes("total repair")
    ) {
      return `We performed ${data.length} repairs ${yearMatch ? "in " + yearMatch[0] : ""}.`;
    }

    // Q: Highest Service Cost?
    if (q.includes("highest") && q.includes("cost")) {
      const max = data.reduce((prev, current) =>
        prev.total_cost > current.total_cost ? prev : current,
      );
      return `The most expensive repair was for a ${max.cycle_name} on ${new Date(max.date).toLocaleDateString()} costing ${formatCurrency(max.total_cost)}.`;
    }
  }

  // --- GREETINGS ---
  if (q.includes("hello") || q.includes("hi"))
    return "Hello! I can analyze your sales and repairs. Try asking 'Best month' or 'Total profit'.";
  if (q.includes("thank")) return "You're welcome! 🚵";

  return "I'm not sure. Try asking about 'Best month', 'Total profit', 'Most common bike', or include a year like '2025'.";
}

// --- CALCULATION HELPERS (The "Good" Logic) ---

function calculateBestMonth(data, field) {
  const monthlyTotals = {};

  data.forEach((r) => {
    if (!r._date) return;
    const monthKey = r._date.toLocaleString("default", {
      month: "long",
      year: "numeric",
    });
    monthlyTotals[monthKey] = (monthlyTotals[monthKey] || 0) + (r[field] || 0);
  });

  let bestMonth = "";
  let maxVal = -1;

  for (const [month, total] of Object.entries(monthlyTotals)) {
    if (total > maxVal) {
      maxVal = total;
      bestMonth = month;
    }
  }

  if (maxVal === -1) return "No sufficient data to calculate monthly totals.";
  return `The best month was **${bestMonth}** with a total of ${formatCurrency(maxVal)}.`;
}

function calculateMostFrequent(data, field) {
  const counts = {};
  data.forEach((r) => {
    const key = r[field] || "Unknown";
    counts[key] = (counts[key] || 0) + 1;
  });

  let topItem = "";
  let maxCount = -1;

  for (const [item, count] of Object.entries(counts)) {
    if (count > maxCount) {
      maxCount = count;
      topItem = item;
    }
  }

  return `The most common model is **${topItem}** (seen ${maxCount} times).`;
}

function calculateTopCategory(data, labelField, valueField) {
  const totals = {};
  data.forEach((r) => {
    const key = r[labelField] || "Other";
    totals[key] = (totals[key] || 0) + (r[valueField] || 0);
  });

  let topCat = "";
  let maxVal = -1;

  for (const [cat, val] of Object.entries(totals)) {
    if (val > maxVal) {
      maxVal = val;
      topCat = cat;
    }
  }

  return `The highest expense category is **${topCat}** costing ${formatCurrency(maxVal)}.`;
}

// --- UI HELPERS ---
function formatCurrency(val) {
  return new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
  }).format(val);
}

function addUserMessage(text) {
  const div = document.createElement("div");
  div.className = "flex justify-end mb-2 fade-in";
  div.innerHTML = `<div class="bg-blue-600 text-white px-4 py-2 rounded-2xl rounded-tr-none max-w-[80%] shadow-md text-sm">${text}</div>`;
  chatHistory.appendChild(div);
  chatHistory.scrollTop = chatHistory.scrollHeight;
}

function addBotMessage(text) {
  const div = document.createElement("div");
  div.className = "flex justify-start mb-2 fade-in";
  div.innerHTML = `
        <div class="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center mr-2 shadow-sm shrink-0">
            <i class="fas fa-robot text-purple-600 text-xs"></i>
        </div>
        <div class="bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200 px-4 py-2 rounded-2xl rounded-tl-none max-w-[80%] shadow-md text-sm border dark:border-gray-600">
            ${text}
        </div>`;
  chatHistory.appendChild(div);
  chatHistory.scrollTop = chatHistory.scrollHeight;
}

function showTypingIndicator() {
  const div = document.createElement("div");
  div.id = "ai-typing";
  div.className = "flex justify-start mb-2 fade-in";
  div.innerHTML = `<div class="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center mr-2 shrink-0"><i class="fas fa-robot text-purple-600 text-xs"></i></div><div class="bg-white dark:bg-slate-700 px-4 py-3 rounded-2xl rounded-tl-none shadow-md border dark:border-gray-600 flex gap-1"><div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div><div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-75"></div><div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-150"></div></div>`;
  chatHistory.appendChild(div);
  chatHistory.scrollTop = chatHistory.scrollHeight;
}

function removeTypingIndicator() {
  const el = document.getElementById("ai-typing");
  if (el) el.remove();
}
