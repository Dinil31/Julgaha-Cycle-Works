// js/pos_module.js
import { getSupabase } from './config.js';
import { showCustomConfirm } from './ui.js';

const formatCurrency = (val) => new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR' }).format(val || 0);

async function fetchAll(table) {
    const sb = getSupabase();
    const { data, error } = await sb.from(table).select('*').order('id', { ascending: false });
    if (error) { console.error(`Error fetching ${table}:`, error.message); return []; }
    return data;
}

// ==========================================
// 1. INVENTORY & RESTOCK 
// ==========================================
export async function loadInventory() {
    const products = await fetchAll('products');
    const tbody = document.getElementById('inventory-table-body');
    if(!tbody) return;
    tbody.innerHTML = '';
    products.forEach(p => {
        const isLow = p.stock <= p.reorder_level;
        tbody.innerHTML += `
            <tr class="bg-white border-b dark:bg-slate-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-slate-700 transition">
                <td class="px-6 py-4 font-mono text-sm text-gray-500">${p.code}</td>
                <td class="px-6 py-4 font-bold text-gray-800 dark:text-gray-200">${p.name}</td>
                <td class="px-6 py-4 ${isLow ? 'text-red-500 font-bold animate-pulse' : 'text-green-500'}">${p.stock}</td>
                <td class="px-6 py-4 text-gray-500">${p.reorder_level}</td>
                <td class="px-6 py-4">${formatCurrency(p.unit_price)}</td>
                <td class="px-6 py-4"><span class="${isLow ? 'bg-red-100 text-red-800 border border-red-200' : 'bg-green-100 text-green-800 border border-green-200'} text-xs font-bold px-2.5 py-0.5 rounded-full">${isLow ? 'Low Stock' : 'In Stock'}</span></td>
            </tr>`;
    });
}

export async function generateRestockPDF() {
    const sb = getSupabase();
    const { data } = await sb.from('products').select('*');
    const lowStockItems = data.filter(p => p.stock <= p.reorder_level);
    if(lowStockItems.length === 0) return showCustomConfirm("Inventory", "No items need restocking.", "confirm");

    const tbody = document.getElementById('restock-table-body');
    tbody.innerHTML = '';
    lowStockItems.forEach((p, index) => {
        const suggested = (p.reorder_level * 3) - p.stock; 
        tbody.innerHTML += `
            <tr id="restock-row-${index}" class="border-b dark:border-gray-700">
                <td class="p-3 font-mono text-xs">${p.code}</td>
                <td class="p-3 font-bold">${p.name}</td>
                <td class="p-3 text-center text-red-500 font-bold">${p.stock}</td>
                <td class="p-3 text-center">${p.reorder_level}</td>
                <td class="p-3 text-center"><input type="number" class="w-20 p-1 border rounded text-center dark:bg-slate-700 dark:text-white" value="${suggested > 0 ? suggested : 10}"></td>
                <td class="p-3 text-center"><button onclick="document.getElementById('restock-row-${index}').remove()" class="text-red-400 hover:text-red-600"><i class="fas fa-trash"></i></button></td>
            </tr>`;
    });
    document.getElementById('restock-modal').classList.remove('hidden');
}

export function printRestockFinal() {
    const rows = document.querySelectorAll('#restock-table-body tr');
    let printRows = '';
    rows.forEach(row => {
        const cols = row.querySelectorAll('td');
        const qty = row.querySelector('input').value;
        printRows += `<tr><td>${cols[0].innerText}</td><td>${cols[1].innerText}</td><td align="center">${cols[2].innerText}</td><td align="center"><b>${qty}</b></td><td style="border-bottom:1px solid #ccc;"></td></tr>`;
    });
    const w = window.open('', '', 'width=800,height=600');
    w.document.write(`<html><head><title>Restock Order</title><style>body{font-family:sans-serif;padding:20px;} table{width:100%;border-collapse:collapse;} th,td{border:1px solid #ddd;padding:10px;}</style></head><body><h2>📦 Restock Order</h2><p>${new Date().toLocaleDateString()}</p><table><tr><th>Code</th><th>Product</th><th>Current</th><th>Order Qty</th><th>Check</th></tr>${printRows}</table><script>window.print();</script></body></html>`);
    w.document.close();
};

export async function addProduct(e) {
    e.preventDefault();
    const form = new FormData(e.target);
    const sb = getSupabase();
    const { error } = await sb.from('products').insert({
        code: form.get('code').toUpperCase(), name: form.get('name'), stock: Number(form.get('stock')),
        reorder_level: Number(form.get('reorder_level')), unit_price: Number(form.get('unit_price'))
    });
    if(error) alert(error.message); else { await showCustomConfirm("Success", "Product Added", "success-green"); e.target.reset(); loadInventory(); }
}

// ==========================================
// 2. POS & SALES
// ==========================================
let cart = [];
let productsCache = [];

export async function initPOS() {
    productsCache = await fetchAll('products');
    const select = document.getElementById('pos-product-select');
    if(select) {
        select.innerHTML = '<option value="">Select Product...</option>';
        productsCache.forEach(p => { select.innerHTML += `<option value="${p.id}" data-price="${p.unit_price}" data-name="${p.name}">${p.name} (Stock: ${p.stock}) - ${formatCurrency(p.unit_price)}</option>`; });
    }
}

export function addToCart() {
    const select = document.getElementById('pos-product-select');
    const qtyInput = document.getElementById('pos-qty');
    const id = select.value;
    if(!id) return alert("Select Product");
    
    const option = select.options[select.selectedIndex];
    const name = option.getAttribute('data-name');
    const price = parseFloat(option.getAttribute('data-price'));
    const p = productsCache.find(x => String(x.id) === String(id));
    const qty = parseInt(qtyInput.value);
    
    if(p && qty > p.stock) return alert("Low Stock! Only " + p.stock + " available.");
    const exist = cart.find(i => i.id === id);
    if(exist) exist.qty += qty; else cart.push({ id, name, price, qty });
    renderCart(); qtyInput.value = 1;
}

function renderCart() {
    const tbody = document.getElementById('cart-table-body');
    const totalEl = document.getElementById('pos-total');
    if(!tbody) return;
    tbody.innerHTML = '';
    let total = 0;
    cart.forEach((i, idx) => {
        total += i.price * i.qty;
        tbody.innerHTML += `<tr><td class="p-2 text-gray-800 dark:text-gray-200">${i.name}</td><td class="text-center">${i.qty}</td><td class="text-right">${formatCurrency(i.price*i.qty)}</td><td class="text-center"><button onclick="window.posModule.removeCartItem(${idx})" class="text-red-500"><i class="fas fa-trash"></i></button></td></tr>`;
    });
    const svc = parseFloat(document.getElementById('pos-service-cost')?.value || 0);
    totalEl.innerText = formatCurrency(total + svc);
}
export function removeCartItem(idx) { cart.splice(idx, 1); renderCart(); };

export async function processSale(e) {
    e.preventDefault();
    const sb = getSupabase();
    const form = new FormData(e.target);
    const svc = parseFloat(form.get('service_cost') || 0);
    const total = cart.reduce((s, i) => s + (i.price*i.qty), 0) + svc;
    const receiptNo = Date.now().toString().slice(-10) + Math.floor(Math.random()*100);

    if(cart.length === 0 && svc <= 0) return showCustomConfirm("Error", "Cart is empty.", "danger");

    const { data: sale, error } = await sb.from('sales').insert({
        receipt_no: receiptNo, customer_name: form.get('customer_name') || 'Walk-in', phone: form.get('phone'),
        service_cost: svc, total_amount: total, date: new Date().toISOString()
    }).select().single();

    if(error) return alert("Sale Error: " + error.message);

    if(cart.length > 0) {
        const items = cart.map(i => ({ sale_id: sale.id, product_id: i.id, quantity: i.qty, price: i.price }));
        await sb.from('sale_items').insert(items);
        for(let item of cart) {
            const p = productsCache.find(x => String(x.id) === String(item.id));
            if(p) await sb.from('products').update({ stock: p.stock - item.qty }).eq('id', item.id);
        }
    }
    generateBill(sale, cart);
    await showCustomConfirm("Success", "Sale Completed!", "success-green");
    cart = []; e.target.reset(); renderCart(); initPOS();
}

function generateBill(sale, items) {
    const w = window.open('', '', 'width=400,height=600');
    let itemsHtml = items.map(i => `<tr><td>${i.name}</td><td align="center">${i.qty}</td><td align="right">${(i.price*i.qty).toFixed(2)}</td></tr>`).join('');
    w.document.write(`<html><head><style>body{font-family:'Courier New';padding:20px;}h2,p{margin:0;}</style></head><body><center><h2>CycleSense</h2><p>Receipt: ${sale.receipt_no}</p></center><hr><p>Date: ${new Date().toLocaleString()}</p><p>Cust: ${sale.customer_name}</p><hr><table width="100%"><tr><th align="left">Item</th><th>Qty</th><th align="right">Price</th></tr>${itemsHtml}</table><hr><p align="right">Svc: ${sale.service_cost}</p><h3 align="right">TOTAL: ${sale.total_amount}</h3><script>window.print();</script></body></html>`);
    w.document.close();
}

// ==========================================
// 3. REPAIRS SYSTEM
// ==========================================
let repairCart = [];
let repairsData = []; 

export async function loadRepairs() {
    const sb = getSupabase();
    const { data } = await sb.from('repairs').select('*').order('id', { ascending: false });
    repairsData = data || [];
    
    const today = new Date().toISOString().split('T')[0];
    const dateInput = document.querySelector('input[name="predicted_date"]');
    if(dateInput) dateInput.setAttribute('min', today);

    filterRepairs();
}

export function filterRepairs() {
    const filter = document.getElementById('repair-filter')?.value || 'all';
    const tbody = document.getElementById('repairs-table-body');
    if(!tbody) return;
    
    tbody.innerHTML = '';
    const filtered = repairsData.filter(r => {
        if(filter === 'pending') return r.status !== 'Completed';
        if(filter === 'completed') return r.status === 'Completed';
        return true;
    });

    if(filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-gray-500">No tickets found.</td></tr>`;
        return;
    }

    filtered.forEach(r => {
        const isPending = r.status !== 'Completed';
        const rowClass = isPending ? 'bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 animate-pulse' : 'bg-white dark:bg-darkcard border-l-4 border-green-500';
        const statusBadge = isPending
            ? `<button onclick="window.posModule.openCompleteRepairModal('${r.id}')" class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs shadow transition">Mark Complete</button>`
            : `<span class="bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-bold">Completed</span>`;

        const actions = `
            <div class="flex gap-2 justify-center">
                <button onclick='window.posModule.editRepair(${JSON.stringify(r).replace(/'/g, "&#39;")})' class="text-blue-500 hover:text-blue-700 p-1" title="Edit"><i class="fas fa-edit"></i></button>
                <button onclick='window.posModule.printRepairTicket(${JSON.stringify(r).replace(/'/g, "&#39;")})' class="text-gray-500 hover:text-gray-700 p-1" title="Print"><i class="fas fa-print"></i></button>
                <button onclick="window.posModule.deleteRepair('${r.id}')" class="text-red-500 hover:text-red-700 p-1" title="Delete"><i class="fas fa-trash"></i></button>
            </div>`;

        tbody.innerHTML += `
            <tr class="${rowClass} border-b dark:border-gray-700 transition">
                <td class="px-4 py-3 font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">${r.repair_id}</td>
                <td class="px-4 py-3 font-bold text-gray-800 dark:text-gray-200">${r.customer_name}</td>
                <td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">${r.phone}</td>
                <td class="px-4 py-3 font-bold text-gray-700 dark:text-gray-300">${formatCurrency(r.advance)}</td>
                <td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">${new Date(r.predicted_date).toLocaleDateString()}</td>
                <td class="px-4 py-3 text-center">${statusBadge}</td>
                <td class="px-4 py-3">${actions}</td>
            </tr>`;
    });
}

export function editRepair(r) {
    document.getElementById('edit-repair-id').value = r.id;
    document.getElementById('edit-repair-customer').value = r.customer_name;
    document.getElementById('edit-repair-phone').value = r.phone;
    document.getElementById('edit-repair-advance').value = r.advance;
    document.getElementById('edit-repair-date').value = r.predicted_date;
    document.getElementById('repair-edit-modal').classList.remove('hidden');
}

export async function saveEditRepair(e) {
    e.preventDefault();
    const id = document.getElementById('edit-repair-id').value;
    const updates = {
        customer_name: document.getElementById('edit-repair-customer').value,
        phone: document.getElementById('edit-repair-phone').value,
        advance: parseFloat(document.getElementById('edit-repair-advance').value),
        predicted_date: document.getElementById('edit-repair-date').value
    };
    const sb = getSupabase();
    const { error } = await sb.from('repairs').update(updates).eq('id', id);
    if(error) alert(error.message);
    else {
        await showCustomConfirm("Updated", "Repair details saved.", "success-green");
        document.getElementById('repair-edit-modal').classList.add('hidden');
        loadRepairs();
    }
}

export function printRepairTicket(repair) {
    const w = window.open('', '', 'width=400,height=600');
    const websiteUrl = window.location.origin + "/track.html";
    w.document.write(`<html><head><style>body{font-family:'Courier New';padding:20px;text-align:center;} .box{border:2px dashed black;padding:10px;margin:10px 0;} .id{font-size:18px;font-weight:bold;}</style></head><body><h2>CycleSense Repair</h2><p>${new Date().toLocaleDateString()}</p><div class="box"><p>TICKET ID:</p><div class="id">${repair.repair_id}</div></div><p style="text-align:left;"><b>Cust:</b> ${repair.customer_name}</p><p style="text-align:left;"><b>Phone:</b> ${repair.phone}</p><p style="text-align:left;"><b>Est Finish:</b> ${new Date(repair.predicted_date).toLocaleDateString()}</p><p style="text-align:left;"><b>Adv Paid:</b> ${formatCurrency(repair.advance)}</p><hr><h3>Track Status</h3><p>Visit: <b>${websiteUrl}</b></p><p>ID: <b>${repair.repair_id}</b></p><hr><script>window.print();</script></body></html>`);
    w.document.close();
}

export async function addRepair(e) {
    e.preventDefault();
    const sb = getSupabase();
    const form = new FormData(e.target);
    const repairId = 'REP-' + Math.floor(100000 + Math.random() * 900000);
    const { data, error } = await sb.from('repairs').insert({
        repair_id: repairId, customer_name: form.get('customer_name'), phone: form.get('phone'),
        advance: Number(form.get('advance')), predicted_date: form.get('predicted_date'), status: 'In Progress'
    }).select().single();

    if(error) alert(error.message);
    else { 
        printRepairTicket(data);
        await showCustomConfirm("Success", "Ticket Created & Printed!", "success-green"); 
        e.target.reset(); loadRepairs(); 
    }
}

export async function deleteRepair(id) {
    if(await showCustomConfirm("Delete Ticket?", "Are you sure?", "danger")) {
        const sb = getSupabase();
        await sb.from('repairs').delete().eq('id', id);
        loadRepairs();
    }
}

let currentRepairId = null;
export async function openCompleteRepairModal(id) {
    currentRepairId = id; repairCart = [];
    const sb = getSupabase();
    const { data: repair } = await sb.from('repairs').select('*').eq('id', id).single();
    document.getElementById('rep-modal-customer').innerText = repair.customer_name;
    document.getElementById('rep-modal-adv').innerText = formatCurrency(repair.advance);
    document.getElementById('repair-finalize-modal').classList.remove('hidden');
    
    const select = document.getElementById('rep-part-select');
    select.innerHTML = '<option value="">Select Used Part...</option>';
    const products = await fetchAll('products');
    products.forEach(p => { select.innerHTML += `<option value="${p.id}" data-price="${p.unit_price}" data-name="${p.name}">${p.name}</option>`; });
    renderRepairCart(repair.advance);
}

export function addRepairPart() {
    const select = document.getElementById('rep-part-select');
    const qty = document.getElementById('rep-part-qty').value;
    const id = select.value;
    if(!id) return;
    const option = select.options[select.selectedIndex];
    const name = option.getAttribute('data-name');
    const price = parseFloat(option.getAttribute('data-price'));
    repairCart.push({ id, name, price, qty: parseInt(qty) });
    
    const advText = document.getElementById('rep-modal-adv').innerText.replace(/[^\d.]/g, ''); 
    renderRepairCart(parseFloat(advText) || 0);
}

function renderRepairCart(advance) {
    const tbody = document.getElementById('rep-parts-body');
    tbody.innerHTML = '';
    let partsTotal = 0;
    repairCart.forEach(i => {
        partsTotal += i.price * i.qty;
        tbody.innerHTML += `<tr><td>${i.name}</td><td>${i.qty}</td><td align="right">${formatCurrency(i.price*i.qty)}</td></tr>`;
    });
    const labor = parseFloat(document.getElementById('rep-labor').value || 0);
    document.getElementById('rep-total-due').innerText = formatCurrency((partsTotal + labor) - advance);
}

export async function finalizeRepair() {
    const labor = parseFloat(document.getElementById('rep-labor').value || 0);
    const sb = getSupabase();
    const { data: repair } = await sb.from('repairs').select('*').eq('id', currentRepairId).single();
    const partsTotal = repairCart.reduce((s, i) => s + (i.price * i.qty), 0);
    const finalTotal = partsTotal + labor;
    const balance = finalTotal - repair.advance;
    const receiptNo = "REP-" + Date.now().toString().slice(-8);

    const { data: sale } = await sb.from('sales').insert({
        receipt_no: receiptNo, customer_name: repair.customer_name + " (Repair)", phone: repair.phone,
        service_cost: labor, total_amount: finalTotal, date: new Date().toISOString()
    }).select().single();

    if(repairCart.length > 0) {
        const items = repairCart.map(i => ({ sale_id: sale.id, product_id: i.id, quantity: i.qty, price: i.price }));
        await sb.from('sale_items').insert(items);
        for(let item of repairCart) {
            const { data: p } = await sb.from('products').select('stock').eq('id', item.id).single();
            if(p) await sb.from('products').update({ stock: p.stock - item.qty }).eq('id', item.id);
        }
    }
    await sb.from('repairs').update({ status: 'Completed', final_amount: finalTotal, balance_due: balance }).eq('id', currentRepairId);
    generateBill(sale, repairCart);
    document.getElementById('repair-finalize-modal').classList.add('hidden');
    await showCustomConfirm("Done", "Repair Completed & Billed", "success-green");
    loadRepairs();
}

let allSales = [];
export async function openReportModal() {
    document.getElementById('sales-report-modal').classList.remove('hidden');
    const sb = getSupabase();
    const { data } = await sb.from('sales').select('*').order('date', {ascending:false});
    if(!data) return;
    allSales = data;
    filterSales('today');
}
export function closeReportModal() { document.getElementById('sales-report-modal').classList.add('hidden'); }
export function filterSales(period) {
    const tbody = document.getElementById('report-table-body');
    const totalEl = document.getElementById('report-total-sales');
    if(!tbody) return;
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfDay); startOfWeek.setDate(startOfDay.getDate() - startOfDay.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const filtered = allSales.filter(s => {
        const d = new Date(s.date);
        if(period === 'today') return d >= startOfDay;
        if(period === 'week') return d >= startOfWeek;
        if(period === 'month') return d >= startOfMonth;
        if(period === 'year') return d >= startOfYear;
        return true;
    });
    tbody.innerHTML = '';
    let grandTotal = 0;
    filtered.forEach(s => {
        grandTotal += Number(s.total_amount);
        tbody.innerHTML += `
            <tr class="border-b dark:border-gray-700">
                <td class="p-3">${new Date(s.date).toLocaleDateString()}</td>
                <td class="p-3 font-mono text-blue-500">${s.receipt_no || s.id}</td>
                <td class="p-3">${s.customer_name}</td>
                <td class="p-3 text-right">${formatCurrency(s.total_amount)}</td>
                <td class="p-3 text-center"><button onclick="window.posModule.deleteSale('${s.id}')" class="text-red-500"><i class="fas fa-trash"></i></button></td>
            </tr>`;
    });
    totalEl.innerText = formatCurrency(grandTotal);
}
export async function deleteSale(id) {
    if(await showCustomConfirm("Delete?", "Confirm delete", "danger")) {
        const sb = getSupabase();
        await sb.from('sale_items').delete().eq('sale_id', id);
        await sb.from('sales').delete().eq('id', id);
        openReportModal();
    }
}


// ==========================================
// 4. NEW HR SYSTEM (ATTENDANCE & PAYROLL)
// ==========================================
let workersData = [];

export async function loadHR() {
    const sb = getSupabase();
    const { data } = await sb.from('workers').select('*').order('id', { ascending: false });
    workersData = data || [];
    
    // Render Workers List
    const list = document.getElementById('workers-list');
    list.innerHTML = '';
    
    // Populate Select Dropdowns
    const attSelect = document.getElementById('hr-att-worker');
    const advSelect = document.getElementById('hr-adv-worker');
    const paySelect = document.getElementById('hr-pay-worker');
    
    let options = '<option value="">Select Worker...</option>';

    workersData.forEach(w => {
        // Render Card
        list.innerHTML += `
            <div class="p-4 bg-white dark:bg-slate-700 rounded-xl shadow-sm border border-gray-100 dark:border-gray-600 transition hover:scale-[1.02]">
                <div class="flex justify-between items-start mb-2">
                    <div>
                        <h4 class="font-black text-gray-800 dark:text-white text-lg">${w.name}</h4>
                        <p class="text-xs text-gray-500"><i class="fas fa-phone mr-1"></i> ${w.phone || 'N/A'}</p>
                    </div>
                    <button onclick="window.posModule.deleteWorker('${w.id}')" class="text-red-400 hover:text-red-600 bg-red-50 dark:bg-red-900/30 p-2 rounded-lg"><i class="fas fa-trash"></i></button>
                </div>
                <div class="text-sm text-gray-600 dark:text-gray-300 mb-2"><i class="fas fa-map-marker-alt mr-1"></i> ${w.address || 'N/A'}</div>
                <div class="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 font-bold px-3 py-1 rounded inline-block">
                    ${formatCurrency(w.daily_salary)} / Day
                </div>
            </div>`;
            
        options += `<option value="${w.id}">${w.name} - ${formatCurrency(w.daily_salary)}/d</option>`;
    });

    if(attSelect) attSelect.innerHTML = options;
    if(advSelect) advSelect.innerHTML = options;
    if(paySelect) paySelect.innerHTML = options;
    
    // Set default dates
    const today = new Date().toISOString().split('T')[0];
    if(document.getElementById('hr-att-date')) document.getElementById('hr-att-date').value = today;
    if(document.getElementById('hr-adv-date')) document.getElementById('hr-adv-date').value = today;
}

export async function addWorker(e) {
    e.preventDefault();
    const sb = getSupabase();
    const form = new FormData(e.target);
    const { error } = await sb.from('workers').insert({ 
        name: form.get('name'), 
        phone: form.get('phone'),
        address: form.get('address'),
        daily_salary: Number(form.get('daily_salary')) 
    });
    if(error) alert(error.message);
    else { await showCustomConfirm("Success", "Worker Added.", "success-green"); e.target.reset(); loadHR(); }
}

export async function deleteWorker(id) {
    if(await showCustomConfirm("Delete Worker?", "This will remove the worker and their records.", "danger")) {
        const sb = getSupabase();
        await sb.from('workers').delete().eq('id', id);
        loadHR();
    }
}

export async function markAttendance(e) {
    e.preventDefault();
    const sb = getSupabase();
    const form = new FormData(e.target);
    const wId = form.get('worker_id');
    const dateVal = form.get('date');
    
    if(!wId) return alert("Select a worker.");

    // Delete existing record for this date to prevent duplicate errors (Upsert workaround)
    await sb.from('attendance').delete().match({ worker_id: wId, date: dateVal });

    const { error } = await sb.from('attendance').insert({
        worker_id: wId,
        date: dateVal,
        status: form.get('status'),
        in_time: form.get('in_time') || null,
        out_time: form.get('out_time') || null
    });

    if(error) alert("Error: " + error.message);
    else {
        await showCustomConfirm("Saved", `Attendance marked for ${dateVal}`, "success-green");
        e.target.reset();
        document.getElementById('hr-att-date').value = new Date().toISOString().split('T')[0]; // Reset to today
    }
}

export async function addAdvance(e) {
    e.preventDefault();
    const sb = getSupabase();
    const form = new FormData(e.target);
    const wId = form.get('worker_id');
    if(!wId) return alert("Select a worker.");

    const { error } = await sb.from('advances').insert({
        worker_id: wId,
        date: form.get('date'),
        amount: Number(form.get('amount'))
    });

    if(error) alert("Error: " + error.message);
    else {
        await showCustomConfirm("Advance Saved", "Money deducted from upcoming salary.", "success-green");
        e.target.reset();
        document.getElementById('hr-adv-date').value = new Date().toISOString().split('T')[0];
    }
}

export async function generatePayroll(e) {
    e.preventDefault();
    const sb = getSupabase();
    const form = new FormData(e.target);
    const wId = form.get('worker_id');
    const monthStr = form.get('month'); // Format: YYYY-MM
    
    if(!wId || !monthStr) return alert("Select worker and month.");

    const worker = workersData.find(w => String(w.id) === String(wId));
    if(!worker) return alert("Worker not found.");

    // 1. Fetch Attendance for the month
    const startDate = `${monthStr}-01`;
    // Hack to get last day of month
    const [year, month] = monthStr.split('-');
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];

    const { data: attData } = await sb.from('attendance')
        .select('*')
        .eq('worker_id', wId)
        .gte('date', startDate)
        .lte('date', endDate);

    // 2. Fetch Advances for the month
    const { data: advData } = await sb.from('advances')
        .select('*')
        .eq('worker_id', wId)
        .gte('date', startDate)
        .lte('date', endDate);

    // Calculate Earnings
    let fullDays = 0, halfDays = 0, shortLeaves = 0, absent = 0;
    
    (attData || []).forEach(a => {
        if(a.status === 'Full Day') fullDays++;
        else if(a.status === 'Half Day') halfDays++;
        else if(a.status === 'Short Leave') shortLeaves++;
        else absent++;
    });

    // Assume short leave pays full but is tracked.
    const grossEarnings = 
        (fullDays * worker.daily_salary) + 
        (shortLeaves * worker.daily_salary) + 
        (halfDays * (worker.daily_salary / 2));

    // Calculate Deductions
    const totalAdvances = (advData || []).reduce((sum, a) => sum + Number(a.amount), 0);
    
    // In Sri Lanka, employee EPF deduction is 8% of earnings.
    const epfDeduction = grossEarnings * 0.08;
    const netPay = grossEarnings - totalAdvances - epfDeduction;
    
    // Employer Contributions (Not deducted from pay, just for info)
    const epfEmployer = grossEarnings * 0.12;
    const etfEmployer = grossEarnings * 0.03;

    // Print Slip
    const w = window.open('', '', 'width=600,height=800');
    const html = `
        <html><head><style>
            body{font-family: Arial, sans-serif; padding: 40px; color: #333;}
            .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 20px;}
            h1 { margin: 0; color: #1e3a8a; }
            h3 { margin: 5px 0; color: #666; }
            .row { display: flex; justify-content: space-between; border-bottom: 1px solid #eee; padding: 10px 0; }
            .bold { font-weight: bold; }
            .total-row { display: flex; justify-content: space-between; border-top: 2px solid #333; border-bottom: 2px solid #333; padding: 15px 0; font-size: 18px; margin-top: 20px; background: #f8fafc;}
            .section-title { margin-top: 30px; font-size: 14px; text-transform: uppercase; color: #888; }
            .adv-list { font-size: 12px; color: #666; padding-left: 20px; margin: 5px 0;}
        </style></head><body>
            
            <div class="header">
                <h1>CycleSense</h1>
                <h3>Official Salary Slip</h3>
                <p>Month: <b>${monthStr}</b></p>
            </div>

            <div class="row"><span>Employee Name:</span> <span class="bold">${worker.name}</span></div>
            <div class="row"><span>Daily Rate:</span> <span>${formatCurrency(worker.daily_salary)}</span></div>

            <div class="section-title">Attendance & Earnings</div>
            <div class="row"><span>Full Days (${fullDays})</span> <span>${formatCurrency(fullDays * worker.daily_salary)}</span></div>
            <div class="row"><span>Half Days (${halfDays})</span> <span>${formatCurrency(halfDays * (worker.daily_salary / 2))}</span></div>
            <div class="row"><span>Short Leaves (${shortLeaves})</span> <span>${formatCurrency(shortLeaves * worker.daily_salary)}</span></div>
            <div class="row bg-gray"><span><b>Gross Earnings</b></span> <span class="bold">${formatCurrency(grossEarnings)}</span></div>

            <div class="section-title">Deductions</div>
            <div class="row text-red"><span>Advances Taken</span> <span>- ${formatCurrency(totalAdvances)}</span></div>
            ${(advData || []).map(a => `<div class="adv-list">Date: ${a.date} | Amount: ${formatCurrency(a.amount)}</div>`).join('')}
            
            <div class="row text-red"><span>EPF Deduction (8%)</span> <span>- ${formatCurrency(epfDeduction)}</span></div>

            <div class="total-row">
                <span class="bold" style="color: #16a34a;">NET SALARY PAYABLE</span> 
                <span class="bold" style="color: #16a34a;">${formatCurrency(netPay)}</span>
            </div>

            <div class="section-title">Employer Contributions (Not deducted)</div>
            <div class="row" style="font-size:12px;"><span>EPF (12%)</span> <span>${formatCurrency(epfEmployer)}</span></div>
            <div class="row" style="font-size:12px;"><span>ETF (3%)</span> <span>${formatCurrency(etfEmployer)}</span></div>

            <div style="margin-top: 50px; display: flex; justify-content: space-between;">
                <div style="border-top: 1px solid #333; width: 200px; text-align: center; padding-top: 5px;">Employer Signature</div>
                <div style="border-top: 1px solid #333; width: 200px; text-align: center; padding-top: 5px;">Employee Signature</div>
            </div>

            <script>window.print();</script>
        </body></html>
    `;
    w.document.write(html);
    w.document.close();
}
