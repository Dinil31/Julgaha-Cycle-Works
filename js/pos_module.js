// js/pos_module.js
import { getSupabase } from './config.js';
import { showCustomConfirm } from './ui.js';

// --- HELPERS ---
const formatCurrency = (val) => new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR' }).format(val);

async function fetchAll(table) {
    const sb = getSupabase();
    const { data, error } = await sb.from(table).select('*').order('id', { ascending: false });
    if (error) { console.error(`Error fetching ${table}:`, error); return []; }
    return data;
}

// --- 1. INVENTORY ---
export async function loadInventory() {
    const products = await fetchAll('products');
    const tbody = document.getElementById('inventory-table-body');
    if(!tbody) return;
    
    tbody.innerHTML = '';
    if(products.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-gray-500">No products found.</td></tr>';
        return;
    }

    products.forEach(p => {
        const isLow = p.stock <= p.reorder_level;
        const row = `
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
        tbody.innerHTML += row;
    });
}

export async function addProduct(e) {
    e.preventDefault();
    const form = new FormData(e.target);
    const sb = getSupabase();
    
    const payload = {
        code: form.get('code').toUpperCase(),
        name: form.get('name'),
        stock: Number(form.get('stock')),
        reorder_level: Number(form.get('reorder_level')),
        unit_price: Number(form.get('unit_price'))
    };

    const { error } = await sb.from('products').insert(payload);
    if(error) alert("Error: " + error.message);
    else {
        await showCustomConfirm("Success", "Product added!", "success-green");
        e.target.reset();
        loadInventory();
    }
}

// --- 2. POS & SALES ---
let cart = [];
let productsCache = [];

export async function initPOS() {
    productsCache = await fetchAll('products');
    const select = document.getElementById('pos-product-select');
    if(!select) return;
    
    select.innerHTML = '<option value="">Select Product...</option>';
    productsCache.forEach(p => {
        select.innerHTML += `<option value="${p.id}" data-price="${p.unit_price}" data-name="${p.name}">
            ${p.name} (Stock: ${p.stock}) - ${formatCurrency(p.unit_price)}
        </option>`;
    });
}

export function addToCart() {
    const select = document.getElementById('pos-product-select');
    const qtyInput = document.getElementById('pos-qty');
    const id = select.value;
    
    if(!id) return alert("Select a product first.");

    const product = productsCache.find(p => String(p.id) === String(id));
    const qty = parseInt(qtyInput.value);

    if(qty > product.stock) {
        return showCustomConfirm("Stock Alert", `Not enough stock! Only ${product.stock} available.`, "danger");
    }

    const existing = cart.find(item => item.id === id);
    if(existing) {
        if((existing.qty + qty) > product.stock) return alert("Exceeds stock level.");
        existing.qty += qty;
    } else {
        cart.push({ id, name: product.name, price: product.unit_price, qty });
    }

    renderCart();
    qtyInput.value = 1;
}

function renderCart() {
    const tbody = document.getElementById('cart-table-body');
    const totalEl = document.getElementById('pos-total');
    if(!tbody) return;

    tbody.innerHTML = '';
    let total = 0;

    cart.forEach((item, idx) => {
        const lineTotal = item.price * item.qty;
        total += lineTotal;
        tbody.innerHTML += `
            <tr class="border-b dark:border-gray-700">
                <td class="py-2 font-medium text-gray-800 dark:text-gray-200">${item.name}</td>
                <td class="py-2 text-center">${item.qty}</td>
                <td class="py-2 text-right">${formatCurrency(item.price)}</td>
                <td class="py-2 text-right font-bold">${formatCurrency(lineTotal)}</td>
                <td class="py-2 text-right">
                    <button onclick="window.removeCartItem(${idx})" class="text-red-500 hover:text-red-700 bg-red-100 p-1 rounded transition"><i class="fas fa-trash"></i></button>
                </td>
            </tr>`;
    });

    const serviceCost = parseFloat(document.getElementById('pos-service-cost')?.value || 0);
    totalEl.innerText = formatCurrency(total + serviceCost);
}

window.removeCartItem = (idx) => {
    cart.splice(idx, 1);
    renderCart();
};

// --- SALES REPORTING ENGINE ---
let allSales = [];

export async function openReportModal() {
    const modal = document.getElementById('sales-report-modal');
    modal.classList.remove('hidden');
    
    // Fetch fresh data
    const sb = getSupabase();
    const { data, error } = await sb.from('sales').select('*').order('date', { ascending: false });
    
    if(error) return alert("Error loading sales.");
    allSales = data;
    
    // Default: Show Today
    filterSales('today');
}

export function closeReportModal() {
    document.getElementById('sales-report-modal').classList.add('hidden');
}

export function filterSales(period) {
    const tbody = document.getElementById('report-table-body');
    const totalEl = document.getElementById('report-total-sales');
    const btns = document.querySelectorAll('.filter-btn');
    
    // Update active button state
    btns.forEach(b => {
        if(b.dataset.period === period) b.classList.add('bg-blue-600', 'text-white');
        else b.classList.remove('bg-blue-600', 'text-white');
        if(b.dataset.period !== period) b.classList.add('bg-gray-200', 'text-gray-700');
        else b.classList.remove('bg-gray-200', 'text-gray-700');
    });

    // Date Logic
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
        return true; // all
    });

    // Render Table
    tbody.innerHTML = '';
    let grandTotal = 0;

    if(filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-gray-500">No records found for this period.</td></tr>';
    } else {
        filtered.forEach(s => {
            grandTotal += Number(s.total_amount);
            tbody.innerHTML += `
                <tr class="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-slate-700">
                    <td class="p-3 text-sm text-gray-500">${new Date(s.date).toLocaleDateString()}</td>
                    <td class="p-3 font-mono text-xs text-blue-500">#${s.id}</td>
                    <td class="p-3 font-medium text-gray-800 dark:text-gray-200">${s.customer_name}</td>
                    <td class="p-3 text-right text-gray-500">${formatCurrency(s.service_cost)}</td>
                    <td class="p-3 text-right font-bold text-green-600">${formatCurrency(s.total_amount)}</td>
                    <td class="p-3 text-center">
                        <button onclick='window.reprintBill(${JSON.stringify(s)})' class="text-gray-400 hover:text-blue-500" title="Reprint"><i class="fas fa-print"></i></button>
                    </td>
                </tr>
            `;
        });
    }
    
    totalEl.innerText = formatCurrency(grandTotal);
}

// --- BILLING SYSTEM ---
window.reprintBill = (sale) => {
    // For reprint, we might not have items loaded, so we print a basic summary or fetch items if needed.
    // Ideally, fetch items for full detail. For now, let's print the summary we have.
    generateBill(sale, []); 
}

function generateBill(sale, items) {
    const printWindow = window.open('', '', 'width=400,height=600');
    
    let itemsHtml = '';
    if (items && items.length > 0) {
        itemsHtml = `
            <table style="width:100%; border-collapse:collapse; margin-bottom:10px; font-size:12px;">
                <tr style="border-bottom:1px dashed #000;">
                    <th style="text-align:left;">Item</th>
                    <th style="text-align:center;">Qty</th>
                    <th style="text-align:right;">Total</th>
                </tr>
                ${items.map(i => `
                <tr>
                    <td>${i.name}</td>
                    <td style="text-align:center;">${i.qty}</td>
                    <td style="text-align:right;">${(i.price * i.qty).toFixed(2)}</td>
                </tr>`).join('')}
            </table>`;
    } else {
        itemsHtml = '<p style="text-align:center; font-style:italic; margin: 10px 0; font-size:12px;">(Service / Summary Bill)</p>';
    }

    const html = `
        <html>
        <head>
            <title>Receipt #${sale.id}</title>
            <style>
                body { font-family: 'Courier New', monospace; padding: 20px; color: #000; }
                .center { text-align: center; }
                .right { text-align: right; }
                .line { border-top: 1px dashed #000; margin: 10px 0; }
                h2 { margin:0; font-size: 18px; }
                p { margin: 2px 0; font-size: 12px; }
            </style>
        </head>
        <body>
            <div class="center">
                <h2>CycleSense</h2>
                <p>Professional Workshop</p>
                <p>Tel: 075 633 9536</p>
            </div>
            <div class="line"></div>
            <p><strong>Date:</strong> ${new Date(sale.date).toLocaleString()}</p>
            <p><strong>Receipt:</strong> #${sale.id}</p>
            <p><strong>Customer:</strong> ${sale.customer_name}</p>
            <div class="line"></div>
            ${itemsHtml}
            <div class="line"></div>
            <div class="right">
                ${sale.service_cost > 0 ? `<p>Service Cost: ${parseFloat(sale.service_cost).toFixed(2)}</p>` : ''}
                <h3 style="margin-top:5px; font-size:16px;">TOTAL: ${parseFloat(sale.total_amount).toFixed(2)}</h3>
            </div>
            <div class="line"></div>
            <p class="center" style="font-size:10px;">Thank you! Ride Safe.</p>
        </body>
        </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
        printWindow.print();
    }, 500);
}

export async function processSale(e) {
    e.preventDefault();
    const sb = getSupabase();
    const form = new FormData(e.target);
    const serviceCost = parseFloat(form.get('service_cost') || 0);
    const partsTotal = cart.reduce((sum, i) => sum + (i.price * i.qty), 0);

    // Allow service only (cart empty but service > 0)
    if (cart.length === 0 && serviceCost <= 0) {
        return showCustomConfirm("Invalid Sale", "Please add items OR enter a service cost.", "danger");
    }

    // 1. Create Sale
    const { data: sale, error } = await sb.from('sales').insert({
        customer_name: form.get('customer_name') || 'Walk-in',
        phone: form.get('phone'),
        service_cost: serviceCost,
        total_amount: partsTotal + serviceCost,
        date: new Date().toISOString()
    }).select().single();

    if(error) return alert("Error: " + error.message);

    // 2. Add Items
    if (cart.length > 0) {
        const saleItems = cart.map(i => ({
            sale_id: sale.id,
            product_id: i.id,
            quantity: i.qty,
            price: i.price
        }));
        await sb.from('sale_items').insert(saleItems);

        // Deduct Stock
        for(let item of cart) {
            const p = productsCache.find(x => String(x.id) === String(item.id));
            if(p) await sb.from('products').update({ stock: p.stock - item.qty }).eq('id', item.id);
        }
    }

    // 3. Print
    generateBill(sale, cart);

    await showCustomConfirm("Success", "Sale Completed!", "success-green");
    
    // Cleanup
    cart = [];
    e.target.reset();
    document.getElementById('pos-total').innerText = "LKR 0.00";
    renderCart();
    initPOS();
}

// --- 3. REPAIRS ---
export async function loadRepairs() {
    const repairs = await fetchAll('repairs');
    const tbody = document.getElementById('repairs-table-body');
    if(!tbody) return;

    tbody.innerHTML = '';
    repairs.forEach(r => {
        const statusColors = { 'In Progress': 'bg-blue-100 text-blue-800', 'Completed': 'bg-green-100 text-green-800' };
        tbody.innerHTML += `
            <tr class="bg-white border-b dark:bg-slate-800 dark:border-gray-700">
                <td class="px-6 py-4 font-mono text-xs text-indigo-500">${r.repair_id}</td>
                <td class="px-6 py-4 font-medium dark:text-white">${r.customer_name}</td>
                <td class="px-6 py-4 text-gray-500">${r.phone}</td>
                <td class="px-6 py-4 font-bold text-gray-700 dark:text-gray-300">${formatCurrency(r.advance)}</td>
                <td class="px-6 py-4">${new Date(r.predicted_date).toLocaleDateString()}</td>
                <td class="px-6 py-4"><span class="${statusColors[r.status] || 'bg-gray-100'} text-xs font-bold px-2.5 py-0.5 rounded uppercase">${r.status}</span></td>
            </tr>`;
    });
}

export async function addRepair(e) {
    e.preventDefault();
    const sb = getSupabase();
    const form = new FormData(e.target);
    const { error } = await sb.from('repairs').insert({
        repair_id: 'REP-' + Date.now().toString().slice(-6),
        customer_name: form.get('customer_name'),
        phone: form.get('phone'),
        advance: Number(form.get('advance')),
        predicted_date: form.get('predicted_date'),
        status: 'In Progress'
    });

    if(error) alert(error.message);
    else {
        await showCustomConfirm("Ticket Created", "Repair job added.", "success-green");
        e.target.reset();
        loadRepairs();
    }
}

// --- 4. HR ---
export async function loadHR() {
    const workers = await fetchAll('workers');
    const list = document.getElementById('workers-list');
    if(!list) return;
    list.innerHTML = '';
    workers.forEach(w => {
        list.innerHTML += `<div class="p-4 bg-white dark:bg-slate-700 rounded-xl shadow-sm border border-gray-100 dark:border-gray-600 flex justify-between items-center transition hover:scale-[1.02]">
            <div><h4 class="font-bold text-gray-800 dark:text-white">${w.name}</h4><p class="text-xs text-gray-500">Staff</p></div>
            <span class="text-green-600 font-bold bg-green-50 dark:bg-green-900/30 px-3 py-1 rounded-lg">${formatCurrency(w.daily_salary)}/day</span>
        </div>`;
    });
}

export async function addWorker(e) {
    e.preventDefault();
    const sb = getSupabase();
    const form = new FormData(e.target);
    const { error } = await sb.from('workers').insert({ name: form.get('name'), daily_salary: Number(form.get('daily_salary')) });
    if(error) alert(error.message);
    else { await showCustomConfirm("Success", "Worker added.", "success-green"); e.target.reset(); loadHR(); }
}
