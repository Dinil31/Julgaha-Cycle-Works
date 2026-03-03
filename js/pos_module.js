// js/pos_module.js
import { getSupabase } from './config.js';
import { showCustomConfirm } from './ui.js';

// --- HELPERS ---
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
                <td class="px-6 py-4">
                    <span class="${isLow ? 'bg-red-100 text-red-800 border border-red-200' : 'bg-green-100 text-green-800 border border-green-200'} text-xs font-bold px-2.5 py-0.5 rounded-full">
                        ${isLow ? 'Low Stock' : 'In Stock'}
                    </span>
                </td>
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
                <td class="p-3 text-center">
                    <input type="number" class="w-20 p-1 border rounded text-center bg-gray-50 dark:bg-slate-700 dark:text-white font-bold" value="${suggested > 0 ? suggested : 10}">
                </td>
                <td class="p-3 text-center">
                    <button onclick="document.getElementById('restock-row-${index}').remove()" class="text-red-400 hover:text-red-600"><i class="fas fa-trash"></i></button>
                </td>
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
        printRows += `<tr><td style="padding:10px; border:1px solid #ddd;">${cols[0].innerText}</td><td style="padding:10px; border:1px solid #ddd;">${cols[1].innerText}</td><td style="text-align:center; padding:10px; border:1px solid #ddd;">${cols[2].innerText}</td><td style="text-align:center; font-weight:bold; padding:10px; border:1px solid #ddd;">${qty}</td><td style="border:1px solid #ddd; width:50px;"></td></tr>`;
    });

    const printWindow = window.open('', '', 'width=800,height=600');
    printWindow.document.write(`<html><head><title>Restock Order</title><style>body{font-family:sans-serif;padding:20px;} table{width:100%;border-collapse:collapse;margin-top:20px;} th{background:#f4f4f4; padding:10px; border:1px solid #ddd; text-align:left;}</style></head><body><h2>📦 Inventory Restock Order</h2><p>Generated on: ${new Date().toLocaleDateString()}</p><table><tr><th>Code</th><th>Product</th><th style="text-align:center;">Current Stock</th><th style="text-align:center;">Order Qty</th><th>Check</th></tr>${printRows}</table><script>window.print();</script></body></html>`);
    printWindow.document.close();
}

export async function addProduct(e) {
    e.preventDefault();
    const form = new FormData(e.target);
    const sb = getSupabase();
    const { error } = await sb.from('products').insert({
        code: form.get('code').toUpperCase(),
        name: form.get('name'),
        stock: Number(form.get('stock')),
        reorder_level: Number(form.get('reorder_level')),
        unit_price: Number(form.get('unit_price'))
    });
    if(error) alert(error.message);
    else { await showCustomConfirm("Success", "Product Added", "success-green"); e.target.reset(); loadInventory(); }
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
        productsCache.forEach(p => {
            select.innerHTML += `<option value="${p.id}" data-price="${p.unit_price}" data-name="${p.name}">${p.name} (Stock: ${p.stock}) - ${formatCurrency(p.unit_price)}</option>`;
        });
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
    
    if(p && qty > p.stock) return alert(`Low Stock! Only ${p.stock} available.`);
    
    const exist = cart.find(i => i.id === id);
    if(exist) exist.qty += qty;
    else cart.push({ id, name, price, qty });
    
    renderCart();
    qtyInput.value = 1;
}

export function renderCart() {
    const tbody = document.getElementById('cart-table-body');
    const totalEl = document.getElementById('pos-total');
    if(!tbody) return;
    tbody.innerHTML = '';
    let total = 0;
    cart.forEach((i, idx) => {
        total += i.price * i.qty;
        tbody.innerHTML += `<tr>
            <td class="p-2">${i.name}</td>
            <td class="text-center p-2">${i.qty}</td>
            <td class="text-right p-2">${formatCurrency(i.price * i.qty)}</td>
            <td class="p-2 text-center"><button onclick="window.posModule.removeCartItem(${idx})" class="text-red-500 hover:text-red-700"><i class="fas fa-trash"></i></button></td>
        </tr>`;
    });
    const svc = parseFloat(document.getElementById('pos-service-cost')?.value || 0);
    totalEl.innerText = formatCurrency(total + svc);
}

export function removeCartItem(idx) { 
    cart.splice(idx, 1); 
    renderCart(); 
}

export async function processSale(e) {
    e.preventDefault();
    const sb = getSupabase();
    const form = new FormData(e.target);
    const svc = parseFloat(form.get('service_cost') || 0);
    const total = cart.reduce((s, i) => s + (i.price*i.qty), 0) + svc;
    
    const receiptNo = Date.now().toString().slice(-10) + Math.floor(Math.random()*100);

    if(cart.length === 0 && svc <= 0) return showCustomConfirm("Error", "Cart is empty.", "danger");

    const { data: sale, error } = await sb.from('sales').insert({
        receipt_no: receiptNo,
        customer_name: form.get('customer_name') || 'Walk-in',
        phone: form.get('phone'),
        service_cost: svc,
        total_amount: total,
        date: new Date().toISOString()
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
    
    cart = [];
    e.target.reset();
    document.getElementById('pos-total').innerText = "LKR 0.00";
    renderCart();
    initPOS();
}

function generateBill(sale, items) {
    const printWindow = window.open('', '', 'width=400,height=600');
    let itemsHtml = '';
    
    if(items && items.length > 0) {
        itemsHtml = `<table style="width:100%; font-size:12px; border-collapse:collapse; margin:10px 0;">
            <tr style="border-bottom:1px dashed black"><th align="left">Item</th><th>Qty</th><th align="right">Total</th></tr>
            ${items.map(i => `<tr><td>${i.name}</td><td align="center">${i.qty}</td><td align="right">${(i.price*i.qty).toFixed(2)}</td></tr>`).join('')}
        </table>`;
    } else {
        itemsHtml = '<p style="text-align:center; font-style:italic; font-size:12px; margin: 15px 0;">(Service Bill)</p>';
    }
    
    const html = `<html><head><style>body{font-family:'Courier New'; padding:20px; color:#000;} h2,p{margin:0;}</style></head><body>
    <center><h2>CycleSense</h2><p>Tel: 075 633 9536</p></center><hr>
    <p>Receipt: ${sale.receipt_no || sale.id}</p>
    <p>Date: ${new Date(sale.date).toLocaleString()}</p>
    <p>Customer: ${sale.customer_name}</p>
    <hr>
    ${itemsHtml}
    <hr>
    <div style="text-align:right">
        ${sale.service_cost > 0 ? `<p>Labor/Service: ${sale.service_cost.toFixed(2)}</p>` : ''}
        <h3>TOTAL: ${sale.total_amount.toFixed(2)}</h3>
    </div>
    <hr><center><p style="font-size:10px">Thank you! Ride Safe.</p></center>
    <script>window.print();</script></body></html>`;
    
    printWindow.document.write(html);
    printWindow.document.close();
}

// Sales Report Modal
let allSales = [];

export async function openReportModal() {
    document.getElementById('sales-report-modal').classList.remove('hidden');
    const sb = getSupabase();
    const { data, error } = await sb.from('sales').select('*').order('date', { ascending: false });
    
    if(error) return alert("Error loading sales.");
    allSales = data;
    filterSales('today');
}

export function closeReportModal() {
    document.getElementById('sales-report-modal').classList.add('hidden');
}

export function filterSales(period) {
    const tbody = document.getElementById('report-table-body');
    const totalEl = document.getElementById('report-total-sales');
    if(!tbody) return;

    // Filter UI Active State
    document.querySelectorAll('.filter-btn').forEach(b => {
        if(b.dataset.period === period) b.classList.add('bg-blue-600', 'text-white');
        else b.classList.remove('bg-blue-600', 'text-white');
        if(b.dataset.period !== period) b.classList.add('bg-gray-200', 'text-gray-700');
        else b.classList.remove('bg-gray-200', 'text-gray-700');
    });

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
                <td class="p-3 text-sm">${new Date(s.date).toLocaleDateString()}</td>
                <td class="p-3 font-mono text-blue-500 text-xs">${s.receipt_no || s.id}</td>
                <td class="p-3 font-bold">${s.customer_name}</td>
                <td class="p-3 text-right font-bold text-green-600">${formatCurrency(s.total_amount)}</td>
                <td class="p-3 text-center">
                    <button onclick="window.posModule.deleteSale('${s.id}')" class="text-red-500 hover:text-red-700"><i class="fas fa-trash"></i></button>
                </td>
            </tr>`;
    });
    totalEl.innerText = formatCurrency(grandTotal);
}

export async function deleteSale(saleId) {
    if(!await showCustomConfirm("Delete Sale?", "This will restore stock if items were sold.", "danger")) return;
    
    const sb = getSupabase();
    // Restore Stock
    const { data: items } = await sb.from('sale_items').select('*').eq('sale_id', saleId);
    if(items) {
        for(let item of items) {
            const { data: p } = await sb.from('products').select('stock').eq('id', item.product_id).single();
            if(p) await sb.from('products').update({ stock: p.stock + item.quantity }).eq('id', item.product_id);
        }
    }
    // Delete Record
    await sb.from('sale_items').delete().eq('sale_id', saleId);
    await sb.from('sales').delete().eq('id', saleId);
    
    await showCustomConfirm("Deleted", "Sale removed.", "success-green");
    openReportModal(); // Refresh
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
    
    // Set Min Date to Today
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
        
        const rowClass = isPending 
            ? 'bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 animate-pulse' 
            : 'bg-white dark:bg-darkcard border-l-4 border-green-500';
        
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
    // Detect current website domain for the tracking link
    const websiteUrl = window.location.origin + "/track.html";
    
    w.document.write(`<html><head><style>body{font-family:'Courier New';padding:20px;text-align:center;} .box{border:2px dashed black;padding:10px;margin:10px 0;} .id{font-size:18px;font-weight:bold;}</style></head><body>
        <h2>CycleSense Repair</h2><p>${new Date().toLocaleDateString()}</p>
        <div class="box"><p>TICKET ID:</p><div class="id">${repair.repair_id}</div></div>
        <p style="text-align:left;"><b>Cust:</b> ${repair.customer_name}</p>
        <p style="text-align:left;"><b>Phone:</b> ${repair.phone}</p>
        <p style="text-align:left;"><b>Est Finish:</b> ${new Date(repair.predicted_date).toLocaleDateString()}</p>
        <p style="text-align:left;"><b>Adv Paid:</b> ${formatCurrency(repair.advance)}</p>
        <hr>
        <h3>Track Status</h3>
        <p>Visit: <b>${websiteUrl}</b></p>
        <p>ID: <b>${repair.repair_id}</b></p>
        <hr>
        <p style="font-size:10px;">Please bring this ticket to collect.</p>
        <script>window.print();</script>
    </body></html>`);
    w.document.close();
}

export async function addRepair(e) {
    e.preventDefault();
    const sb = getSupabase();
    const form = new FormData(e.target);
    const repairId = 'REP-' + Math.floor(100000 + Math.random() * 900000);
    
    const { data, error } = await sb.from('repairs').insert({
        repair_id: repairId, 
        customer_name: form.get('customer_name'), 
        phone: form.get('phone'),
        advance: Number(form.get('advance')), 
        predicted_date: form.get('predicted_date'), 
        status: 'In Progress'
    }).select().single();

    if(error) alert(error.message);
    else { 
        printRepairTicket(data);
        await showCustomConfirm("Success", "Ticket Created & Printed!", "success-green"); 
        e.target.reset(); 
        loadRepairs(); 
    }
}

export async function deleteRepair(id) {
    if(await showCustomConfirm("Delete Ticket?", "Are you sure?", "danger")) {
        const sb = getSupabase();
        await sb.from('repairs').delete().eq('id', id);
        loadRepairs();
    }
}

// --- REPAIR COMPLETION MODAL ---
let currentRepairId = null;

export async function openCompleteRepairModal(id) {
    currentRepairId = id; 
    repairCart = [];
    const sb = getSupabase();
    const { data: repair } = await sb.from('repairs').select('*').eq('id', id).single();
    
    document.getElementById('rep-modal-customer').innerText = repair.customer_name;
    document.getElementById('rep-modal-adv').innerText = formatCurrency(repair.advance);
    document.getElementById('repair-finalize-modal').classList.remove('hidden');
    
    const select = document.getElementById('rep-part-select');
    select.innerHTML = '<option value="">Select Used Part...</option>';
    const products = await fetchAll('products');
    products.forEach(p => {
        select.innerHTML += `<option value="${p.id}" data-price="${p.unit_price}" data-name="${p.name}">${p.name}</option>`;
    });
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
        tbody.innerHTML += `<tr><td>${i.name}</td><td align="center">${i.qty}</td><td align="right">${formatCurrency(i.price*i.qty)}</td></tr>`;
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
        receipt_no: receiptNo, 
        customer_name: repair.customer_name + " (Repair)", 
        phone: repair.phone,
        service_cost: labor, 
        total_amount: finalTotal, 
        date: new Date().toISOString()
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


// ==========================================
// 4. NEW HR SYSTEM (ATTENDANCE, PENALTIES & PAYROLL)
// ==========================================
let workersData = [];

export async function loadHR() {
    const sb = getSupabase();
    const { data } = await sb.from('workers').select('*').order('id', { ascending: false });
    workersData = data || [];
    
    const list = document.getElementById('workers-list');
    if(!list) return;
    list.innerHTML = '';
    
    const attSelect = document.getElementById('hr-att-worker');
    const advSelect = document.getElementById('hr-adv-worker');
    const paySelect = document.getElementById('hr-pay-worker');
    let options = '<option value="">Select Worker...</option>';

    workersData.forEach(w => {
        list.innerHTML += `
            <div class="p-4 bg-white dark:bg-slate-700 rounded-xl shadow-sm border border-gray-100 dark:border-gray-600 transition hover:scale-[1.02]">
                <div class="flex justify-between items-start mb-2">
                    <div>
                        <h4 class="font-black text-gray-800 dark:text-white text-lg">
                            ${w.name} 
                        </h4>
                        <div class="flex gap-2 mt-1 mb-1">
                            <span class="text-[10px] bg-indigo-100 text-indigo-800 px-2 py-1 rounded font-mono font-bold border border-indigo-200">ID: ${w.worker_uid || w.id}</span>
                            <span class="text-[10px] bg-yellow-100 text-yellow-800 px-2 py-1 rounded font-mono font-bold border border-yellow-200">PIN: ${w.pin || '1234'}</span>
                        </div>
                        <p class="text-xs text-gray-500"><i class="fas fa-phone mr-1"></i> ${w.phone || 'N/A'}</p>
                    </div>
                    <div class="flex gap-2">
                        <button onclick="window.posModule.viewWorkerAttendance('${w.id}')" class="text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 p-2 rounded-lg" title="Live Salary Tracker"><i class="fas fa-chart-bar"></i></button>
                        <button onclick="window.posModule.openEditWorker('${w.id}')" class="text-green-500 hover:bg-green-50 dark:hover:bg-green-900/30 p-2 rounded-lg" title="Edit PIN & Details"><i class="fas fa-edit"></i></button>
                        <button onclick="window.posModule.deleteWorker('${w.id}')" class="text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 p-2 rounded-lg" title="Delete"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
                <div class="text-sm text-gray-600 dark:text-gray-300 mb-2"><i class="fas fa-map-marker-alt mr-1"></i> ${w.address || 'N/A'}</div>
                <div class="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 font-bold px-3 py-1 rounded inline-block text-xs uppercase tracking-wider">
                    ${formatCurrency(w.daily_salary)} / Day
                </div>
            </div>`;
            
        options += `<option value="${w.id}">${w.name} (${w.worker_uid || w.id})</option>`;
    });

    if(attSelect) attSelect.innerHTML = options;
    if(advSelect) advSelect.innerHTML = options;
    if(paySelect) paySelect.innerHTML = options;
    
    const today = new Date().toISOString().split('T')[0];
    if(document.getElementById('hr-att-date')) document.getElementById('hr-att-date').value = today;
    if(document.getElementById('hr-adv-date')) document.getElementById('hr-adv-date').value = today;
}

export async function addWorker(e) {
    e.preventDefault();
    const sb = getSupabase();
    const form = new FormData(e.target);
    
    // Auto Generate Custom ID (e.g. W2026001)
    const year = new Date().getFullYear();
    const { data: lastWorker } = await sb.from('workers')
        .select('worker_uid')
        .ilike('worker_uid', `W${year}%`)
        .order('worker_uid', { ascending: false })
        .limit(1);

    let nextNum = 1;
    if (lastWorker && lastWorker.length > 0 && lastWorker[0].worker_uid) {
        const lastNumStr = lastWorker[0].worker_uid.slice(-3);
        nextNum = parseInt(lastNumStr) + 1;
    }
    const generatedUid = `W${year}${String(nextNum).padStart(3, '0')}`;

    const { error } = await sb.from('workers').insert({ 
        worker_uid: generatedUid,
        name: form.get('name'), 
        phone: form.get('phone'), 
        address: form.get('address'),
        daily_salary: Number(form.get('daily_salary')), 
        pin: '1234' // Default PIN
    });

    if(error) alert(error.message); 
    else { 
        await showCustomConfirm("Success", `Worker Created! \nLogin ID: ${generatedUid}\nDefault PIN: 1234`, "success-green"); 
        e.target.reset(); 
        loadHR(); 
    }
}

export function openEditWorker(id) {
    const w = workersData.find(x => String(x.id) === String(id));
    if(!w) return;
    
    document.getElementById('ew-id').value = w.id;
    document.getElementById('ew-name').value = w.name;
    document.getElementById('ew-phone').value = w.phone || '';
    document.getElementById('ew-address').value = w.address || '';
    document.getElementById('ew-salary').value = w.daily_salary;
    document.getElementById('ew-pin').value = w.pin || '1234';
    
    document.getElementById('edit-worker-modal').classList.remove('hidden');
}

export async function saveEditWorker(e) {
    e.preventDefault();
    const sb = getSupabase();
    const id = document.getElementById('ew-id').value;
    
    const updates = {
        name: document.getElementById('ew-name').value, 
        phone: document.getElementById('ew-phone').value, 
        address: document.getElementById('ew-address').value,
        daily_salary: Number(document.getElementById('ew-salary').value), 
        pin: document.getElementById('ew-pin').value
    };

    const { error } = await sb.from('workers').update(updates).eq('id', id);
    if(error) alert("Error saving worker: " + error.message);
    else { 
        document.getElementById('edit-worker-modal').classList.add('hidden'); 
        await showCustomConfirm("Updated", "Worker details successfully saved.", "success-green");
        loadHR(); 
    }
}

export async function deleteWorker(id) {
    if(await showCustomConfirm("Delete Worker?", "This deletes the worker, attendance, and advances.", "danger")) {
        await getSupabase().from('workers').delete().eq('id', id); 
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

    await sb.from('attendance').delete().match({ worker_id: wId, date: dateVal });

    const { error } = await sb.from('attendance').insert({
        worker_id: wId, date: dateVal, status: form.get('status'),
        in_time: form.get('in_time') || null, out_time: form.get('out_time') || null
    });

    if(error) alert("Error: " + error.message);
    else { 
        await showCustomConfirm("Saved", `Attendance marked for ${dateVal}`, "success-green"); 
        e.target.reset(); 
        document.getElementById('hr-att-date').value = new Date().toISOString().split('T')[0]; 
    }
}

export async function addAdvance(e) {
    e.preventDefault();
    const sb = getSupabase();
    const form = new FormData(e.target);
    const wId = form.get('worker_id');
    if(!wId) return alert("Select a worker.");
    
    const { error } = await sb.from('advances').insert({ 
        worker_id: wId, date: form.get('date'), amount: Number(form.get('amount')) 
    });
    
    if(error) alert("Error: " + error.message); 
    else { 
        await showCustomConfirm("Advance Saved", "Money deducted from salary.", "success-green"); 
        e.target.reset(); 
        document.getElementById('hr-adv-date').value = new Date().toISOString().split('T')[0]; 
    }
}

// --- SALARY CALCULATION ENGINE ---
export async function calculateWorkerSalary(wId, monthStr) {
    const sb = getSupabase();
    const worker = workersData.find(w => String(w.id) === String(wId));
    if(!worker) return null;

    const [year, month] = monthStr.split('-');
    const startDate = `${monthStr}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];

    const { data: attData } = await sb.from('attendance').select('*').eq('worker_id', wId).gte('date', startDate).lte('date', endDate).order('date', {ascending:true});
    const { data: advData } = await sb.from('advances').select('*').eq('worker_id', wId).gte('date', startDate).lte('date', endDate);

    let full = 0, half = 0, short = 0, timePenalty = 0;

    (attData || []).forEach(a => {
        if(a.status === 'Half Day') half++;
        else if(a.status === 'Short Leave') short++;
        else if(a.status === 'Full Day') {
            full++;
            if(a.in_time && a.out_time) {
                const parse = t => { const [h,m] = t.split(':').map(Number); return h*60+m; };
                const inMins = parse(a.in_time);
                const outMins = parse(a.out_time);
                let missed = 0;
                
                if(inMins > 600) missed += (inMins - 600); // Late after 10:00 (600 mins)
                if(outMins < 1020) missed += (1020 - outMins); // Early before 17:00 (1020 mins)
                
                if(missed > 0) {
                    const ratePerMin = worker.daily_salary / 420; // Assume 7 hour workday standard
                    timePenalty += (missed * ratePerMin);
                }
            }
        }
    });

    const baseGross = (full * worker.daily_salary) + (short * worker.daily_salary) + (half * (worker.daily_salary / 2));
    const grossEarnings = baseGross - timePenalty;
    const totalAdvances = (advData || []).reduce((sum, a) => sum + Number(a.amount), 0);
    const epfDeduction = grossEarnings > 0 ? grossEarnings * 0.08 : 0;
    const netPay = grossEarnings - totalAdvances - epfDeduction;

    return { worker, attData, advData, full, half, short, timePenalty, grossEarnings, totalAdvances, epfDeduction, netPay, monthStr };
}

// --- ADMIN VIEW ATTENDANCE MODAL ---
export async function viewWorkerAttendance(id) {
    const now = new Date();
    const monthStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2, '0')}`;
    document.getElementById('view-att-month').value = monthStr;
    document.getElementById('view-att-wid').value = id;
    await renderWorkerAttendanceUI(id, monthStr);
    document.getElementById('view-attendance-modal').classList.remove('hidden');
}

export async function updateAdminAttendanceView() {
    const id = document.getElementById('view-att-wid').value;
    const monthStr = document.getElementById('view-att-month').value;
    await renderWorkerAttendanceUI(id, monthStr);
}

export async function renderWorkerAttendanceUI(id, monthStr) {
    const data = await calculateWorkerSalary(id, monthStr);
    if(!data) return;

    document.getElementById('view-att-name').innerText = data.worker.name + ` (${data.worker.worker_uid})`;
    document.getElementById('view-att-gross').innerText = formatCurrency(data.grossEarnings);
    document.getElementById('view-att-net').innerText = formatCurrency(data.netPay);
    
    const tbody = document.getElementById('view-att-table');
    tbody.innerHTML = '';
    
    data.attData.forEach(a => {
        let penText = '-';
        if(a.status === 'Full Day' && a.in_time && a.out_time) {
            const inMins = parseInt(a.in_time.split(':')[0])*60 + parseInt(a.in_time.split(':')[1]);
            const outMins = parseInt(a.out_time.split(':')[0])*60 + parseInt(a.out_time.split(':')[1]);
            let missed = 0;
            if(inMins > 600) missed += (inMins - 600);
            if(outMins < 1020) missed += (1020 - outMins);
            if(missed > 0) penText = formatCurrency(missed * (data.worker.daily_salary / 420));
        }
        tbody.innerHTML += `<tr class="border-b dark:border-gray-700 text-sm"><td class="p-2">${a.date}</td><td class="p-2 font-bold">${a.status}</td><td class="p-2">${a.in_time || '-'} to ${a.out_time || '-'}</td><td class="p-2 text-red-500">${penText}</td></tr>`;
    });
    if(data.attData.length === 0) tbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center">No records found for this month.</td></tr>`;
}

export async function generatePayroll(e) {
    e.preventDefault();
    const form = new FormData(e.target);
    const data = await calculateWorkerSalary(form.get('worker_id'), form.get('month'));
    if(!data) return alert("Worker not found.");

    const epfEmployer = data.grossEarnings > 0 ? data.grossEarnings * 0.12 : 0;
    const etfEmployer = data.grossEarnings > 0 ? data.grossEarnings * 0.03 : 0;

    const w = window.open('', '', 'width=600,height=800');
    const html = `<html><head><style>
        body{font-family: Arial, sans-serif; padding: 40px; color: #333;}
        .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 20px;}
        h1 { margin: 0; color: #1e3a8a; } h3 { margin: 5px 0; color: #666; }
        .row { display: flex; justify-content: space-between; border-bottom: 1px dashed #eee; padding: 10px 0; font-size:14px;}
        .bold { font-weight: bold; }
        .total-row { display: flex; justify-content: space-between; border-top: 2px solid #333; border-bottom: 2px solid #333; padding: 15px 0; font-size: 18px; margin-top: 20px; background: #f8fafc;}
        .section-title { margin-top: 30px; font-size: 14px; text-transform: uppercase; color: #888; border-bottom: 1px solid #ccc; padding-bottom: 5px;}
        .adv-list { font-size: 12px; color: #888; padding-left: 20px; margin: 2px 0;}
    </style></head><body>
        <div class="header"><h1>CycleSense</h1><h3>Salary Slip</h3><p>Month: <b>${data.monthStr}</b></p></div>
        <div class="row"><span>Employee:</span> <span class="bold">${data.worker.name} (ID: ${data.worker.worker_uid})</span></div>
        <div class="row"><span>Daily Rate:</span> <span>${formatCurrency(data.worker.daily_salary)}</span></div>

        <div class="section-title">Earnings & Deductions</div>
        <div class="row"><span>Full Days (${data.full})</span> <span>${formatCurrency(data.full * data.worker.daily_salary)}</span></div>
        <div class="row"><span>Half Days (${data.half})</span> <span>${formatCurrency(data.half * (data.worker.daily_salary / 2))}</span></div>
        <div class="row"><span>Short Leaves (${data.short})</span> <span>${formatCurrency(data.short * data.worker.daily_salary)}</span></div>
        <div class="row text-red"><span>Time Penalties (Late/Early)</span> <span style="color:red">- ${formatCurrency(data.timePenalty)}</span></div>
        <div class="row" style="background:#f4f4f4;"><span><b>Gross Earnings</b></span> <span class="bold">${formatCurrency(data.grossEarnings)}</span></div>

        <div class="section-title">Subtractions</div>
        <div class="row"><span>Advances Taken</span> <span style="color:red">- ${formatCurrency(data.totalAdvances)}</span></div>
        ${data.advData.map(a => `<div class="adv-list">${a.date} : ${formatCurrency(a.amount)}</div>`).join('')}
        <div class="row"><span>EPF Deduction (8%)</span> <span style="color:red">- ${formatCurrency(data.epfDeduction)}</span></div>

        <div class="total-row"><span class="bold" style="color: #16a34a;">NET PAYABLE</span> <span class="bold" style="color: #16a34a;">${formatCurrency(data.netPay)}</span></div>

        <div class="section-title">Employer Contributions (Info Only)</div>
        <div class="row"><span>EPF (12%)</span> <span>${formatCurrency(epfEmployer)}</span></div>
        <div class="row"><span>ETF (3%)</span> <span>${formatCurrency(etfEmployer)}</span></div>

        <div style="margin-top: 50px; display: flex; justify-content: space-between;">
            <div style="border-top: 1px solid #333; width: 200px; text-align: center; padding-top: 5px;">Manager</div>
            <div style="border-top: 1px solid #333; width: 200px; text-align: center; padding-top: 5px;">Employee</div>
        </div>
        <script>window.print();</script>
    </body></html>`;
    w.document.write(html);
    w.document.close();
}
