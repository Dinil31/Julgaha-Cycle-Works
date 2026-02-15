// js/pos_module.js
import { getSupabase } from './config.js';
import { showCustomConfirm } from './ui.js';

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
                    <span class="${isLow ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'} text-xs font-bold px-2.5 py-0.5 rounded-full">
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
                <td class="p-3 text-center"><input type="number" class="w-20 p-1 border rounded text-center" value="${suggested > 0 ? suggested : 10}"></td>
                <td class="p-3 text-center"><button onclick="document.getElementById('restock-row-${index}').remove()" class="text-red-400"><i class="fas fa-trash"></i></button></td>
            </tr>`;
    });
    document.getElementById('restock-modal').classList.remove('hidden');
}

window.printRestockFinal = () => {
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

// --- 2. POS & SALES ---
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
        tbody.innerHTML += `<tr><td class="p-2">${i.name}</td><td class="text-center">${i.qty}</td><td class
