// js/pos_module.js
import { getSupabase } from './config.js';
import { showCustomConfirm } from './ui.js';

// --- Global Formatters & Helpers ---
const formatCurrency = (val) => new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR' }).format(val || 0);

async function fetchAll(table) {
    const sb = getSupabase();
    const { data, error } = await sb.from(table).select('*').order('id', { ascending: false });
    if (error) { 
        console.error(`Error fetching from ${table}:`, error.message); 
        return []; 
    }
    return data;
}


// ==========================================
// 1. INVENTORY & RESTOCK
// ==========================================
export async function loadInventory() {
    const products = await fetchAll('products');
    const tbody = document.getElementById('inventory-table-body');
    if (!tbody) return; 
    
    tbody.innerHTML = '';
    
    products.forEach(p => {
        const isLow = p.stock <= p.reorder_level;
        
        tbody.innerHTML += `
            <tr class="border-b dark:border-gray-700">
                <td class="p-4 font-mono text-sm text-gray-500">${p.code}</td>
                <td class="p-4 font-bold dark:text-white">${p.name}</td>
                <td class="p-4 ${isLow ? 'text-red-500 animate-pulse' : 'text-green-500'} font-bold">${p.stock}</td>
                <td class="p-4 text-gray-500">${p.reorder_level}</td>
                <td class="p-4 dark:text-gray-300">${formatCurrency(p.unit_price)}</td>
                <td class="p-4">
                    <span class="px-2 py-1 text-xs font-bold rounded-full ${isLow ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}">
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
    
    if (lowStockItems.length === 0) {
        return showCustomConfirm("Inventory Check", "All items have sufficient stock. No restocking needed.", "confirm");
    }
    
    const tbody = document.getElementById('restock-table-body'); 
    tbody.innerHTML = '';
    
    lowStockItems.forEach((p, index) => {
        // Calculate a suggested order quantity (e.g. 3x the reorder level to build safe stock)
        const suggestedOrder = (p.reorder_level * 3) - p.stock;
        const defaultQty = suggestedOrder > 0 ? suggestedOrder : 10;
        
        tbody.innerHTML += `
            <tr id="restock-row-${index}" class="border-b dark:border-gray-700">
                <td class="p-3 font-mono text-xs text-gray-500">${p.code}</td>
                <td class="p-3 font-bold dark:text-white">${p.name}</td>
                <td class="p-3 text-center text-red-500 font-bold">${p.stock}</td>
                <td class="p-3 text-center text-gray-500">${p.reorder_level}</td>
                <td class="p-3 text-center">
                    <input type="number" class="w-16 border rounded text-center dark:bg-slate-700 dark:text-white font-bold" value="${defaultQty}">
                </td>
                <td class="p-3 text-center">
                    <button onclick="document.getElementById('restock-row-${index}').remove()" class="text-red-400 hover:text-red-600 transition">
                        <i class="fas fa-trash"></i>
                    </button>
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
        const orderQty = row.querySelector('input').value;
        printRows += `
            <tr>
                <td style="padding:10px; border:1px solid #ddd;">${cols[0].innerText}</td>
                <td style="padding:10px; border:1px solid #ddd;">${cols[1].innerText}</td>
                <td style="text-align:center; padding:10px; border:1px solid #ddd;">${cols[2].innerText}</td>
                <td style="text-align:center; font-weight:bold; padding:10px; border:1px solid #ddd;">${orderQty}</td>
                <td style="border:1px solid #ddd; width:50px;"></td>
            </tr>`;
    });

    const printWindow = window.open('', '', 'width=800,height=600');
    printWindow.document.write(`
        <html>
        <head>
            <title>Restock Order List</title>
            <style>
                body { font-family: sans-serif; padding: 20px; } 
                table { width: 100%; border-collapse: collapse; margin-top: 20px; } 
                th { background: #f4f4f4; padding: 10px; border: 1px solid #ddd; text-align: left; }
            </style>
        </head>
        <body>
            <h2>📦 Inventory Restock Order</h2>
            <p>Generated on: ${new Date().toLocaleDateString()}</p>
            <table>
                <tr>
                    <th>Code</th>
                    <th>Product</th>
                    <th style="text-align:center;">Current Stock</th>
                    <th style="text-align:center;">Order Qty</th>
                    <th>Check</th>
                </tr>
                ${printRows}
            </table>
            <script>window.print();</script>
        </body>
        </html>
    `);
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
    
    if (error) {
        alert(error.message); 
    } else {
        await showCustomConfirm("Success", "Product Added to Inventory", "success-green"); 
        e.target.reset(); 
        loadInventory(); 
    }
}


// ==========================================
// 2. POS & SALES
// ==========================================
let cart = []; 
let productsCache = [];

export async function initPOS() {
    productsCache = await fetchAll('products'); 
    const select = document.getElementById('pos-product-select');
    
    if (select) { 
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
    if (!id) return alert("Please select a product first.");
    
    const option = select.options[select.selectedIndex];
    const name = option.getAttribute('data-name');
    const price = parseFloat(option.getAttribute('data-price'));
    const p = productsCache.find(x => String(x.id) === String(id)); 
    const qty = parseInt(qtyInput.value);
    
    if (qty > p.stock) {
        return alert(`Low Stock! Only ${p.stock} units available.`);
    }
    
    const existingItem = cart.find(i => i.id === id); 
    if (existingItem) {
        existingItem.qty += qty; 
    } else {
        cart.push({ id, name, price, qty });
    }
    
    renderCart(); 
    qtyInput.value = 1;
}

export function renderCart() {
    const tbody = document.getElementById('cart-table-body'); 
    const totalEl = document.getElementById('pos-total');
    
    if (!tbody) return; 
    tbody.innerHTML = ''; 
    let total = 0;
    
    cart.forEach((item, idx) => { 
        total += item.price * item.qty; 
        tbody.innerHTML += `
            <tr class="border-b dark:border-gray-700">
                <td class="p-2">${item.name}</td>
                <td align="center" class="p-2">${item.qty}</td>
                <td align="right" class="p-2">${formatCurrency(item.price * item.qty)}</td>
                <td align="center" class="p-2">
                    <button onclick="window.posModule.removeCartItem(${idx})" class="text-red-500 hover:text-red-700 transition"><i class="fas fa-trash"></i></button>
                </td>
            </tr>`; 
    });
    
    const serviceCost = parseFloat(document.getElementById('pos-service-cost')?.value || 0);
    totalEl.innerText = formatCurrency(total + serviceCost);
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
    const total = cart.reduce((sum, item) => sum + (item.price * item.qty), 0) + svc;
    
    if (cart.length === 0 && svc <= 0) {
        return showCustomConfirm("Error", "Cannot process an empty cart.", "danger");
    }

    const receiptNo = Date.now().toString().slice(-8) + Math.floor(Math.random() * 100);

    const { data: sale, error } = await sb.from('sales').insert({ 
        receipt_no: receiptNo, 
        customer_name: form.get('customer_name') || 'Walk-in Customer', 
        phone: form.get('phone'), 
        service_cost: svc, 
        total_amount: total, 
        date: new Date().toISOString()
    }).select().single();

    if (error) return alert("Error saving sale: " + error.message);

    if (cart.length > 0) {
        const itemsToInsert = cart.map(i => ({ sale_id: sale.id, product_id: i.id, quantity: i.qty, price: i.price }));
        await sb.from('sale_items').insert(itemsToInsert);
        
        for (let item of cart) { 
            const p = productsCache.find(x => String(x.id) === String(item.id)); 
            await sb.from('products').update({ stock: p.stock - item.qty }).eq('id', item.id); 
        }
    }
    
    cart = []; 
    e.target.reset(); 
    renderCart(); 
    initPOS(); 
    generateBill(sale, cart);
    await showCustomConfirm("Success", "Sale Processed & Bill Generated!", "success-green");
}

function generateBill(sale, items) {
    const w = window.open('', '', 'width=400,height=600');
    
    let itemsHtml = '';
    if (items && items.length > 0) {
        itemsHtml = items.map(i => `
            <tr>
                <td>${i.name}</td>
                <td align="center">${i.qty}</td>
                <td align="right">${(i.price * i.qty).toFixed(2)}</td>
            </tr>
        `).join('');
    } else {
        itemsHtml = '<tr><td colspan="3" align="center" style="font-style:italic;">Service Only</td></tr>';
    }

    w.document.write(`
        <html>
        <head>
            <style>
                body { font-family: 'Courier New', Courier, monospace; padding: 20px; font-size: 14px; }
                h2, p { margin: 0; padding: 2px 0; }
                hr { border-top: 1px dashed #000; border-bottom: none; }
                table { width: 100%; border-collapse: collapse; margin: 10px 0; }
                th { text-align: left; border-bottom: 1px solid #000; padding-bottom: 5px; }
                td { padding: 5px 0; }
            </style>
        </head>
        <body>
            <center>
                <h2>CycleSense</h2>
                <p>Tel: 075 633 9536</p>
                <p>Receipt: ${sale.receipt_no}</p>
            </center>
            <hr>
            <p>Date: ${new Date(sale.date).toLocaleString()}</p>
            <p>Cust: ${sale.customer_name}</p>
            <hr>
            <table>
                <tr>
                    <th>Item</th>
                    <th style="text-align:center;">Qty</th>
                    <th style="text-align:right;">Price</th>
                </tr>
                ${itemsHtml}
            </table>
            <hr>
            <p align="right">Labor / Service: ${sale.service_cost.toFixed(2)}</p>
            <h3 align="right">TOTAL: ${sale.total_amount.toFixed(2)} LKR</h3>
            <hr>
            <center><p style="font-size:10px;">Thank you for riding with us!</p></center>
            <script>window.print();</script>
        </body>
        </html>
    `);
    w.document.close();
}

let allSales = [];

export async function openReportModal() { 
    document.getElementById('sales-report-modal').classList.remove('hidden'); 
    const sb = getSupabase();
    const { data } = await sb.from('sales').select('*').order('date', { ascending: false }); 
    allSales = data || []; 
    filterSales('today'); 
}

export function closeReportModal() { 
    document.getElementById('sales-report-modal').classList.add('hidden'); 
}

export function filterSales(period) {
    const t = document.getElementById('report-table-body'); 
    if (!t) return; 
    
    t.innerHTML = '';
    let totalRevenue = 0; 
    
    const now = new Date(); 
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfDay); startOfWeek.setDate(startOfDay.getDate() - startOfDay.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const filtered = allSales.filter(s => {
        const d = new Date(s.date);
        if (period === 'today') return d >= startOfDay;
        if (period === 'week') return d >= startOfWeek;
        if (period === 'month') return d >= startOfMonth;
        if (period === 'year') return d >= startOfYear;
        return true;
    });

    filtered.forEach(s => {
        totalRevenue += Number(s.total_amount); 
        t.innerHTML += `
            <tr class="border-b dark:border-gray-700">
                <td class="p-3">${new Date(s.date).toLocaleDateString()}</td>
                <td class="p-3 font-mono text-blue-500">${s.receipt_no || s.id}</td>
                <td class="p-3">${s.customer_name}</td>
                <td class="p-3 text-right font-bold text-green-600">${formatCurrency(s.total_amount)}</td>
                <td class="p-3 text-center">
                    <button onclick="window.posModule.deleteSale('${s.id}')" class="text-red-500 hover:text-red-700 transition">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>`;
    });
    
    document.getElementById('report-total-sales').innerText = formatCurrency(totalRevenue);
}

export async function deleteSale(id) { 
    if (await showCustomConfirm("Delete Record?", "This will remove the sale and restore item stock.", "danger")) { 
        const sb = getSupabase();
        
        // Restore stock first
        const { data: items } = await sb.from('sale_items').select('*').eq('sale_id', id);
        if (items) {
            for (let item of items) {
                const { data: p } = await sb.from('products').select('stock').eq('id', item.product_id).single();
                if (p) {
                    await sb.from('products').update({ stock: p.stock + item.quantity }).eq('id', item.product_id);
                }
            }
        }

        await sb.from('sale_items').delete().eq('sale_id', id); 
        await sb.from('sales').delete().eq('id', id); 
        openReportModal(); 
    } 
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
    
    // Prevent past dates in repair calendar
    const today = new Date().toISOString().split('T')[0];
    const dateInput = document.querySelector('input[name="predicted_date"]');
    if(dateInput) dateInput.setAttribute('min', today);

    filterRepairs(); 
}

export function filterRepairs() {
    const filter = document.getElementById('repair-filter')?.value || 'all'; 
    const tbody = document.getElementById('repairs-table-body'); 
    
    if (!tbody) return; 
    tbody.innerHTML = '';
    
    const filtered = repairsData.filter(r => {
        if (filter === 'pending') return r.status !== 'Completed';
        if (filter === 'completed') return r.status === 'Completed';
        return true;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-gray-500">No tickets found for this filter.</td></tr>`;
        return;
    }

    filtered.forEach(r => {
        const isPending = r.status !== 'Completed';
        
        const rowClass = isPending 
            ? 'bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 animate-pulse' 
            : 'bg-white dark:bg-darkcard border-l-4 border-green-500';
            
        const statusHtml = isPending
            ? `<button onclick="window.posModule.openCompleteRepairModal('${r.id}')" class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-lg text-xs font-bold shadow-sm transition">Mark Complete</button>`
            : `<span class="bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-bold border border-green-200">Completed</span>`;

        const actionsHtml = `
            <div class="flex gap-2 justify-center">
                <button onclick='window.posModule.editRepair(${JSON.stringify(r).replace(/'/g, "&#39;")})' class="text-blue-500 hover:text-blue-700 transition" title="Edit"><i class="fas fa-edit"></i></button>
                <button onclick='window.posModule.printRepairTicket(${JSON.stringify(r).replace(/'/g, "&#39;")})' class="text-gray-500 hover:text-gray-700 transition" title="Print Ticket"><i class="fas fa-print"></i></button>
                <button onclick="window.posModule.deleteRepair('${r.id}')" class="text-red-400 hover:text-red-600 transition" title="Delete"><i class="fas fa-trash"></i></button>
            </div>
        `;

        tbody.innerHTML += `
            <tr class="${rowClass} border-b dark:border-gray-700 transition">
                <td class="p-4 font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">${r.repair_id}</td>
                <td class="p-4 font-bold text-gray-800 dark:text-gray-200">${r.customer_name}</td>
                <td class="p-4 text-sm text-gray-600 dark:text-gray-400">${r.phone}</td>
                <td class="p-4 font-bold text-gray-700 dark:text-gray-300">${formatCurrency(r.advance)}</td>
                <td class="p-4 text-sm text-gray-600 dark:text-gray-400">${new Date(r.predicted_date).toLocaleDateString()}</td>
                <td class="p-4 text-center">${statusHtml}</td>
                <td class="p-4 text-center">${actionsHtml}</td>
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
    const sb = getSupabase();
    const id = document.getElementById('edit-repair-id').value; 
    
    const { error } = await sb.from('repairs').update({ 
        customer_name: document.getElementById('edit-repair-customer').value, 
        phone: document.getElementById('edit-repair-phone').value, 
        advance: parseFloat(document.getElementById('edit-repair-advance').value), 
        predicted_date: document.getElementById('edit-repair-date').value 
    }).eq('id', id); 
    
    if (error) {
        alert("Update Error: " + error.message);
    } else {
        document.getElementById('repair-edit-modal').classList.add('hidden'); 
        await showCustomConfirm("Updated", "Repair details updated.", "success-green");
        loadRepairs(); 
    }
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
    
    if (error) {
        alert(error.message);
    } else {
        e.target.reset(); 
        await showCustomConfirm("Success", "Repair Ticket Generated", "success-green");
        printRepairTicket(data);
        loadRepairs(); 
    }
}

export function printRepairTicket(repair) {
    const w = window.open('', '', 'width=400,height=600');
    const websiteUrl = window.location.origin + "/track.html";
    
    w.document.write(`
        <html>
        <head>
            <style>
                body { font-family: 'Courier New', monospace; padding: 20px; text-align: center; } 
                .box { border: 2px dashed black; padding: 15px; margin: 15px 0; background: #f9f9f9; } 
                .id { font-size: 22px; font-weight: bold; color: #333; }
                p { margin: 5px 0; font-size: 14px; }
            </style>
        </head>
        <body>
            <h2>CycleSense Repair</h2>
            <p>Date: ${new Date().toLocaleDateString()}</p>
            
            <div class="box">
                <p style="margin-bottom:5px; font-size:12px;">TICKET ID:</p>
                <div class="id">${repair.repair_id}</div>
            </div>
            
            <p style="text-align:left;"><b>Customer:</b> ${repair.customer_name}</p>
            <p style="text-align:left;"><b>Phone:</b> ${repair.phone}</p>
            <p style="text-align:left;"><b>Est Finish:</b> ${new Date(repair.predicted_date).toLocaleDateString()}</p>
            <p style="text-align:left;"><b>Advance Paid:</b> ${formatCurrency(repair.advance)}</p>
            
            <hr style="margin: 20px 0;">
            
            <h3 style="margin-bottom:5px;">Track Live Status</h3>
            <p>Visit link:</p>
            <p style="font-weight:bold;">${websiteUrl}</p>
            <p>Enter your Ticket ID: <b>${repair.repair_id}</b></p>
            
            <hr style="margin: 20px 0;">
            <p style="font-size:10px;">Please bring this ticket to collect your bicycle.</p>
            
            <script>window.print();</script>
        </body>
        </html>
    `);
    w.document.close();
}

export async function openCompleteRepairModal(id) {
    currentRepairId = id; 
    repairCart = []; 
    const sb = getSupabase();
    
    const { data: r } = await sb.from('repairs').select('*').eq('id', id).single();
    
    document.getElementById('rep-modal-customer').innerText = r.customer_name; 
    document.getElementById('rep-modal-adv').innerText = formatCurrency(r.advance);
    document.getElementById('repair-finalize-modal').classList.remove('hidden'); 
    
    const select = document.getElementById('rep-part-select'); 
    select.innerHTML = '<option value="">Select Replacement Part...</option>';
    
    const prods = await fetchAll('products'); 
    prods.forEach(p => {
        select.innerHTML += `<option value="${p.id}" data-price="${p.unit_price}" data-name="${p.name}">${p.name} - ${formatCurrency(p.unit_price)}</option>`;
    });
    
    renderRepairCart(r.advance);
}

export function addRepairPart() { 
    const select = document.getElementById('rep-part-select'); 
    const id = select.value; 
    const qtyInput = document.getElementById('rep-part-qty').value;
    
    if (!id) return; 
    
    const option = select.options[select.selectedIndex];
    
    repairCart.push({ 
        id: id, 
        name: option.getAttribute('data-name'), 
        price: parseFloat(option.getAttribute('data-price')), 
        qty: parseInt(qtyInput) 
    }); 
    
    const advStr = document.getElementById('rep-modal-adv').innerText.replace(/[^\d.]/g, '');
    renderRepairCart(parseFloat(advStr)); 
}

function renderRepairCart(advanceAmount) { 
    const tbody = document.getElementById('rep-parts-body'); 
    tbody.innerHTML = ''; 
    let totalParts = 0; 
    
    repairCart.forEach(item => { 
        totalParts += item.price * item.qty; 
        tbody.innerHTML += `
            <tr class="border-b dark:border-gray-600">
                <td class="p-2">${item.name}</td>
                <td class="p-2 text-center">${item.qty}</td>
                <td class="p-2 text-right">${formatCurrency(item.price * item.qty)}</td>
            </tr>`; 
    }); 
    
    const laborCost = parseFloat(document.getElementById('rep-labor').value || 0);
    const balanceDue = (totalParts + laborCost) - advanceAmount;
    
    document.getElementById('rep-total-due').innerText = formatCurrency(balanceDue); 
}

export async function finalizeRepair() { 
    const sb = getSupabase();
    const labor = parseFloat(document.getElementById('rep-labor').value || 0); 
    
    const { data: repair } = await sb.from('repairs').select('*').eq('id', currentRepairId).single(); 
    
    const partsTotal = repairCart.reduce((sum, item) => sum + (item.price * item.qty), 0); 
    const finalTotalAmount = partsTotal + labor; 
    const balanceDue = finalTotalAmount - repair.advance;
    
    const receiptNo = "REP-" + Date.now().toString().slice(-8);

    const { data: sale } = await sb.from('sales').insert({ 
        receipt_no: receiptNo, 
        customer_name: repair.customer_name + " (Repair Checkout)", 
        phone: repair.phone, 
        service_cost: labor, 
        total_amount: finalTotalAmount, 
        date: new Date().toISOString() 
    }).select().single();
    
    if (repairCart.length > 0) {
        const itemsToInsert = repairCart.map(i => ({ sale_id: sale.id, product_id: i.id, quantity: i.qty, price: i.price }));
        await sb.from('sale_items').insert(itemsToInsert);
        
        for (let item of repairCart) { 
            const { data: p } = await sb.from('products').select('stock').eq('id', item.id).single();
            if (p) {
                await sb.from('products').update({ stock: p.stock - item.qty }).eq('id', item.id);
            }
        }
    }

    await sb.from('repairs').update({ 
        status: 'Completed', 
        final_amount: finalTotalAmount, 
        balance_due: balanceDue 
    }).eq('id', currentRepairId); 
    
    document.getElementById('repair-finalize-modal').classList.add('hidden'); 
    generateBill(sale, repairCart);
    await showCustomConfirm("Completed", "Repair finished and billed successfully.", "success-green"); 
    loadRepairs(); 
}


// ==========================================
// 4. HR, PAYROLL & ATTENDANCE SYSTEM
// ==========================================
let workersData = [];

export async function loadHR() {
    const sb = getSupabase();
    const { data } = await sb.from('workers').select('*').order('id', { ascending: false });
    workersData = data || [];
    
    const list = document.getElementById('workers-list');
    if (!list) return; 
    
    list.innerHTML = '';
    
    const attSelect = document.getElementById('hr-att-worker');
    const advSelect = document.getElementById('hr-adv-worker');
    const paySelect = document.getElementById('hr-pay-worker');
    let optionsHtml = '<option value="">Select Worker...</option>';

    workersData.forEach(w => {
        list.innerHTML += `
            <div class="p-4 bg-white dark:bg-slate-700 rounded-xl shadow-sm border border-gray-100 dark:border-gray-600 hover:shadow-md transition">
                <div class="flex justify-between items-start">
                    <div>
                        <h4 class="font-black text-gray-800 dark:text-white">${w.name}</h4>
                        <div class="text-[10px] font-mono mt-1 mb-1 bg-gray-100 dark:bg-slate-800 p-1 rounded inline-block text-gray-700 dark:text-gray-300">
                            ID: <b>${w.worker_uid || w.id}</b> | PIN: <b>${w.pin || '1234'}</b>
                        </div>
                        <p class="text-xs text-gray-500 mt-1">
                            <i class="fas fa-id-card"></i> ${w.nic || 'No NIC'} | 
                            <i class="fas fa-birthday-cake"></i> ${w.dob || 'No DOB'}
                        </p>
                        <p class="text-xs text-gray-500 mt-1"><i class="fas fa-phone"></i> ${w.phone || 'N/A'}</p>
                    </div>
                    <div class="flex flex-col gap-2">
                        <div class="flex gap-2 justify-end">
                            <button onclick="window.posModule.viewWorkerAttendance('${w.id}')" class="text-blue-500 hover:bg-blue-50 dark:hover:bg-slate-600 p-2 rounded transition" title="View Salary & Attendance"><i class="fas fa-chart-bar"></i></button>
                            <button onclick="window.posModule.openEditWorker('${w.id}')" class="text-green-500 hover:bg-green-50 dark:hover:bg-slate-600 p-2 rounded transition" title="Edit Worker Details"><i class="fas fa-edit"></i></button>
                            <button onclick="window.posModule.deleteWorker('${w.id}')" class="text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-slate-600 p-2 rounded transition" title="Delete Worker"><i class="fas fa-trash"></i></button>
                        </div>
                        <div class="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 font-bold px-2 py-1 rounded text-xs text-center border border-green-200 dark:border-green-800">
                            ${formatCurrency(w.daily_salary)} / Day
                        </div>
                    </div>
                </div>
            </div>`;
            
        optionsHtml += `<option value="${w.id}">${w.name} (${w.worker_uid || w.id})</option>`;
    });

    if (attSelect) attSelect.innerHTML = optionsHtml;
    if (advSelect) advSelect.innerHTML = optionsHtml;
    if (paySelect) paySelect.innerHTML = optionsHtml;
    
    // Default dates to today
    const todayStr = new Date().toISOString().split('T')[0];
    if (document.getElementById('hr-att-date')) document.getElementById('hr-att-date').value = todayStr;
    if (document.getElementById('hr-adv-date')) document.getElementById('hr-adv-date').value = todayStr;

    // Load the Live Dashboard Math
    loadHRDashboardSummary();
}

async function loadHRDashboardSummary() {
    const sb = getSupabase();
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const startOfMonth = `${year}-${month}-01`;
    const todayStr = today.toISOString().split('T')[0];

    // 1. Check for Birthdays
    let birthdayMessages = "";
    workersData.forEach(w => {
        if (w.dob) {
            const [, bMonth, bDay] = w.dob.split('-');
            if (bMonth === month && parseInt(bDay) === today.getDate()) {
                birthdayMessages += `🎉 It is ${w.name}'s Birthday today! `;
            }
        }
    });
    
    const bdayAlertEl = document.getElementById('bday-alert');
    if (bdayAlertEl) {
        if (birthdayMessages !== "") { 
            bdayAlertEl.classList.remove('hidden'); 
            bdayAlertEl.innerHTML = `<i class="fas fa-birthday-cake"></i> ${birthdayMessages}`; 
        } else { 
            bdayAlertEl.classList.add('hidden'); 
        }
    }

    // 2. Salary Date Reminder
    // If today is between the 18th and 25th of the month
    const salAlertEl = document.getElementById('salary-alert');
    if (salAlertEl) {
        if (today.getDate() >= 18 && today.getDate() <= 25) {
            salAlertEl.classList.remove('hidden');
            salAlertEl.innerHTML = `<i class="fas fa-exclamation-triangle"></i> Notice: Salary Date Approaching (25th). Prepare Payroll Slips.`;
        } else { 
            salAlertEl.classList.add('hidden'); 
        }
    }

    // 3. Calculate Live Accrued Payroll Math
    const { data: attData } = await sb.from('attendance').select('*').gte('date', startOfMonth).lte('date', todayStr);
    const { data: advData } = await sb.from('advances').select('*').gte('date', startOfMonth).lte('date', todayStr);

    let totalAccruedGross = 0;
    let totalAdvancesGiven = 0;

    if (advData) {
        advData.forEach(a => totalAdvancesGiven += Number(a.amount));
    }

    workersData.forEach(w => {
        const myAtt = (attData || []).filter(a => String(a.worker_id) === String(w.id));
        let myGross = 0;
        
        myAtt.forEach(a => {
            // Base day logic
            if (a.status === 'Full Day' || a.status === 'Short Leave') {
                myGross += w.daily_salary;
            } else if (a.status === 'Half Day') {
                myGross += (w.daily_salary / 2);
            }

            // Time Penalty logic for Full Days
            if (a.status === 'Full Day' && a.in_time && a.out_time) {
                const parseTime = t => { const [hr, mn] = t.split(':').map(Number); return hr * 60 + mn; };
                const inMins = parseTime(a.in_time); 
                const outMins = parseTime(a.out_time);
                
                let missedMins = 0;
                // Standard Shift: 10:00 (600m) to 17:00 (1020m)
                if (inMins > 600) missedMins += (inMins - 600);
                if (outMins < 1020) missedMins += (1020 - outMins);
                
                if (missedMins > 0) {
                    const ratePerMin = w.daily_salary / 420; // 420 mins = 7 hours
                    myGross -= (missedMins * ratePerMin);
                }
            }
        });
        totalAccruedGross += myGross;
    });

    const epfEmployeePortion = totalAccruedGross * 0.08;
    const netPayableCurrent = totalAccruedGross - totalAdvancesGiven - epfEmployeePortion;
    const epfEmployerPortion = totalAccruedGross * 0.12;
    const etfEmployerPortion = totalAccruedGross * 0.03;

    if(document.getElementById('accrued-gross')) document.getElementById('accrued-gross').innerText = formatCurrency(totalAccruedGross);
    if(document.getElementById('accrued-advances')) document.getElementById('accrued-advances').innerText = "- " + formatCurrency(totalAdvancesGiven);
    if(document.getElementById('accrued-net')) document.getElementById('accrued-net').innerText = formatCurrency(netPayableCurrent);
    if(document.getElementById('accrued-epf')) document.getElementById('accrued-epf').innerText = formatCurrency(epfEmployerPortion + epfEmployeePortion);
    if(document.getElementById('accrued-etf')) document.getElementById('accrued-etf').innerText = formatCurrency(etfEmployerPortion);
}

export async function addWorker(e) {
    e.preventDefault(); 
    const sb = getSupabase();
    const form = new FormData(e.target);
    
    // W2026001 Auto Generator
    const year = new Date().getFullYear();
    const { data: lastWorker } = await sb.from('workers')
        .select('worker_uid')
        .ilike('worker_uid', `W${year}%`)
        .order('worker_uid', { ascending: false })
        .limit(1);

    let nextNumber = 1;
    if (lastWorker && lastWorker.length > 0 && lastWorker[0].worker_uid) {
        const lastNumStr = lastWorker[0].worker_uid.slice(-3);
        nextNumber = parseInt(lastNumStr) + 1;
    }
    const generatedUid = `W${year}${String(nextNumber).padStart(3, '0')}`;

    const { error } = await sb.from('workers').insert({ 
        worker_uid: generatedUid, 
        name: form.get('name'), 
        phone: form.get('phone'), 
        nic: form.get('nic'), 
        dob: form.get('dob') || null, 
        address: form.get('address'), 
        daily_salary: Number(form.get('daily_salary')), 
        pin: '1234' 
    });
    
    if (error) {
        alert(error.message);
    } else { 
        e.target.reset(); 
        await showCustomConfirm("Success", `Worker Created!\nPortal ID: ${generatedUid}\nDefault PIN: 1234`, "success-green");
        loadHR(); 
    }
}

export function openEditWorker(id) {
    const w = workersData.find(x => String(x.id) === String(id)); 
    if (!w) return;
    
    document.getElementById('ew-id').value = w.id; 
    document.getElementById('ew-name').value = w.name;
    document.getElementById('ew-phone').value = w.phone || ''; 
    document.getElementById('ew-nic').value = w.nic || '';
    document.getElementById('ew-dob').value = w.dob || ''; 
    document.getElementById('ew-address').value = w.address || '';
    document.getElementById('ew-salary').value = w.daily_salary; 
    document.getElementById('ew-pin').value = w.pin || '1234';
    
    document.getElementById('edit-worker-modal').classList.remove('hidden');
}

export async function saveEditWorker(e) {
    e.preventDefault(); 
    const sb = getSupabase();
    const form = new FormData(e.target);
    
    const { error } = await sb.from('workers').update({ 
        name: form.get('name'), 
        phone: form.get('phone'), 
        nic: form.get('nic'), 
        dob: form.get('dob') || null, 
        address: form.get('address'), 
        daily_salary: Number(form.get('salary')), 
        pin: form.get('pin') 
    }).eq('id', form.get('id'));
    
    if(error) alert(error.message);
    else {
        document.getElementById('edit-worker-modal').classList.add('hidden'); 
        await showCustomConfirm("Success", "Worker Details Updated", "success-green");
        loadHR();
    }
}

export async function deleteWorker(id) { 
    if (await showCustomConfirm("Delete Worker?", "This deletes the worker profile and all history permanently.", "danger")) { 
        await getSupabase().from('workers').delete().eq('id', id); 
        loadHR(); 
    } 
}

export async function markAttendance(e) {
    e.preventDefault(); 
    const sb = getSupabase();
    const form = new FormData(e.target); 
    const wId = form.get('worker_id'); 
    const d = form.get('date');
    
    // Delete existing record for this specific day to prevent duplicate errors
    await sb.from('attendance').delete().match({ worker_id: wId, date: d });
    
    const { error } = await sb.from('attendance').insert({ 
        worker_id: wId, 
        date: d, 
        status: form.get('status'), 
        in_time: form.get('in_time'), 
        out_time: form.get('out_time') 
    });
    
    if (error) {
        alert("Error: " + error.message);
    } else { 
        e.target.reset(); 
        document.getElementById('hr-att-date').value = new Date().toISOString().split('T')[0]; 
        loadHRDashboardSummary(); 
        await showCustomConfirm("Saved", "Attendance Logged", "success-green");
    }
}

export async function addAdvance(e) {
    e.preventDefault(); 
    const sb = getSupabase();
    const form = new FormData(e.target);
    
    const { error } = await sb.from('advances').insert({ 
        worker_id: form.get('worker_id'), 
        date: form.get('date'), 
        amount: Number(form.get('amount')) 
    });
    
    if (error) {
        alert("Error: " + error.message); 
    } else { 
        e.target.reset(); 
        document.getElementById('hr-adv-date').value = new Date().toISOString().split('T')[0]; 
        loadHRDashboardSummary(); 
        await showCustomConfirm("Saved", "Advance registered successfully.", "success-green");
    }
}

export async function calculateWorkerSalary(wId, monthStr) {
    const sb = getSupabase();
    const worker = workersData.find(w => String(w.id) === String(wId));
    if (!worker) return null;

    const [year, month] = monthStr.split('-');
    
    // Assuming standard month cycle (can be adapted to 26th-25th later if needed)
    const startDate = `${monthStr}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];

    const { data: attData } = await sb.from('attendance')
        .select('*').eq('worker_id', wId).gte('date', startDate).lte('date', endDate).order('date', {ascending:true});
        
    const { data: advData } = await sb.from('advances')
        .select('*').eq('worker_id', wId).gte('date', startDate).lte('date', endDate);

    let full = 0, half = 0, short = 0, timePenalty = 0;

    (attData || []).forEach(a => {
        if (a.status === 'Half Day') half++;
        else if (a.status === 'Short Leave') short++;
        else if (a.status === 'Full Day') {
            full++;
            if (a.in_time && a.out_time) {
                const parse = t => { const [h,m] = t.split(':').map(Number); return h * 60 + m; };
                const inMins = parse(a.in_time);
                const outMins = parse(a.out_time);
                let missed = 0;
                
                if (inMins > 600) missed += (inMins - 600); // 10:00 AM
                if (outMins < 1020) missed += (1020 - outMins); // 5:00 PM
                
                if (missed > 0) {
                    const ratePerMin = worker.daily_salary / 420; // 7 Hours
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

    return { 
        worker, attData, advData, full, half, short, timePenalty, 
        grossEarnings, totalAdvances, epfDeduction, netPay, monthStr 
    };
}

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
    if (!data) return;

    document.getElementById('view-att-name').innerText = data.worker.name + ` (${data.worker.worker_uid})`;
    document.getElementById('view-att-gross').innerText = formatCurrency(data.grossEarnings);
    document.getElementById('view-att-net').innerText = formatCurrency(data.netPay);
    
    const tbody = document.getElementById('view-att-table');
    tbody.innerHTML = '';
    
    data.attData.forEach(a => {
        let penText = '-';
        if (a.status === 'Full Day' && a.in_time && a.out_time) {
            const inMins = parseInt(a.in_time.split(':')[0]) * 60 + parseInt(a.in_time.split(':')[1]);
            const outMins = parseInt(a.out_time.split(':')[0]) * 60 + parseInt(a.out_time.split(':')[1]);
            let missed = 0;
            if (inMins > 600) missed += (inMins - 600);
            if (outMins < 1020) missed += (1020 - outMins);
            if (missed > 0) {
                penText = formatCurrency(missed * (data.worker.daily_salary / 420));
            }
        }
        tbody.innerHTML += `
            <tr class="border-b dark:border-gray-700 text-sm">
                <td class="p-2">${a.date}</td>
                <td class="p-2 font-bold">${a.status}</td>
                <td class="p-2">${a.in_time || '-'} to ${a.out_time || '-'}</td>
                <td class="p-2 text-red-500">${penText}</td>
            </tr>`;
    });
    
    if (data.attData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-gray-500">No records found for this month.</td></tr>`;
    }
}

export async function generatePayroll(e) {
    e.preventDefault(); 
    const form = new FormData(e.target); 
    const wId = form.get('worker_id'); 
    const mStr = form.get('month');
    
    const data = await calculateWorkerSalary(wId, mStr);
    if (!data) return alert("Error locating worker.");

    const win = window.open('', '', 'width=600,height=800');
    
    const html = `
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; padding: 40px; color: #333; }
                .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 20px; }
                h1 { margin: 0; color: #1e3a8a; } 
                h3 { margin: 5px 0; color: #666; }
                .row { display: flex; justify-content: space-between; border-bottom: 1px dashed #eee; padding: 10px 0; font-size:14px; }
                .bold { font-weight: bold; }
                .total-row { display: flex; justify-content: space-between; border-top: 2px solid #333; border-bottom: 2px solid #333; padding: 15px 0; font-size: 18px; margin-top: 20px; background: #f8fafc; }
                .section-title { margin-top: 30px; font-size: 14px; text-transform: uppercase; color: #888; border-bottom: 1px solid #ccc; padding-bottom: 5px; }
                .adv-list { font-size: 12px; color: #888; padding-left: 20px; margin: 2px 0; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>CycleSense</h1>
                <h3>Official Salary Slip</h3>
                <p>Month: <b>${data.monthStr}</b></p>
            </div>
            
            <div class="row">
                <span>Employee Name:</span> 
                <span class="bold">${data.worker.name} (ID: ${data.worker.worker_uid})</span>
            </div>
            <div class="row">
                <span>Daily Rate Base:</span> 
                <span>${formatCurrency(data.worker.daily_salary)}</span>
            </div>

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

            <div class="total-row">
                <span class="bold" style="color: #16a34a;">NET PAYABLE</span> 
                <span class="bold" style="color: #16a34a;">${formatCurrency(data.netPay)}</span>
            </div>

            <div class="section-title">Employer Contributions (Info Only)</div>
            <div class="row"><span>EPF Contribution (12%)</span> <span>${formatCurrency(data.grossEarnings * 0.12)}</span></div>
            <div class="row"><span>ETF Contribution (3%)</span> <span>${formatCurrency(data.grossEarnings * 0.03)}</span></div>

            <div style="margin-top: 50px; display: flex; justify-content: space-between;">
                <div style="border-top: 1px solid #333; width: 200px; text-align: center; padding-top: 5px;">Manager Signature</div>
                <div style="border-top: 1px solid #333; width: 200px; text-align: center; padding-top: 5px;">Employee Signature</div>
            </div>
            
            <script>window.print();</script>
        </body>
        </html>
    `;
    win.document.write(html);
    win.document.close();
}


// ==========================================
// 5. CALENDAR SYSTEM
// ==========================================
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();

export async function initCalendar() { 
    renderCalendar(currentMonth, currentYear); 
}

export function nextMonth() { 
    currentMonth++; 
    if (currentMonth > 11) { 
        currentMonth = 0; 
        currentYear++; 
    } 
    renderCalendar(currentMonth, currentYear); 
}

export function prevMonth() { 
    currentMonth--; 
    if (currentMonth < 0) { 
        currentMonth = 11; 
        currentYear--; 
    } 
    renderCalendar(currentMonth, currentYear); 
}

async function renderCalendar(month, year) {
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    document.getElementById('cal-month-year').innerText = `${monthNames[month]} ${year}`;
    
    const daysContainer = document.getElementById('cal-days');
    if (!daysContainer) return;
    
    daysContainer.innerHTML = '';
    
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const sDate = `${year}-${String(month+1).padStart(2,'0')}-01`;
    const eDate = `${year}-${String(month+1).padStart(2,'0')}-${daysInMonth}`;
    
    const sb = getSupabase();
    const { data: events } = await sb.from('calendar_events')
        .select('*').gte('event_date', sDate).lte('event_date', eDate);
    
    // Empty boxes for previous month days
    for (let i = 0; i < firstDay; i++) { 
        daysContainer.innerHTML += `<div class="p-4 border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-slate-800 opacity-50 rounded"></div>`; 
    }
    
    // Actual days
    for (let day = 1; day <= daysInMonth; day++) {
        const fullDate = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
        const dayEvents = (events || []).filter(e => e.event_date === fullDate);
        
        let eventHtml = '';
        dayEvents.forEach(e => {
            eventHtml += `<div class="bg-blue-100 text-blue-800 text-[10px] p-1 rounded mt-1 truncate" title="${e.title}">${e.title}</div>`;
        });
        
        daysContainer.innerHTML += `
            <div class="p-2 border border-gray-100 dark:border-gray-700 min-h-[80px] rounded cursor-pointer hover:bg-blue-50 dark:hover:bg-slate-700 transition" onclick="window.posModule.openEventModal('${fullDate}')">
                <span class="font-bold text-gray-700 dark:text-gray-300">${day}</span>
                ${eventHtml}
            </div>`;
    }
}

export function openEventModal(dateStr) {
    document.getElementById('event-date').value = dateStr;
    document.getElementById('event-title').value = '';
    document.getElementById('calendar-event-modal').classList.remove('hidden');
}

export async function saveCalendarEvent(e) {
    e.preventDefault();
    const sb = getSupabase();
    const dateStr = document.getElementById('event-date').value;
    const title = document.getElementById('event-title').value;
    
    const { error } = await sb.from('calendar_events').insert({ event_date: dateStr, title: title });
    
    if (error) {
        alert("Error saving event: " + error.message);
    } else {
        document.getElementById('calendar-event-modal').classList.add('hidden');
        renderCalendar(currentMonth, currentYear);
    }
}
