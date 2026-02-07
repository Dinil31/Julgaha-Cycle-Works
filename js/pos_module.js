// js/pos_module.js
import { getSupabase } from './config.js';
import { showCustomConfirm } from './ui.js';

// --- HELPERS ---
const formatCurrency = (val) => new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR' }).format(val);

async function fetchAll(table) {
    const sb = getSupabase();
    const { data, error } = await sb.from(table).select('*').order('id', { ascending: false });
    if (error) { console.error(error); return []; }
    return data;
}

// --- 1. INVENTORY MANAGEMENT ---
export async function loadInventory() {
    const products = await fetchAll('products');
    const tbody = document.getElementById('inventory-table-body');
    if(!tbody) return;
    
    tbody.innerHTML = '';
    products.forEach(p => {
        const isLow = p.stock < p.reorder_level;
        const row = `
            <tr class="bg-white border-b dark:bg-slate-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-slate-700 transition">
                <td class="px-6 py-4 font-medium text-gray-900 dark:text-white">${p.code}</td>
                <td class="px-6 py-4">${p.name}</td>
                <td class="px-6 py-4 ${isLow ? 'text-red-500 font-bold' : 'text-green-500'}">${p.stock}</td>
                <td class="px-6 py-4">${p.reorder_level}</td>
                <td class="px-6 py-4">${formatCurrency(p.unit_price)}</td>
                <td class="px-6 py-4">
                    <span class="${isLow ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'} text-xs font-medium px-2.5 py-0.5 rounded dark:bg-opacity-20">
                        ${isLow ? 'Reorder' : 'In Stock'}
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
        code: form.get('code'),
        name: form.get('name'),
        stock: Number(form.get('stock')),
        reorder_level: Number(form.get('reorder_level')),
        unit_price: Number(form.get('unit_price'))
    };

    const { error } = await sb.from('products').insert(payload);
    if(error) {
        alert("Error: " + error.message);
    } else {
        await showCustomConfirm("Success", "Product added successfully!", "success-green");
        e.target.reset();
        loadInventory();
    }
}

// --- 2. POS (POINT OF SALE) ---
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
    if(!id) return;

    const product = productsCache.find(p => String(p.id) === String(id));
    const qty = parseInt(qtyInput.value);

    if(qty > product.stock) {
        alert("Not enough stock!");
        return;
    }

    const existing = cart.find(item => item.id === id);
    if(existing) existing.qty += qty;
    else cart.push({ id, name: product.name, price: product.unit_price, qty });

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
                <td class="py-2 text-gray-800 dark:text-gray-200">${item.name}</td>
                <td class="py-2">${item.qty}</td>
                <td class="py-2">${formatCurrency(item.price)}</td>
                <td class="py-2">${formatCurrency(lineTotal)}</td>
                <td class="py-2 text-right">
                    <button onclick="window.removeCartItem(${idx})" class="text-red-500 hover:text-red-700"><i class="fas fa-trash"></i></button>
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

export async function processSale(e) {
    e.preventDefault();
    if(cart.length === 0) return alert("Cart is empty!");

    const sb = getSupabase();
    const form = new FormData(e.target);
    const serviceCost = parseFloat(form.get('service_cost') || 0);
    const partsTotal = cart.reduce((sum, i) => sum + (i.price * i.qty), 0);

    // 1. Create Sale Record
    const { data: sale, error } = await sb.from('sales').insert({
        customer_name: form.get('customer_name'),
        phone: form.get('phone'),
        service_cost: serviceCost,
        total_amount: partsTotal + serviceCost,
        date: new Date().toISOString()
    }).select().single();

    if(error) return alert("Sale Error: " + error.message);

    // 2. Add Items & Update Stock
    const saleItems = cart.map(i => ({
        sale_id: sale.id,
        product_id: i.id,
        quantity: i.qty,
        price: i.price
    }));
    await sb.from('sale_items').insert(saleItems);

    for(let item of cart) {
        const p = productsCache.find(x => String(x.id) === String(item.id));
        await sb.from('products').update({ stock: p.stock - item.qty }).eq('id', item.id);
    }

    await showCustomConfirm("Success", "Sale Completed!", "success-green");
    cart = [];
    e.target.reset();
    renderCart();
    initPOS(); // Refresh stock
}

// --- 3. REPAIRS ---
export async function loadRepairs() {
    const repairs = await fetchAll('repairs');
    const tbody = document.getElementById('repairs-table-body');
    if(!tbody) return;

    tbody.innerHTML = '';
    repairs.forEach(r => {
        const row = `
            <tr class="bg-white border-b dark:bg-slate-800 dark:border-gray-700">
                <td class="px-6 py-4 text-blue-500 font-mono text-xs">${r.repair_id}</td>
                <td class="px-6 py-4 font-medium dark:text-white">${r.customer_name}</td>
                <td class="px-6 py-4 text-gray-500">${r.phone}</td>
                <td class="px-6 py-4">${new Date(r.predicted_date).toLocaleDateString()}</td>
                <td class="px-6 py-4">
                    <span class="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded">${r.status}</span>
                </td>
            </tr>`;
        tbody.innerHTML += row;
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
        await showCustomConfirm("Success", "Repair Ticket Created", "success-green");
        e.target.reset();
        loadRepairs();
    }
}

// --- 4. HR & WORKERS ---
export async function loadHR() {
    const workers = await fetchAll('workers');
    const list = document.getElementById('workers-list');
    const select = document.getElementById('salary-worker-select');
    if(!list) return;

    list.innerHTML = '';
    select.innerHTML = '';
    
    workers.forEach(w => {
        list.innerHTML += `<div class="p-3 bg-gray-50 dark:bg-slate-700 rounded shadow-sm flex justify-between">
            <span class="font-bold text-gray-700 dark:text-gray-200">${w.name}</span>
            <span class="text-green-600">${formatCurrency(w.daily_salary)}/day</span>
        </div>`;
        select.innerHTML += `<option value="${w.id}" data-salary="${w.daily_salary}">${w.name}</option>`;
    });
}

export async function addWorker(e) {
    e.preventDefault();
    const sb = getSupabase();
    const form = new FormData(e.target);
    await sb.from('workers').insert({
        name: form.get('name'),
        daily_salary: Number(form.get('daily_salary'))
    });
    loadHR();
    e.target.reset();
}
