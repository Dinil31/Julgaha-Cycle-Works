// js/data.js
import { getSupabase } from "./config.js";
import { updateDashboard, populateSlicers } from "./ui.js";

export let rawData = [];

// Tracks which database table we are using
let activeTable = "financials_past";

export function getActiveTable() {
  return activeTable;
}

export function setActiveContext(mode) {
  if (mode === "past") {
    activeTable = "financials_past";
  } else if (mode === "predicted") {
    activeTable = "financials_predicted";
  } else if (mode === "service") {
    activeTable = "service_logs";
  }
  console.log(`[Data] Context Switched. Active Table: ${activeTable}`);
  fetchData();
}

export async function fetchData() {
  const sb = getSupabase();
  if (!sb) return;

  document.getElementById("loader").classList.remove("hidden");

  const { data, error } = await sb.from(activeTable).select("*");

  if (error) {
    console.error("DB Error:", error);
  } else {
    // Parse dates safely
    rawData = data.map((r) => ({
      ...r,
      _date: r.date ? new Date(r.date) : null,
    }));
    populateSlicers();
    updateDashboard();
  }
  document.getElementById("loader").classList.add("hidden");
}

export async function clearDatabase() {
  const sb = getSupabase();
  let label = activeTable === "service_logs" ? "SERVICE LOGS" : "FINANCIALS";

  if (!confirm(`⚠️ WARNING: Clear all data from ${label}?`)) return;

  document.getElementById("loader").classList.remove("hidden");
  const { error } = await sb.from(activeTable).delete().gt("id", 0);

  if (error) {
    alert("Delete Error: " + error.message);
  } else {
    alert(`${label} Database Cleared!`);
    rawData = [];
    updateDashboard();
  }
  document.getElementById("loader").classList.add("hidden");
}

// --- SMART COLUMN FINDER (FIXED) ---
// Now accepts 'excludeTags' to prevent mixing up Description vs Amount
function findColumnIndex(headers, possibleNames, excludeTags = []) {
  for (let i = 0; i < headers.length; i++) {
    if (!headers[i]) continue;
    const h = String(headers[i]).trim().toLowerCase();

    // 1. Check Exclusions First
    let isExcluded = false;
    for (let exc of excludeTags) {
      if (h.includes(exc.toLowerCase())) {
        isExcluded = true;
        break;
      }
    }
    if (isExcluded) continue; // Skip this column if it has "Description" etc.

    // 2. Check Matches
    for (let name of possibleNames) {
      if (h.includes(name.toLowerCase())) return i;
    }
  }
  return -1;
}

export async function uploadToSupabase(input) {
  const sb = getSupabase();
  const file = input.files[0];

  let dbLabel = activeTable === "service_logs" ? "SERVICE LOGS" : "FINANCIALS";

  if (!file || !confirm(`Sync file to the >> ${dbLabel} << database?`)) {
    input.value = "";
    return;
  }

  document.getElementById("loader").classList.remove("hidden");
  const reader = new FileReader();

  reader.onload = async (e) => {
    try {
      const wb = XLSX.read(new Uint8Array(e.target.result), {
        type: "array",
        cellDates: true,
      });
      let targetSheetName = "";

      // Sheet Selection
      if (activeTable === "service_logs") {
        for (let name of wb.SheetNames) {
          if (name.toLowerCase().includes("service")) {
            targetSheetName = name;
            break;
          }
        }
      } else {
        for (let name of wb.SheetNames) {
          if (
            name.toLowerCase().includes("revenue") ||
            name.toLowerCase().includes("finance")
          ) {
            targetSheetName = name;
            break;
          }
        }
      }
      if (!targetSheetName) targetSheetName = wb.SheetNames[0];

      const ws = wb.Sheets[targetSheetName];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

      if (data.length < 2) throw new Error("Sheet appears empty!");

      const headers = data[0];
      const rows = [];

      // --- DATA MAPPING ---
      if (activeTable === "service_logs") {
        // SERVICE LOGIC
        const idxDate = findColumnIndex(headers, ["Date"]);
        const idxCust = findColumnIndex(headers, ["Customer", "Name"]);
        const idxCycle = findColumnIndex(headers, ["Cycle", "Model", "Item"]);
        // Strict: Look for cost, ignore 'Total' to avoid mixing fields
        const idxSvcCost = findColumnIndex(
          headers,
          ["Service Cost", "Labor"],
          ["Total"],
        );
        const idxTotCost = findColumnIndex(headers, ["Total Cost", "Amount"]);

        if (idxDate === -1) throw new Error("Missing 'Date' column.");

        for (let i = 1; i < data.length; i++) {
          const r = data[i];
          if (!r[idxDate]) continue;
          let d = new Date(r[idxDate]);
          if (isNaN(d)) continue;
          d.setHours(d.getHours() + 12);

          rows.push({
            date: d.toISOString(),
            customer_name: idxCust > -1 ? String(r[idxCust] || "") : "",
            cycle_name:
              idxCycle > -1 ? String(r[idxCycle] || "Unknown") : "Unknown",
            service_cost: idxSvcCost > -1 ? parseFloat(r[idxSvcCost]) || 0 : 0,
            total_cost: idxTotCost > -1 ? parseFloat(r[idxTotCost]) || 0 : 0,
          });
        }
      } else {
        // FINANCIAL LOGIC (FIXED HERE)
        const idxDate = findColumnIndex(headers, ["Date"]);
        const idxRev = findColumnIndex(headers, ["Revenue", "Rev", "yhat"]);

        // FIX: Look for 'Expense', but EXCLUDE columns with 'Description' or 'Desc'
        const idxExp = findColumnIndex(
          headers,
          ["Expense", "Exp", "Cost"],
          ["Description", "Desc"],
        );

        // Look for Description
        const idxDesc = findColumnIndex(headers, ["Description", "Desc"]);

        if (idxDate === -1) throw new Error("Missing 'Date' column.");

        for (let i = 1; i < data.length; i++) {
          const r = data[i];
          if (!r[idxDate]) continue;
          let d = new Date(r[idxDate]);
          if (isNaN(d)) continue;
          d.setHours(d.getHours() + 12);

          rows.push({
            date: d.toISOString(),
            revenue: idxRev > -1 ? parseFloat(r[idxRev]) || 0 : 0,
            expense_desc: idxDesc > -1 ? String(r[idxDesc] || "") : "",
            expense_amount: idxExp > -1 ? parseFloat(r[idxExp]) || 0 : 0,
          });
        }
      }

      const { error } = await sb.from(activeTable).insert(rows);
      if (error) throw error;

      alert(`Success! Synced ${rows.length} rows to ${dbLabel}.`);
      fetchData();
    } catch (err) {
      alert("Upload Error: " + err.message);
      console.error(err);
    }
    document.getElementById("loader").classList.add("hidden");
  };
  reader.readAsArrayBuffer(file);
}

export function getRawData() {
  return rawData;
}
