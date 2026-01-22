// js/ai.js
import { getRawData, getActiveTable } from "./data.js";

const chatHistory = document.getElementById("ai-chat-history");

// --- TOGGLE VISIBILITY ---
export function toggleAI() {
  const modal = document.getElementById("ai-modal");
  if (!modal) return;
  modal.classList.toggle("hidden");

  if (chatHistory && chatHistory.children.length === 0) {
    showWelcomeMessage();
  }
}

function showWelcomeMessage() {
  const table = getActiveTable();
  let suggestions = [];

  // Context-aware buttons
  if (table.includes("financial")) {
    suggestions = [
      "Highest revenue month 2025",
      "Total profit in 2025",
      "Lowest expense month",
      "Best day in 2025",
    ];
  } else {
    suggestions = [
      "Most common bike",
      "Total repair jobs",
      "Average service cost",
      "Recent repairs",
    ];
  }

  let buttonsHtml = `<div class="flex flex-wrap gap-2 mt-3">`;
  suggestions.forEach((s) => {
    buttonsHtml += `<button onclick="window.triggerAIQuery('${s}')" class="bg-purple-100 dark:bg-slate-600 text-purple-700 dark:text-purple-200 text-xs px-3 py-1.5 rounded-full hover:bg-purple-200 dark:hover:bg-slate-500 transition border border-purple-200 dark:border-slate-500 font-medium">${s}</button>`;
  });
  buttonsHtml += `</div>`;

  addBotMessage(
    `👋 <strong>Hi!</strong> I'm CycleSense AI.<br>Ask me about your data:${buttonsHtml}`,
  );
}

// --- CLEAR CHAT ---
export function clearAIChat() {
  if (chatHistory) {
    chatHistory.innerHTML = "";
    showWelcomeMessage();
  }
}

// --- CLICK HANDLER ---
export function triggerAIQuery(text) {
  const input = document.getElementById("ai-input");
  if (input) input.value = "";
  addUserMessage(text);
  processResponse(text);
}

// --- TYPING HANDLER ---
export function handleUserQuery(e) {
  if (e.key === "Enter") {
    const input = document.getElementById("ai-input");
    const text = input.value.trim();
    if (!text) return;

    addUserMessage(text);
    input.value = "";
    processResponse(text);
  }
}

// --- PROCESSOR ---
function processResponse(text) {
  showTypingIndicator();
  setTimeout(() => {
    removeTypingIndicator();
    const response = generateSmartResponse(text);
    addBotMessage(response);
  }, 700);
}

// --- 🧠 THE SMART BRAIN LOGIC ---
function generateSmartResponse(query) {
  let data = getRawData();
  const table = getActiveTable();
  const q = query.toLowerCase();

  // 0. DATA CHECK
  if (!data || data.length === 0)
    return "I don't see any data loaded. Please sync an Excel file first.";

  // 1. GREETINGS & CLOSINGS
  const greetings = [
    "hi",
    "hello",
    "hey",
    "good morning",
    "good afternoon",
    "good evening",
  ];
  if (greetings.some((g) => q === g || q.startsWith(g + " ")))
    return "Hello! 👋 I'm ready to analyze your shop's performance.";

  const closings = ["bye", "goodbye", "see ya", "thank you", "thanks"];
  if (closings.some((c) => q.includes(c)))
    return "You're welcome! Happy cycling! 🚲";

  // 2. PARSE DATE CONTEXT
  let targetYear = null;
  const yearMatch = q.match(/\b20\d{2}\b/);
  if (yearMatch) targetYear = parseInt(yearMatch[0]);

  let targetMonth = null;
  const monthsFull = [
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",
  ];
  const monthsShort = [
    "jan",
    "feb",
    "mar",
    "apr",
    "may",
    "jun",
    "jul",
    "aug",
    "sep",
    "oct",
    "nov",
    "dec",
  ];

  monthsFull.forEach((m, i) => {
    if (q.includes(m)) targetMonth = i;
  });
  if (targetMonth === null)
    monthsShort.forEach((m, i) => {
      if (q.includes(m)) targetMonth = i;
    });

  // 3. INTELLIGENT FILTERING
  // IMPORTANT: We filter a COPY of the data to answer specific questions,
  // but we keep the original data for "Best Month" calculations across the whole year.
  let filteredData = data.filter((r) => {
    if (!r._date) return false;
    let match = true;
    if (targetYear !== null)
      match = match && r._date.getFullYear() === targetYear;
    if (targetMonth !== null && !q.includes("month"))
      match = match && r._date.getMonth() === targetMonth;
    return match;
  });

  // --- ERROR HANDLING FOR "NO DATA" ---
  if ((targetYear || targetMonth !== null) && filteredData.length === 0) {
    // Smart Hint System
    const activeIsPast = table.includes("past");
    if (activeIsPast && targetYear && targetYear > 2025) {
      return `⚠️ I couldn't find data for **${targetYear}** in the **Past Financials** tab.<br><br>💡 **Tip:** Try switching the dashboard to **'Predicted'** mode to see future forecasts!`;
    }
    return `I looked for data in **${targetYear || ""} ${targetMonth !== null ? monthsFull[targetMonth] : ""}** but found nothing matching that date.`;
  }

  // 4. FINANCIAL QUESTIONS
  if (table.includes("financial")) {
    // A. Specific Date (e.g., "Revenue on Jan 5")
    // Regex looks for "5", "5th", "05" near date words
    const dayMatch = q.match(/(\d{1,2})(?:st|nd|rd|th)?/);
    if (targetMonth !== null && dayMatch) {
      const day = parseInt(dayMatch[1]);
      // Search in the main data set to be safe
      const dayRecord = data.find(
        (r) =>
          r._date &&
          r._date.getMonth() === targetMonth &&
          r._date.getDate() === day &&
          (targetYear ? r._date.getFullYear() === targetYear : true),
      );

      if (dayRecord) {
        const p = (dayRecord.revenue || 0) - (dayRecord.expense_amount || 0);
        if (q.includes("revenue"))
          return `📅 **${dayRecord._date.toLocaleDateString()}** Revenue: **${formatCurrency(dayRecord.revenue)}**`;
        if (q.includes("expense"))
          return `📅 **${dayRecord._date.toLocaleDateString()}** Expenses: **${formatCurrency(dayRecord.expense_amount)}**`;
        if (q.includes("profit") || q.includes("net"))
          return `📅 **${dayRecord._date.toLocaleDateString()}** Net Profit: **${formatCurrency(p)}**`;
        // Default: Show all
        return `📅 **${dayRecord._date.toLocaleDateString()}**: <br>Revenue: ${formatCurrency(dayRecord.revenue)}<br>Expense: ${formatCurrency(dayRecord.expense_amount)}<br>**Profit: ${formatCurrency(p)}**`;
      }
    }

    // B. Extremes (Best/Worst/Highest/Lowest)
    if (
      q.includes("highest") ||
      q.includes("most") ||
      q.includes("best") ||
      q.includes("lowest") ||
      q.includes("least") ||
      q.includes("worst")
    ) {
      const isMax =
        q.includes("highest") || q.includes("most") || q.includes("best");
      const type = isMax ? "max" : "min";
      // Use 'data' (full set filtered by year if specified) instead of 'filteredData' (which might be filtered by month)
      const analysisData = targetYear
        ? data.filter((r) => r._date && r._date.getFullYear() === targetYear)
        : data;

      if (q.includes("category")) return getTopCategory(analysisData);
      if (q.includes("day"))
        return getExtremeDay(
          analysisData,
          q.includes("expense") ? "expense_amount" : "revenue",
          type,
        );
      // Default to month if not specified or explicitly asked
      if (
        q.includes("month") ||
        (!q.includes("day") && !q.includes("category"))
      ) {
        return getExtremeMonth(
          analysisData,
          q.includes("expense") ? "expense_amount" : "revenue",
          type,
        );
      }
    }

    // C. Totals
    if (
      q.includes("total") ||
      q.includes("how much") ||
      q.includes("revenue") ||
      q.includes("profit") ||
      q.includes("expense")
    ) {
      const rev = sum(filteredData, "revenue");
      const exp = sum(filteredData, "expense_amount");
      const prof = rev - exp;
      const context =
        targetMonth !== null
          ? monthsFull[targetMonth]
          : targetYear || "all loaded data";

      if (q.includes("revenue"))
        return `Total Revenue for **${context}**: **${formatCurrency(rev)}**`;
      if (q.includes("expense"))
        return `Total Expenses for **${context}**: **${formatCurrency(exp)}**`;
      return `Net Profit for **${context}**: **${formatCurrency(prof)}**`;
    }
  }

  // 5. SERVICE QUESTIONS
  if (table.includes("service")) {
    if (q.includes("most") || q.includes("common"))
      return getMostCommonBike(filteredData);
    if (q.includes("total") || q.includes("count"))
      return `Total repairs in this period: **${filteredData.length}**`;
    if (q.includes("average")) {
      const totalCost = sum(filteredData, "total_cost");
      return `Average repair cost: **${formatCurrency(totalCost / (filteredData.length || 1))}**`;
    }
  }

  // 6. FALLBACK (Search Text)
  // If no math logic triggered, try to search for descriptions (e.g. "Mountain Bike")
  const searchResults = performTextSearch(data, q);
  if (searchResults) return searchResults;

  // 7. FINAL FALLBACK
  return "This is a limited edition AI. 🤖<br>I can answer: 'Total revenue', 'Best month in 2025', 'Profit on Jan 5'.<br>More features coming soon!";
}

// --- HELPERS ---

function performTextSearch(data, query) {
  const terms = query.split(" ").filter((w) => w.length > 3);
  if (terms.length === 0) return null;
  const matches = data.filter((r) => {
    const str = JSON.stringify(r).toLowerCase();
    return terms.some((t) => str.includes(t));
  });
  if (matches.length > 0) {
    return `Found **${matches.length} records** matching "${terms[0]}".<br>Example: ${matches[0].expense_desc || matches[0].cycle_name || "Item"}`;
  }
  return null;
}

function getExtremeMonth(data, field, type) {
  const monthly = {};
  data.forEach((r) => {
    if (!r._date) return;
    const k = r._date.toLocaleString("default", {
      month: "long",
      year: "numeric",
    });
    monthly[k] = (monthly[k] || 0) + (r[field] || 0);
  });
  let bestK = "",
    val = type === "max" ? -Infinity : Infinity;
  for (const [k, v] of Object.entries(monthly)) {
    if (type === "max" ? v > val : v < val) {
      val = v;
      bestK = k;
    }
  }
  const label = type === "max" ? "Highest" : "Lowest";
  const fieldName = field === "expense_amount" ? "Expense" : "Revenue";
  return `The **${label} ${fieldName} Month** was **${bestK}** (${formatCurrency(val)}).`;
}

function getExtremeDay(data, field, type) {
  if (data.length === 0) return "No data found for that period.";
  const sorted = [...data].sort((a, b) =>
    type === "max" ? b[field] - a[field] : a[field] - b[field],
  );
  const best = sorted[0];
  return `The **${type === "max" ? "Best" : "Lowest"} Day** was **${best._date.toLocaleDateString()}** (${formatCurrency(best[field])}).`;
}

function getTopCategory(data) {
  const cats = {};
  data.forEach((r) => {
    if (r.expense_amount > 0) {
      const k = r.expense_desc || "Uncategorized";
      cats[k] = (cats[k] || 0) + r.expense_amount;
    }
  });
  let bestK = "",
    max = -1;
  for (const [k, v] of Object.entries(cats)) {
    if (v > max) {
      max = v;
      bestK = k;
    }
  }
  return `Highest Expense Category: **${bestK}** (${formatCurrency(max)}).`;
}

function getMostCommonBike(data) {
  const counts = {};
  data.forEach((r) => {
    const k = r.cycle_name || "Unknown";
    counts[k] = (counts[k] || 0) + 1;
  });
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return "No data.";
  return `Most Common Bike: **${entries[0][0]}** (${entries[0][1]} repairs).`;
}

function sum(data, field) {
  return data.reduce((s, r) => s + (r[field] || 0), 0);
}
function formatCurrency(val) {
  return new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
  }).format(val);
}

// --- UI HELPERS ---
function addUserMessage(text) {
  const div = document.createElement("div");
  div.className = "flex justify-end mb-2 fade-in";
  div.innerHTML = `<div class="bg-purple-600 text-white px-4 py-2 rounded-2xl rounded-tr-none max-w-[85%] shadow-md text-sm">${text}</div>`;
  chatHistory.appendChild(div);
  chatHistory.scrollTop = chatHistory.scrollHeight;
}

function addBotMessage(text) {
  const div = document.createElement("div");
  div.className = "flex justify-start mb-2 fade-in";
  div.innerHTML = `
        <div class="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center mr-2 shadow-sm shrink-0"><i class="fas fa-robot text-purple-600 text-xs"></i></div>
        <div class="bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200 px-4 py-2 rounded-2xl rounded-tl-none max-w-[85%] shadow-md text-sm border dark:border-gray-600 leading-relaxed">${text}</div>`;
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
