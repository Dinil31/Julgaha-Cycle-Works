// js/pos_module.js
import { getSupabase } from './config.js';
import { showCustomConfirm, showCustomPrompt } from './ui.js';

const formatCurrency = (val) => new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR' }).format(val);

async function fetchAll(table) {
    const sb = getSupabase();
    const { data, error } = await sb.from(table).select('*').order('id', { ascending: false });
    if (error) { console.error(`Error fetching ${table}:`, error.message); return []; }
    return data;
}

// --- 1. INVENTORY & RESTOCK ---
export async function loadInventory() {
    const products = await fetchAll('products');
    const tbody = document.getElementById('inventory-table-body');
    if(!tbody) return;
    
    tbody.innerHTML = '';
    let lowStockCount = 0;

    products.forEach(p => {
        const isLow = p.stock <= p.reorder_level;
        if(isLow) lowStockCount++;
        
        tbody.innerHTML += `
            <tr class="bg-white border-b dark:bg-slate-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-slate-700 transition">
                <td class="px-6 py-4 font-mono text-sm text-gray-500">${p.code}</td>
                <td class="px-6 py-4 font-bold text-gray-800 dark:text-gray-200">${p.name}</td>
                <td class="px-6 py-4 ${isLow ? 'text-red-500 font-bold animate-pulse' : 'text-green-500'}">${p.stock}</td>
                <td class="px-6 py-4 text-gray-500">${p.reorder_level}</td>
                <td class="px-6 py-4">${formatCurrency(p.unit_price)}</td>
                <td class="px-6 py-4">
                    <span class="${isLow ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'} text-xs font-bold px-2.5 py-0.5 rounded-full">
                        ${isLow ? 'Low Stock' : 'In Stock'}
                    </span>
                </td>
            </tr>`;
    });

    if(lowStockCount > 0) {
        showCustomConfirm("Inventory Alert", `⚠️ Warning: ${lowStockCount} items are low on stock!`, "danger");
    }
}

export function generateRestockPDF() {
    const sb = getSupabase();
    sb.from('products').select('*').lte('stock', 5).then(({data}) => { // lte matches reorder level logic roughly
        if(!data || data.length === 0) return alert("No items need restocking.");
        
        const printWindow = window.open('', '', 'width=800,height=600');
        const html = `
            <html><head><title>Restock List</title>
            <style>body{font-family:sans-serif; padding:20px;} table{width:100%; border-collapse:collapse;} th,td{border:1px solid #ddd; padding:8px; text-align:left;} th{background:#f4f4f4;}</style>
            </head><body>
            <h2>📦 Restock Required List</h2>
            <p>Generated: ${new Date().toLocaleString()}</p>
            <table>
                <tr><th>Code</th><th>Name</th><th>Current Stock</th><th>Reorder Level</th></tr>
                ${data.map(p => `<tr><td>${p.code}</td><td>${p.name}</td><td style="color:red; font-weight:bold;">${p.stock}</td><td>${p.reorder_level}</td></tr>`).join('')}
            </table>
            <script>window.print();</script>
            </body></html>`;
        printWindow.document.write(html);
        printWindow.document.close();
    });
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

// --- 2. POS & SALES ---
let cart = [];
let productsCache = [];

export async function initPOS() {
    productsCache = await fetchAll('products');
    const select = document.getElementById('pos-product-select');
    if(select) {
        select.innerHTML = '<option value="">Select Product...</option>';
        productsCache.forEach(p => {
            select.innerHTML += `<option value="${p.id}">${p.name} (Stock: ${p.stock}) - ${formatCurrency(p.unit_price)}</option>`;
        });
    }
}

export function addToCart() {
    const select = document.getElementById('pos-product-select');
    const qtyInput = document.getElementById('pos-qty');
    const id = select.value;
    if(!id) return alert("Select Product");
    
    const p = productsCache.find(x => String(x.id) === String(id));
    const qty = parseInt(qtyInput.value);
    
    if(qty > p.stock) return alert("Low Stock!");
    
    const exist = cart.find(i => i.id === id);
    if(exist) exist.qty += qty;
    else cart.push({ id, name: p.name, price: p.unit_price, qty });
    
    renderCart();
    qtyInput.value = 1;
}

function renderCart() {
    const tbody = document.getElementById('cart-table-body');
    const totalEl = document.getElementById('pos-total');
    if(!tbody) return;
    tbody.innerHTML = '';
    let total = 0;
    cart.forEach((i, idx) => {
        total += i.price * i.qty;
        tbody.innerHTML += `<tr><td>${i.name}</td><td class="text-center">${i.qty}</td><td class="text-right">${formatCurrency(i.price * i.qty)}</td><td><button onclick="window.removeCartItem(${idx})" class="text-red-500"><i class="fas fa-times"></i></button></td></tr>`;
    });
    const svc = parseFloat(document.getElementById('pos-service-cost')?.value || 0);
    totalEl.innerText = formatCurrency(total + svc);
}

window.removeCartItem = (idx) => { cart.splice(idx, 1); renderCart(); };

export async function processSale(e) {
    e.preventDefault();
    const sb = getSupabase();
    const form = new FormData(e.target);
    const svc = parseFloat(form.get('service_cost') || 0);
    const total = cart.reduce((s, i) => s + (i.price*i.qty), 0) + svc;
    
    // Generate Long ID
    const receiptNo = Date.now().toString() + Math.floor(Math.random()*100).toString();

    if(cart.length === 0 && svc <= 0) return alert("Empty Sale");

    const { data: sale, error } = await sb.from('sales').insert({
        receipt_no: receiptNo,
        customer_name: form.get('customer_name') || 'Walk-in',
        phone: form.get('phone'),
        service_cost: svc,
        total_amount: total,
        date: new Date().toISOString()
    }).select().single();

    if(error) return alert(error.message);

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
    renderCart();
    initPOS();
}

// --- DELETE SALES (And Restore Stock) ---
export async function deleteSale(saleId) {
    const confirm = await showCustomConfirm("Delete Sale?", "This will delete the sale and RESTORE inventory stock.", "danger");
    if(!confirm) return;

    const sb = getSupabase();
    // Get Items to restore stock
    const { data: items } = await sb.from('sale_items').select('*').eq('sale_id', saleId);
    
    if(items) {
        for(let item of items) {
            // Get current stock
            const { data: prod } = await sb.from('products').select('stock').eq('id', item.product_id).single();
            if(prod) {
                await sb.from('products').update({ stock: prod.stock + item.quantity }).eq('id', item.product_id);
            }
        }
    }

    await sb.from('sale_items').delete().eq('sale_id', saleId);
    await sb.from('sales').delete().eq('id', saleId);
    
    await showCustomConfirm("Deleted", "Sale deleted and stock restored.", "success-green");
    window.openReportModal(); // Refresh table
}

// --- 3. REPAIRS & COMPLETION FLOW ---
let repairCart = []; // Special cart for repairs

export async function loadRepairs() {
    const repairs = await fetchAll('repairs');
    const tbody = document.getElementById('repairs-table-body');
    if(!tbody) return;

    tbody.innerHTML = '';
    let pendingCount = 0;

    repairs.forEach(r => {
        if(r.status === 'In Progress' || r.status === 'Pending') pendingCount++;
        
        const statusBadge = r.status === 'Completed' 
            ? '<span class="bg-green-100 text-green-800 px-2 rounded font-bold">Completed</span>'
            : `<button onclick="window.openCompleteRepairModal('${r.id}')" class="bg-blue-600 text-white px-3 py-1 rounded text-xs hover:bg-blue-700 shadow">Mark Complete</button>`;

        const deleteBtn = `<button onclick="window.deleteRepair('${r.id}')" class="text-red-400 hover:text-red-600 ml-2"><i class="fas fa-trash"></i></button>`;

        tbody.innerHTML += `
            <tr class="bg-white border-b dark:bg-slate-800 dark:border-gray-700">
                <td class="px-6 py-4 font-mono text-xs text-indigo-500">${r.repair_id}</td>
                <td class="px-6 py-4">${r.customer_name}</td>
                <td class="px-6 py-4">${new Date(r.predicted_date).toLocaleDateString()}</td>
                <td class="px-6 py-4">${statusBadge} ${deleteBtn}</td>
            </tr>`;
    });

    if(pendingCount > 0) showCustomConfirm("Pending Jobs", `You have ${pendingCount} bikes pending repair.`, "confirm");
}

export async function addRepair(e) {
    e.preventDefault();
    const sb = getSupabase();
    const form = new FormData(e.target);
    const { error } = await sb.from('repairs').insert({
        repair_id: 'REP-' + Math.floor(100000 + Math.random() * 900000),
        customer_name: form.get('customer_name'),
        phone: form.get('phone'),
        advance: Number(form.get('advance')),
        predicted_date: form.get('predicted_date'),
        status: 'Pending'
    });
    if(error) alert(error.message);
    else { await showCustomConfirm("Success", "Repair Ticket Created!", "success-green"); e.target.reset(); loadRepairs(); }
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

window.openCompleteRepairModal = async (id) => {
    currentRepairId = id;
    repairCart = []; // Reset repair parts
    const sb = getSupabase();
    const { data: repair } = await sb.from('repairs').select('*').eq('id', id).single();
    
    // Fill Modal
    document.getElementById('rep-modal-customer').innerText = repair.customer_name;
    document.getElementById('rep-modal-adv').innerText = formatCurrency(repair.advance);
    document.getElementById('repair-finalize-modal').classList.remove('hidden');
    
    // Populate Parts Select inside modal
    const select = document.getElementById('rep-part-select');
    select.innerHTML = '<option value="">Select Used Part...</option>';
    const products = await fetchAll('products');
    products.forEach(p => {
        select.innerHTML += `<option value="${p.id}" data-price="${p.unit_price}" data-name="${p.name}">${p.name} - ${formatCurrency(p.unit_price)}</option>`;
    });
    
    renderRepairCart(repair.advance);
}

window.addRepairPart = () => {
    const select = document.getElementById('rep-part-select');
    const qty = document.getElementById('rep-part-qty').value;
    const id = select.value;
    if(!id) return;
    
    const name = select.options[select.selectedIndex].getAttribute('data-name');
    const price = parseFloat(select.options[select.selectedIndex].getAttribute('data-price'));
    
    repairCart.push({ id, name, price, qty: parseInt(qty) });
    
    // Get advance again from UI to recalc
    const advText = document.getElementById('rep-modal-adv').innerText.replace(/[^\d.]/g, '');
    renderRepairCart(parseFloat(advText));
}

function renderRepairCart(advance) {
    const tbody = document.getElementById('rep-parts-body');
    tbody.innerHTML = '';
    let partsTotal = 0;
    
    repairCart.forEach(i => {
        partsTotal += i.price * i.qty;
        tbody.innerHTML += `<tr><td>${i.name}</td><td>${i.qty}</td><td>${formatCurrency(i.price*i.qty)}</td></tr>`;
    });
    
    const labor = parseFloat(document.getElementById('rep-labor').value || 0);
    const total = partsTotal + labor;
    const due = total - advance;
    
    document.getElementById('rep-total-due').innerText = formatCurrency(due);
}

window.finalizeRepair = async () => {
    const labor = parseFloat(document.getElementById('rep-labor').value || 0);
    const advanceStr = document.getElementById('rep-modal-adv').innerText.replace(/[^\d.]/g, ''); // Crude parsing
    const advance = parseFloat(advanceStr) / 100; // Fix currency parsing logic in real app
    
    const sb = getSupabase();
    
    // 1. Get Repair Details
    const { data: repair } = await sb.from('repairs').select('*').eq('id', currentRepairId).single();
    const partsTotal = repairCart.reduce((s, i) => s + (i.price * i.qty), 0);
    const finalTotal = partsTotal + labor;
    const balance = finalTotal - repair.advance;

    // 2. Create Sale Record (Integration)
    const receiptNo = "REP-" + Date.now().toString().slice(-8);
    const { data: sale } = await sb.from('sales').insert({
        receipt_no: receiptNo,
        customer_name: repair.customer_name + " (Repair)",
        phone: repair.phone,
        service_cost: labor,
        total_amount: finalTotal, // Full amount (Advance is payment method technically, but simple accounting here)
        date: new Date().toISOString()
    }).select().single();

    // 3. Add Items & Deduct Stock
    if (repairCart.length > 0) {
        const items = repairCart.map(i => ({ sale_id: sale.id, product_id: i.id, quantity: i.qty, price: i.price }));
        await sb.from('sale_items').insert(items);
        for(let item of repairCart) {
            // Deduct stock
            const { data: p } = await sb.from('products').select('stock').eq('id', item.id).single();
            if(p) await sb.from('products').update({ stock: p.stock - item.qty }).eq('id', item.id);
        }
    }

    // 4. Update Repair Ticket Status
    await sb.from('repairs').update({
        status: 'Completed',
        parts_used: repairCart,
        final_amount: finalTotal,
        balance_due: balance
    }).eq('id', currentRepairId);

    // 5. Print Bill
    generateBill(sale, repairCart); // Reusing billing function

    document.getElementById('repair-finalize-modal').classList.add('hidden');
    await showCustomConfirm("Completed", "Repair finished & Bill Generated.", "success-green");
    loadRepairs();
}

// --- BILLING GEN ---
function generateBill(sale, items) {
    const printWindow = window.open('', '', 'width=400,height=600');
    let itemsHtml = items.map(i => `<tr><td>${i.name}</td><td>${i.qty}</td><td style="text-align:right">${(i.price*i.qty).toFixed(2)}</td></tr>`).join('');
    
    const html = `<html><head><style>body{font-family:'Courier New'; padding:20px;} table{width:100%; font-size:12px;}</style></head><body>
    <center><h2>CycleSense</h2><p>Repair Receipt</p></center><hr>
    <p>Receipt: ${sale.receipt_no || sale.id}</p>
    <p>Date: ${new Date().toLocaleString()}</p>
    <p>Customer: ${sale.customer_name}</p><hr>
    <table><tr><th align="left">Item</th><th>Qty</th><th align="right">Price</th></tr>${itemsHtml}</table><hr>
    <p align="right">Labor: ${sale.service_cost.toFixed(2)}</p>
    <h3 align="right">TOTAL: ${sale.total_amount.toFixed(2)}</h3>
    <center><p>Track Status at: cyclesense-cloud.netlify.app/track.html</p><p>ID: ${sale.receipt_no}</p></center>
    <script>window.print();</script></body></html>`;
    
    printWindow.document.write(html);
    printWindow.document.close();
}

// Sales Table Functions
export async function openReportModal() {
    document.getElementById('sales-report-modal').classList.remove('hidden');
    const sb = getSupabase();
    const { data } = await sb.from('sales').select('*').order('date', {ascending:false});
    
    const tbody = document.getElementById('report-table-body');
    tbody.innerHTML = '';
    data.forEach(s => {
        tbody.innerHTML += `
            <tr class="border-b dark:border-gray-700">
                <td class="p-3">${new Date(s.date).toLocaleDateString()}</td>
                <td class="p-3 font-mono text-blue-500">${s.receipt_no || s.id}</td>
                <td class="p-3">${s.customer_name}</td>
                <td class="p-3 text-right text-green-600 font-bold">${formatCurrency(s.total_amount)}</td>
                <td class="p-3 text-center">
                    <button onclick="window.deleteSale('${s.id}')" class="text-red-500 hover:bg-red-100 p-2 rounded"><i class="fas fa-trash"></i></button>
                </td>
            </tr>`;
    });
}
export function closeReportModal() { document.getElementById('sales-report-modal').classList.add('hidden'); }
window.deleteSale = deleteSale; // Expose
window.openCompleteRepairModal = openCompleteRepairModal;
window.addRepairPart = addRepairPart;
window.finalizeRepair = finalizeRepair;
