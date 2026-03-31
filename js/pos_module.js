import { getSupabase } from './config.js';
import { showCustomConfirm } from './ui.js';

// ==========================================
// GLOBAL FORMATTERS & HELPERS
// ==========================================

const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-LK', { 
        style: 'currency', 
        currency: 'LKR' 
    }).format(val || 0);
};

async function fetchAll(table) {
    try {
        const sb = getSupabase();
        const { data, error } = await sb.from(table).select('*').order('id', { ascending: false });
        
        if (error) { 
            console.error(`Error fetching from ${table}:`, error.message); 
            return []; 
        }
        return data || [];
    } catch (err) {
        console.error("Database Connection Error:", err);
        return [];
    }
}


// ==========================================
// 1. CYCLE SHOWROOM SYSTEM (NEW)
// ==========================================

export async function loadShowroom() {
    try {
        const sb = getSupabase();
        const { data, error } = await sb.from('products')
            .select('*')
            .eq('item_type', 'Bicycle')
            .order('id', { ascending: false });
        
        const grid = document.getElementById('admin-showroom-grid');
        
        if (!grid) return;

        if (error) {
            grid.innerHTML = `<p class="text-red-500 font-bold p-4">Error loading showroom: ${error.message}</p>`;
            return;
        }

        let html = '';
        
        data.forEach(bike => {
            let badgeColor = '';
            
            if (bike.cycle_category === 'New') {
                badgeColor = 'bg-green-100 text-green-700 border-green-200';
            } else if (bike.cycle_category === 'Japanese Reconditioned') {
                badgeColor = 'bg-blue-100 text-blue-700 border-blue-200';
            } else {
                badgeColor = 'bg-gray-200 text-gray-700 border-gray-300';
            }

            let stockBadge = bike.stock > 0 
                ? `<span class="text-green-500 text-xs font-black"><i class="fas fa-check-circle"></i> In Stock (${bike.stock})</span>` 
                : `<span class="text-red-500 text-xs font-black"><i class="fas fa-times-circle"></i> Out of Stock</span>`;

            html += `
                <div class="bg-white dark:bg-slate-800 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col transition hover:shadow-lg">
                    <div class="h-48 bg-gray-200 relative group">
                        <img src="${bike.image_url || 'https://via.placeholder.com/400x300?text=No+Image'}" alt="${bike.name}" class="w-full h-full object-cover transition duration-300 group-hover:scale-105">
                        <div class="absolute top-3 left-3 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-white/50 shadow-sm ${badgeColor}">
                            ${bike.cycle_category}
                        </div>
                    </div>
                    <div class="p-5 flex flex-col flex-grow">
                        <div class="flex justify-between items-start mb-2">
                            <h3 class="font-black text-xl text-gray-800 dark:text-white leading-tight">${bike.name}</h3>
                            <span class="text-xs text-gray-400 font-mono mt-1 bg-gray-100 dark:bg-slate-700 px-2 py-1 rounded">${bike.code}</span>
                        </div>
                        <p class="text-sm text-gray-500 dark:text-gray-400 mb-4 flex-grow border-b dark:border-gray-700 pb-4 italic">
                            "${bike.specs || 'No specific details provided.'}"
                        </p>
                        <div class="flex justify-between items-center mb-5">
                            <div>${stockBadge}</div>
                            <div class="text-2xl font-black text-blue-600 dark:text-blue-400">
                                ${formatCurrency(bike.unit_price)}
                            </div>
                        </div>
                        <div class="flex gap-3 mt-auto">
                            <button onclick="window.posModule.deleteProduct('${bike.id}')" class="p-3 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/40 transition shadow-sm" title="Delete Bicycle">
                                <i class="fas fa-trash"></i>
                            </button>
                            <button onclick="window.posModule.sellBicycle('${bike.id}')" class="flex-grow bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black py-3 rounded-xl hover:from-blue-700 hover:to-indigo-700 transition flex items-center justify-center gap-2 shadow-md hover:shadow-lg transform hover:-translate-y-0.5">
                                <i class="fas fa-cart-arrow-down"></i> Sell Now
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });
        
        grid.innerHTML = html || `
            <div class="col-span-full text-center py-16 bg-gray-50 dark:bg-slate-800 rounded-2xl border border-dashed border-gray-300 dark:border-gray-600">
                <i class="fas fa-bicycle text-4xl text-gray-400 mb-3 block"></i>
                <p class="text-gray-500 font-bold uppercase tracking-widest text-sm">No bicycles currently in the showroom.</p>
            </div>
        `;
    } catch (err) {
        console.error("Error loading showroom:", err);
    }
}

export async function addBicycle(e) {
    e.preventDefault();
    const sb = getSupabase();
    const form = new FormData(e.target);
    
    const { error } = await sb.from('products').insert({
        item_type: 'Bicycle',
        code: form.get('code').toUpperCase(),
        name: form.get('name'),
        cycle_category: form.get('category'),
        specs: form.get('specs'),
        image_url: form.get('image_url'),
        stock: Number(form.get('stock')),
        reorder_level: 1, // Bicycles automatically trigger reorder alerts at 1 unit
        buying_price: Number(form.get('buying_price')),
        unit_price: Number(form.get('unit_price'))
    });

    if (error) {
        alert(error.message);
    } else {
        e.target.reset();
        document.getElementById('add-bicycle-modal').classList.add('hidden');
        await loadShowroom();
        showCustomConfirm("Success", "Bicycle has been added to the showroom inventory!", "success-green");
    }
}

export async function deleteProduct(id) {
    if(await showCustomConfirm("Delete Item?", "Are you sure you want to permanently remove this item from the database? This cannot be undone.", "danger")) {
        const sb = getSupabase();
        await sb.from('products').delete().eq('id', id);
        
        // Refresh both views in case it was a part or a bicycle
        await loadShowroom();
        await loadInventory();
    }
}

export function sellBicycle(id) {
    const sb = getSupabase();
    
    // Fetch directly from database to ensure accuracy and prevent out-of-stock sales
    sb.from('products').select('*').eq('id', id).single().then(({data: bike}) => {
        
        if (!bike) return;
        
        if (bike.stock <= 0) {
            return alert("This bicycle is currently out of stock!");
        }

        // Add to the POS Cart
        const existingItem = cart.find(i => i.id === id);
        
        if (existingItem) {
            existingItem.qty += 1;
        } else {
            cart.push({ 
                id: id, 
                name: bike.name, 
                price: bike.unit_price, 
                qty: 1 
            });
        }

        // --- AUTOMATED 1-DAY ASSEMBLY CHARGE LOGIC ---
        if (bike.cycle_category === 'New' || bike.cycle_category === 'Japanese Reconditioned') {
            const svcInput = document.getElementById('pos-service-cost');
            let currentSvc = parseFloat(svcInput.value || 0);
            
            // Automatically add 1,500 LKR for assembly/tuning
            svcInput.value = currentSvc + 1500; 
            
            showCustomConfirm(
                "Added to POS Cart", 
                `${bike.name} has been added.\n\nA standard 1-day Assembly & Tuning charge of 1,500 LKR has been automatically added to the service cost.`, 
                "confirm"
            );
        } else {
            // Old/Used bikes don't get the automatic assembly charge
            alert(`${bike.name} added to cart.`);
        }

        renderCart();
        
        // Jump the user automatically to the POS screen to finalize the sale
        window.handleNavClick('pos'); 
    });
}


// ==========================================
// 2. POS & BILLING SYSTEM (With Warranty)
// ==========================================
let cart = []; 
let inventoryData = [];

export async function initPOS() {
    try {
        inventoryData = await fetchAll('products'); 
        const select = document.getElementById('pos-product-select');
        
        if (select) { 
            select.innerHTML = '<option value="">Select Spare Part or Accessory...</option>'; 
            
            // Filter out Bicycles from the dropdown, only show Parts
            inventoryData.filter(p => p.item_type !== 'Bicycle').forEach(p => {
                select.innerHTML += `
                    <option value="${p.id}" data-price="${p.unit_price}" data-name="${p.name}">
                        ${p.name} (Stock: ${p.stock}) - ${formatCurrency(p.unit_price)}
                    </option>
                `;
            }); 
        }
    } catch (err) {
        console.error("POS Init Error:", err);
    }
}

export function addToCart() {
    const select = document.getElementById('pos-product-select'); 
    const qtyInput = document.getElementById('pos-qty');
    
    const id = select.value; 
    
    if (!id) {
        return alert("Please select a product first.");
    }
    
    const option = select.options[select.selectedIndex];
    const name = option.getAttribute('data-name');
    const price = parseFloat(option.getAttribute('data-price'));
    const p = inventoryData.find(x => String(x.id) === String(id)); 
    const qty = parseInt(qtyInput.value);
    
    if (qty <= 0 || isNaN(qty)) {
        return alert("Quantity must be greater than 0.");
    }

    if (qty > p.stock) {
        return alert(`Low Stock Warning! Only ${p.stock} units are currently available.`);
    }
    
    const existingItem = cart.find(i => i.id === id); 
    
    if (existingItem) {
        existingItem.qty += qty; 
    } else {
        cart.push({ 
            id: id, 
            name: name, 
            price: price, 
            qty: qty 
        });
    }
    
    renderCart(); 
    qtyInput.value = 1;
}

export function renderCart() {
    const tbody = document.getElementById('cart-table-body'); 
    const totalEl = document.getElementById('pos-total');
    
    if (!tbody) {
        return; 
    }
    
    let htmlContent = ''; 
    let total = 0;
    
    cart.forEach((item, idx) => { 
        total += item.price * item.qty; 
        
        htmlContent += `
            <tr class="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-slate-800 transition">
                <td class="p-3 font-bold dark:text-white">
                    ${item.name}
                </td>
                <td align="center" class="p-3 font-black text-blue-600 dark:text-blue-400">
                    ${item.qty}
                </td>
                <td align="right" class="p-3 text-green-600 font-bold">
                    ${formatCurrency(item.price * item.qty)}
                </td>
                <td align="center" class="p-3">
                    <button type="button" onclick="window.posModule.removeCartItem(${idx})" class="text-red-500 hover:text-white hover:bg-red-500 dark:bg-red-900/20 p-2 rounded-lg transition" title="Remove Item">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `; 
    });
    
    tbody.innerHTML = htmlContent;
    
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

    // Open print window immediately to bypass pop-up blockers
    const w = window.open('', '', 'width=400,height=600');
    if (w) {
        w.document.write('<p style="font-family:sans-serif; text-align:center; margin-top:50px;">Processing Bill to Cloud...</p>');
    }

    const receiptNo = "POS-" + Date.now().toString().slice(-6) + Math.floor(Math.random() * 100);

    const { data: sale, error } = await sb.from('sales').insert({ 
        receipt_no: receiptNo, 
        customer_name: form.get('customer_name') || 'Walk-in Customer', 
        phone: form.get('phone'), 
        service_cost: svc, 
        total_amount: total, 
        date: new Date().toISOString()
    }).select().single();

    if (error) {
        if(w) w.close();
        return alert("Error saving sale to database: " + error.message);
    }

    const itemsForBill = [...cart];

    if (cart.length > 0) {
        const itemsToInsert = cart.map(i => ({ 
            sale_id: sale.id, 
            product_id: i.id, 
            quantity: i.qty, 
            price: i.price 
        }));
        
        await sb.from('sale_items').insert(itemsToInsert);
        
        // Deduct inventory stock
        for (let item of cart) { 
            const p = inventoryData.find(x => String(x.id) === String(item.id)); 
            if (p) {
                await sb.from('products').update({ stock: p.stock - item.qty }).eq('id', item.id); 
            }
        }
    }
    
    // Capture the Serial Number for Warranty processing
    const serialNumber = form.get('serial_number');
    
    // Reset the UI
    cart = []; 
    e.target.reset(); 
    renderCart(); 
    
    // Generate the physical receipt
    if (w) {
        populateBill(w, sale, itemsForBill, serialNumber);
    }
    
    // Reload all data views
    await initPOS(); 
    await loadInventory(); 
    await loadShowroom();
    
    showCustomConfirm("Success", "Transaction Processed & Bill Generated!", "success-green");
}

function populateBill(w, sale, items, serialNumber = null) {
    let itemsHtml = '';
    
    if (items && items.length > 0) {
        itemsHtml = items.map(i => `
            <tr>
                <td style="padding: 5px 0;">${i.name}</td>
                <td align="center" style="padding: 5px 0;">${i.qty}</td>
                <td align="right" style="padding: 5px 0;">${(i.price * i.qty).toFixed(2)}</td>
            </tr>
        `).join('');
    } else {
        itemsHtml = `
            <tr>
                <td colspan="3" align="center" style="font-style:italic; padding: 10px 0; color: #666;">
                    Labor / Service Only
                </td>
            </tr>
        `;
    }

    // --- AUTOMATED WARRANTY REGISTRATION LOGIC ---
    let warrantyHtml = '';
    
    if (serialNumber && serialNumber.trim() !== '') {
        const warrantyDate = new Date();
        warrantyDate.setFullYear(warrantyDate.getFullYear() + 5); // Add 5 Years
        
        warrantyHtml = `
            <div style="margin-top: 20px; padding: 15px; border: 2px dashed #333; text-align: center; background-color: #f9f9f9;">
                <h3 style="margin: 0 0 5px 0; text-transform: uppercase; font-family: sans-serif;">Official Warranty</h3>
                <p style="margin: 3px 0; font-size: 14px;">Frame S/N: <b>${serialNumber}</b></p>
                <p style="margin: 5px 0; font-size: 14px; color: #059669; font-weight: bold;">Valid Until: ${warrantyDate.toLocaleDateString()}</p>
                <p style="margin: 5px 0 0 0; font-size: 10px; color: #666;">Please retain this receipt for any warranty claims.</p>
            </div>
        `;
    }
    // ---------------------------------------------

    setTimeout(() => {
        w.document.open();
        w.document.write(`
            <html>
            <head>
                <title>Receipt - ${sale.receipt_no}</title>
                <style>
                    body { 
                        font-family: 'Courier New', Courier, monospace; 
                        padding: 20px; 
                        font-size: 14px; 
                        color: #000; 
                        max-width: 300px;
                        margin: 0 auto;
                    }
                    h2, p { margin: 0; padding: 2px 0; }
                    hr { border-top: 1px dashed #000; border-bottom: none; margin: 15px 0; }
                    table { width: 100%; border-collapse: collapse; margin: 10px 0; }
                    th { text-align: left; border-bottom: 1px solid #000; padding-bottom: 5px; text-transform: uppercase; font-size: 12px;}
                    td { font-size: 13px; }
                </style>
            </head>
            <body>
                <center>
                    <h2 style="font-family: sans-serif; font-black;">CycleSense</h2>
                    <p style="font-size: 12px;">Tel: 075 633 9536</p>
                    <p style="font-size: 12px;">Galle, Sri Lanka</p>
                    <p style="margin-top: 5px; font-weight: bold;">Receipt: ${sale.receipt_no}</p>
                </center>
                
                <hr>
                <p style="font-size: 12px;">Date: ${new Date(sale.date).toLocaleString()}</p>
                <p style="font-size: 12px;">Cust: ${sale.customer_name}</p>
                <hr>
                
                <table>
                    <tr>
                        <th>Item</th>
                        <th style="text-align:center;">Qty</th>
                        <th style="text-align:right;">Amount</th>
                    </tr>
                    ${itemsHtml}
                </table>
                
                <hr>
                <div style="text-align: right;">
                    ${sale.service_cost > 0 ? `<p style="font-size: 13px;">Labor/Service: ${sale.service_cost.toFixed(2)}</p>` : ''}
                    <h2 style="margin-top: 10px; font-family: sans-serif;">TOTAL: ${sale.total_amount.toFixed(2)}</h2>
                </div>
                
                ${warrantyHtml}
                
                <hr>
                <center>
                    <p style="font-size:11px; font-weight: bold;">Thank you for riding with us!</p>
                    <p style="font-size:9px; color: #666; margin-top: 2px;">Powered by CycleSense Cloud ERP</p>
                </center>
                
                <script>window.print();</script>
            </body>
            </html>
        `);
        w.document.close();
    }, 100);
}


// ==========================================
// 3. INVENTORY SYSTEM
// ==========================================

export async function loadInventory() {
    try {
        inventoryData = await fetchAll('products');
        const tbody = document.getElementById('inventory-table-body');
        
        if (!tbody) return; 
        
        let htmlContent = '';
        
        // Filter out Bicycles so they only appear in the Showroom tab
        inventoryData.filter(p => p.item_type !== 'Bicycle').forEach(p => {
            const isLow = p.stock <= p.reorder_level;
            
            let stockClass = 'text-green-500 font-bold';
            let badgeClass = 'bg-green-100 text-green-800';
            let badgeText = 'In Stock';
            
            if (isLow) {
                stockClass = 'text-red-500 animate-pulse font-black text-lg';
                badgeClass = 'bg-red-100 text-red-800';
                badgeText = 'Low Stock Alert';
            }
            
            htmlContent += `
                <tr class="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition">
                    <td class="p-4 font-mono text-sm text-gray-500">
                        ${p.code}
                    </td>
                    <td class="p-4 font-bold dark:text-white">
                        ${p.name}
                        ${p.ai_class ? `<br><span class="mt-1 inline-block text-[9px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full border border-purple-200 uppercase tracking-widest">${p.ai_class}</span>` : ''}
                    </td>
                    <td class="p-4">
                        <div class="flex items-center gap-3">
                            <span class="${stockClass}">
                                ${p.stock}
                            </span>
                            <button onclick="window.posModule.promptAddStock('${p.id}')" class="text-blue-600 bg-blue-100 hover:bg-blue-200 dark:bg-slate-800 dark:text-blue-400 dark:hover:bg-slate-700 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition shadow-sm">
                                <i class="fas fa-plus"></i> Add
                            </button>
                        </div>
                    </td>
                    <td class="p-4 text-gray-500 font-bold">
                        ${p.reorder_level}
                    </td>
                    <td class="p-4 dark:text-gray-300">
                        <div class="text-xs text-gray-400 font-bold">
                            Buy: ${formatCurrency(p.buying_price)}
                        </div>
                        <div class="font-bold text-green-600">
                            Sell: ${formatCurrency(p.unit_price)}
                        </div>
                    </td>
                    <td class="p-4">
                        <span class="px-2 py-1 text-[10px] font-black uppercase tracking-widest rounded-full ${badgeClass}">
                            ${badgeText}
                        </span>
                    </td>
                </tr>
            `;
        });
        
        tbody.innerHTML = htmlContent;
        
    } catch (error) {
        console.error("Error rendering inventory:", error);
    }
}

export async function addProduct(e) {
    e.preventDefault(); 
    
    const form = new FormData(e.target);
    const sb = getSupabase();
    
    const { error } = await sb.from('products').insert({ 
        item_type: 'Part', // Explicitly mark as spare part
        code: form.get('code').toUpperCase(), 
        name: form.get('name'), 
        stock: Number(form.get('stock')), 
        reorder_level: Number(form.get('reorder_level')), 
        buying_price: Number(form.get('buying_price')), 
        unit_price: Number(form.get('unit_price')) 
    });
    
    if (error) {
        alert(error.message); 
    } else {
        e.target.reset(); 
        await loadInventory(); 
        showCustomConfirm("Success", "New Spare Part Added to Inventory", "success-green"); 
    }
}

export function promptAddStock(id) {
    const p = inventoryData.find(x => String(x.id) === String(id));
    if (!p) return;
    
    document.getElementById('qr-id').value = p.id;
    document.getElementById('qr-name').innerText = p.name;
    document.getElementById('qr-current').innerText = p.stock;
    document.getElementById('qr-add-qty').value = '';
    document.getElementById('qr-buy-price').value = p.buying_price || 0;
    document.getElementById('qr-sell-price').value = p.unit_price || 0;
    
    document.getElementById('quick-restock-modal').classList.remove('hidden');
}

export async function confirmQuickRestock(e) {
    e.preventDefault();
    
    const form = new FormData(e.target);
    const id = form.get('id');
    const addQty = parseInt(form.get('add_qty'));
    const newBuy = parseFloat(form.get('buying_price'));
    const newSell = parseFloat(form.get('selling_price'));

    if (!addQty || addQty <= 0 || isNaN(addQty)) {
        return alert("Please enter a valid positive quantity.");
    }

    const sb = getSupabase();
    
    const { data: p, error: fetchError } = await sb.from('products').select('stock').eq('id', id).single();
    
    if (fetchError) {
        return alert("Error checking current stock: " + fetchError.message);
    }
    
    const newStock = (p ? p.stock : 0) + addQty;

    const { error: updateError } = await sb.from('products').update({ 
        stock: newStock,
        buying_price: newBuy,
        unit_price: newSell
    }).eq('id', id);
    
    if (updateError) {
        alert("Error updating stock: " + updateError.message);
    } else {
        document.getElementById('quick-restock-modal').classList.add('hidden');
        await loadInventory();
        showCustomConfirm("Stock Updated", `Added ${addQty} units. Prices updated.`, "success-green");
    }
}

export async function generateRestockPDF() {
    const sb = getSupabase();
    const { data } = await sb.from('products').select('*');
    
    // Only generate restock list for Parts, not Bicycles
    const lowStockItems = data.filter(p => p.stock <= p.reorder_level && p.item_type !== 'Bicycle');
    
    if (lowStockItems.length === 0) {
        return showCustomConfirm("Inventory Check", "All spare parts have sufficient stock levels. No supplier ordering needed.", "confirm");
    }
    
    const tbody = document.getElementById('restock-table-body'); 
    let htmlContent = '';
    
    lowStockItems.forEach((p, index) => {
        const suggestedOrder = (p.reorder_level * 3) - p.stock;
        const defaultQty = suggestedOrder > 0 ? suggestedOrder : 10;
        
        htmlContent += `
            <tr id="restock-row-${index}" class="border-b dark:border-gray-700">
                <td class="p-3 font-mono text-xs text-gray-500">${p.code}</td>
                <td class="p-3 font-bold dark:text-white">${p.name}</td>
                <td class="p-3 text-center text-red-500 font-bold">${p.stock}</td>
                <td class="p-3 text-center text-gray-500">${p.reorder_level}</td>
                <td class="p-3 text-center">
                    <input type="number" min="1" oninput="this.value = Math.abs(this.value)" class="w-20 border-2 border-blue-200 rounded-lg p-1 text-center dark:bg-slate-700 dark:text-white font-black text-blue-600 focus:outline-none focus:border-blue-500" value="${defaultQty}">
                </td>
                <td class="p-3 text-center">
                    <button onclick="document.getElementById('restock-row-${index}').remove()" class="text-red-400 hover:text-red-600 transition bg-red-50 dark:bg-red-900/20 p-2 rounded-lg">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    });
    
    tbody.innerHTML = htmlContent;
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
                <td style="padding:10px; border:1px solid #ddd; font-family: monospace;">
                    ${cols[0].innerText}
                </td>
                <td style="padding:10px; border:1px solid #ddd; font-weight: bold;">
                    ${cols[1].innerText}
                </td>
                <td style="text-align:center; padding:10px; border:1px solid #ddd; color: red;">
                    ${cols[2].innerText}
                </td>
                <td style="text-align:center; font-weight:bold; padding:10px; border:1px solid #ddd; font-size: 16px;">
                    ${orderQty}
                </td>
                <td style="border:1px solid #ddd; width:60px;"></td>
            </tr>
        `;
    });

    const printWindow = window.open('', '', 'width=800,height=600');
    
    if (printWindow) {
        setTimeout(() => {
            printWindow.document.open();
            printWindow.document.write(`
                <html>
                <head>
                    <title>Restock Order List</title>
                    <style>
                        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; } 
                        table { width: 100%; border-collapse: collapse; margin-top: 20px; } 
                        th { background: #f4f4f4; padding: 12px; border: 1px solid #ddd; text-align: left; text-transform: uppercase; font-size: 12px; color: #555; }
                    </style>
                </head>
                <body>
                    <h2 style="margin-bottom: 5px;">📦 CycleSense Inventory Order</h2>
                    <p style="margin-top: 0; color: #666;">Generated on: ${new Date().toLocaleString()}</p>
                    <table>
                        <tr>
                            <th>Item Code</th>
                            <th>Product Description</th>
                            <th style="text-align:center;">Current Stock</th>
                            <th style="text-align:center;">Order Qty</th>
                            <th>Supplier Check</th>
                        </tr>
                        ${printRows}
                    </table>
                    <script>window.print();</script>
                </body>
                </html>
            `);
            printWindow.document.close();
        }, 100);
    }
}


// ==========================================
// 4. REPORTS & SALES TRACKING
// ==========================================
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
    
    if (!t) {
        return; 
    }
    
    let htmlContent = ''; 
    let totalRevenue = 0; 
    
    const now = new Date(); 
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfDay); startOfWeek.setDate(startOfDay.getDate() - startOfDay.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const filtered = allSales.filter(s => {
        const d = new Date(s.date);
        if (period === 'today') { return d >= startOfDay; }
        if (period === 'week') { return d >= startOfWeek; }
        if (period === 'month') { return d >= startOfMonth; }
        if (period === 'year') { return d >= startOfYear; }
        return true;
    });

    filtered.forEach(s => {
        totalRevenue += Number(s.total_amount); 
        
        htmlContent += `
            <tr class="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-slate-800 transition">
                <td class="p-3">
                    ${new Date(s.date).toLocaleDateString()}
                </td>
                <td class="p-3 font-mono text-blue-500 dark:text-blue-400 font-bold">
                    ${s.receipt_no || s.id}
                </td>
                <td class="p-3 font-bold dark:text-white">
                    ${s.customer_name}
                </td>
                <td class="p-3 text-right font-black text-green-600">
                    ${formatCurrency(s.total_amount)}
                </td>
                <td class="p-3 text-center flex justify-center gap-2">
                    <button type="button" onclick="window.posModule.reprintSaleBill('${s.id}')" class="text-blue-500 hover:text-blue-700 bg-blue-50 dark:bg-blue-900/20 p-2 rounded-lg transition" title="View/Print Bill">
                        <i class="fas fa-receipt"></i>
                    </button>
                    <button type="button" onclick="window.posModule.deleteSale('${s.id}')" class="text-red-500 hover:text-red-700 bg-red-50 dark:bg-red-900/20 p-2 rounded-lg transition" title="Delete Record">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    });
    
    t.innerHTML = htmlContent;
    document.getElementById('report-total-sales').innerText = formatCurrency(totalRevenue);
}

export async function reprintSaleBill(saleId) {
    const w = window.open('', '', 'width=400,height=600');
    if(w) w.document.write('<p style="font-family:sans-serif; text-align:center; margin-top:50px;">Loading Bill Data from Cloud...</p>');

    const sb = getSupabase();
    
    const { data: sale } = await sb.from('sales').select('*').eq('id', saleId).single();
    
    if (!sale) {
        if(w) w.close();
        return alert("Sale record not found.");
    }

    const { data: items } = await sb.from('sale_items').select('*, products(name)').eq('sale_id', saleId);
    
    const formattedItems = (items || []).map(i => ({
        name: i.products ? i.products.name : 'Unknown Item',
        qty: i.quantity,
        price: i.price
    }));

    if (w) populateBill(w, sale, formattedItems);
}

export async function deleteSale(id) { 
    if (await showCustomConfirm("Delete Sales Record?", "This will remove the sale permanently and restore the inventory stock.", "danger")) { 
        const sb = getSupabase();
        
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
        
        await openReportModal(); 
        await loadInventory(); 
        await loadShowroom();
    } 
}


// ==========================================
// 5. REPAIRS WORKSHOP SYSTEM
// ==========================================
let repairsData = []; 
let repairCart = []; 
let currentRepairId = null; 

export async function loadRepairs() { 
    try {
        const sb = getSupabase();
        const { data } = await sb.from('repairs').select('*').order('id', { ascending: false }); 
        
        repairsData = data || []; 
        
        const today = new Date().toISOString().split('T')[0];
        const dateInput = document.querySelector('input[name="predicted_date"]');
        
        if (dateInput) {
            dateInput.setAttribute('min', today);
        }
        
        filterRepairs(); 
    } catch (err) {
        console.error("Error loading repairs:", err);
    }
}

export function filterRepairs() {
    const filter = document.getElementById('repair-filter')?.value || 'all'; 
    const tbody = document.getElementById('repairs-table-body'); 
    
    if (!tbody) return; 
    
    const filtered = repairsData.filter(r => {
        if (filter === 'pending') { 
            return r.status === 'Pending' || r.status === 'Under Repair'; 
        }
        if (filter === 'completed') { 
            return r.status === 'Completed'; 
        }
        if (filter === 'collected') { 
            return r.status === 'Collected'; 
        }
        return true;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center py-8 text-gray-500 font-bold uppercase tracking-widest bg-gray-50 dark:bg-slate-800/50">
                    <i class="fas fa-tools text-2xl mb-2 block text-gray-400"></i>
                    No repair tickets found in this category.
                </td>
            </tr>
        `;
        return;
    }

    let htmlContent = '';

    filtered.forEach(r => {
        let statusHtml = ''; 
        let rowClass = '';
        let actionsHtml = '';

        if (r.status === 'Pending') {
            rowClass = 'bg-red-50 dark:bg-red-900/10 border-l-4 border-red-500 animate-pulse';
            statusHtml = `
                <button type="button" onclick="window.posModule.startRepair('${r.id}')" class="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1.5 rounded-lg text-[10px] uppercase font-black tracking-widest shadow-md transition w-full">
                    Start Repair
                </button>
            `;
            actionsHtml = `
                <button type="button" onclick="window.posModule.editRepair('${r.id}')" class="text-blue-500 hover:text-blue-700 bg-blue-50 dark:bg-slate-800 p-2 rounded-lg transition" title="Edit Ticket">
                    <i class="fas fa-edit"></i>
                </button>
                <button type="button" onclick="window.posModule.printRepairTicket('${r.id}')" class="text-gray-500 hover:text-gray-700 bg-gray-200 dark:bg-slate-700 p-2 rounded-lg transition" title="Print Ticket">
                    <i class="fas fa-print"></i>
                </button>
                <button type="button" onclick="window.posModule.deleteRepair('${r.id}')" class="text-red-400 hover:text-red-600 bg-red-50 dark:bg-red-900/20 p-2 rounded-lg transition" title="Delete Ticket">
                    <i class="fas fa-trash"></i>
                </button>
            `;
        } 
        else if (r.status === 'Under Repair' || r.status === 'In Progress') {
            rowClass = 'bg-yellow-50 dark:bg-yellow-900/10 border-l-4 border-yellow-500';
            statusHtml = `
                <button type="button" onclick="window.posModule.openCompleteRepairModal('${r.id}')" class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-[10px] uppercase font-black tracking-widest shadow-md transition w-full">
                    Finish & Bill
                </button>
            `;
            actionsHtml = `
                <button type="button" onclick="window.posModule.editRepair('${r.id}')" class="text-blue-500 hover:text-blue-700 bg-blue-50 dark:bg-slate-800 p-2 rounded-lg transition" title="Edit Ticket">
                    <i class="fas fa-edit"></i>
                </button>
                <button type="button" onclick="window.posModule.printRepairTicket('${r.id}')" class="text-gray-500 hover:text-gray-700 bg-gray-200 dark:bg-slate-700 p-2 rounded-lg transition" title="Print Ticket">
                    <i class="fas fa-print"></i>
                </button>
                <button type="button" onclick="window.posModule.deleteRepair('${r.id}')" class="text-red-400 hover:text-red-600 bg-red-50 dark:bg-red-900/20 p-2 rounded-lg transition" title="Delete Ticket">
                    <i class="fas fa-trash"></i>
                </button>
            `;
        } 
        else if (r.status === 'Completed') {
            rowClass = 'bg-blue-50 dark:bg-blue-900/10 border-l-4 border-blue-500';
            statusHtml = `
                <button type="button" onclick="window.posModule.markAsCollected('${r.id}')" class="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-[10px] uppercase font-black tracking-widest shadow-md transition w-full flex items-center justify-center gap-1">
                    <i class="fas fa-hand-holding-usd"></i> Collect & Pay
                </button>
            `;
            actionsHtml = `
                <button type="button" onclick="window.posModule.reprintFinalBill('${r.id}')" class="text-white bg-gray-800 hover:bg-black p-2 rounded-lg transition text-xs font-bold w-full flex items-center justify-center gap-1">
                    <i class="fas fa-receipt"></i> Print Bill
                </button>
            `;
        }
        else if (r.status === 'Collected') {
            rowClass = 'bg-white dark:bg-darkcard border-l-4 border-green-500 opacity-60 hover:opacity-100 transition duration-300';
            statusHtml = `
                <span class="bg-green-100 text-green-800 px-3 py-1.5 rounded-full text-[10px] uppercase font-black tracking-widest border border-green-200 block text-center">
                    <i class="fas fa-check-circle"></i> Collected
                </span>
            `;
            actionsHtml = `
                <button type="button" onclick="window.posModule.reprintFinalBill('${r.id}')" class="text-white bg-gray-800 hover:bg-black p-2 rounded-lg transition text-xs font-bold w-full flex items-center justify-center gap-1">
                    <i class="fas fa-receipt"></i> Print Bill
                </button>
            `;
        }

        htmlContent += `
            <tr class="${rowClass} border-b dark:border-gray-700 transition">
                <td class="p-4 font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">${r.repair_id}</td>
                <td class="p-4 font-bold text-gray-800 dark:text-gray-200">${r.customer_name}</td>
                <td class="p-4 text-sm text-gray-600 dark:text-gray-400 font-bold">${r.phone}</td>
                <td class="p-4 font-bold text-green-600">${formatCurrency(r.advance)}</td>
                <td class="p-4 text-sm text-gray-600 dark:text-gray-400 font-bold">${new Date(r.predicted_date).toLocaleDateString()}</td>
                <td class="p-4 align-middle">${statusHtml}</td>
                <td class="p-4 text-center flex gap-1 justify-center align-middle">${actionsHtml}</td>
            </tr>
        `;
    });
    
    tbody.innerHTML = htmlContent;
}

export async function startRepair(id) {
    const sb = getSupabase(); 
    const { error } = await sb.from('repairs').update({ status: 'Under Repair' }).eq('id', id);
    
    if (error) {
        alert("Error starting repair: " + error.message); 
    } else {
        await loadRepairs();
    }
}

export async function markAsCollected(id) {
    if (await showCustomConfirm("Collect & Pay", "Confirm the customer has paid the remaining balance and collected the bicycle.", "confirm")) {
        const sb = getSupabase();
        const { error } = await sb.from('repairs').update({ status: 'Collected' }).eq('id', id);
        
        if (error) {
            alert("Database Error: " + error.message);
        } else {
            await loadRepairs();
        }
    }
}

export async function deleteRepair(id) { 
    if (await showCustomConfirm("Delete Ticket?", "Are you sure you want to permanently delete this repair ticket?", "danger")) { 
        const sb = getSupabase();
        await sb.from('repairs').delete().eq('id', id); 
        await loadRepairs(); 
    } 
}

export async function addRepair(e) { 
    e.preventDefault(); 
    
    const w = window.open('', '', 'width=400,height=600');
    if (w) w.document.write('<p style="font-family:sans-serif; text-align:center; margin-top:50px;">Generating Ticket...</p>');

    const form = new FormData(e.target); 
    const sb = getSupabase();
    const repairId = 'REP-' + Math.floor(100000 + Math.random() * 900000);
    
    const { data, error } = await sb.from('repairs').insert({ 
        repair_id: repairId, 
        customer_name: form.get('customer_name'), 
        phone: form.get('phone'), 
        advance: Number(form.get('advance')), 
        predicted_date: form.get('predicted_date'), 
        status: 'Pending'
    }).select().single(); 
    
    if (error) {
        if (w) w.close();
        alert(error.message);
    } else {
        e.target.reset(); 
        
        if (w) populateRepairTicket(w, data);
        
        await loadRepairs(); 
        showCustomConfirm("Success", "Repair Ticket Generated", "success-green");
    }
}

export function editRepair(id) { 
    const r = repairsData.find(x => String(x.id) === String(id));
    if (!r) return;
    
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
    const sb = getSupabase();
    
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
        await loadRepairs(); 
        showCustomConfirm("Updated", "Repair details updated successfully.", "success-green");
    }
}

export async function openCompleteRepairModal(id) {
    try {
        currentRepairId = id; 
        repairCart = []; 
        document.getElementById('rep-labor').value = ''; 
        
        const sb = getSupabase();
        
        const { data: r, error } = await sb.from('repairs').select('*').eq('id', id).single();
        
        if (error) {
            throw error;
        }
        
        document.getElementById('rep-modal-customer').innerText = r.customer_name; 
        document.getElementById('rep-modal-adv').innerText = formatCurrency(r.advance);
        document.getElementById('repair-finalize-modal').classList.remove('hidden'); 
        
        const select = document.getElementById('rep-part-select'); 
        select.innerHTML = '<option value="">Select Replacement Part...</option>';
        
        const prods = await fetchAll('products'); 
        
        // Filter out Bicycles, only allow parts to be used in repairs
        prods.filter(p => p.item_type !== 'Bicycle').forEach(p => { 
            select.innerHTML += `
                <option value="${p.id}" data-price="${p.unit_price}" data-name="${p.name}">
                    ${p.name} - ${formatCurrency(p.unit_price)}
                </option>
            `; 
        });
        
        recalcRepairTotal();
    } catch (err) { 
        alert("Error loading ticket data: " + err.message); 
    }
}

export function addRepairPart() { 
    const select = document.getElementById('rep-part-select'); 
    const id = select.value; 
    const qtyInput = document.getElementById('rep-part-qty').value;
    
    if (!id || parseInt(qtyInput) <= 0 || isNaN(qtyInput)) {
        return alert("Please enter a valid positive quantity."); 
    }
    
    const option = select.options[select.selectedIndex];
    
    repairCart.push({ 
        id: id, 
        name: option.getAttribute('data-name'), 
        price: parseFloat(option.getAttribute('data-price')), 
        qty: parseInt(qtyInput) 
    }); 
    
    recalcRepairTotal(); 
}

export function recalcRepairTotal() {
    const tbody = document.getElementById('rep-parts-body'); 
    
    tbody.innerHTML = ''; 
    let totalParts = 0; 
    
    repairCart.forEach(item => { 
        totalParts += item.price * item.qty; 
        
        tbody.innerHTML += `
            <tr class="border-b dark:border-gray-600">
                <td class="p-2 font-bold">${item.name}</td>
                <td class="p-2 text-center">${item.qty}</td>
                <td class="p-2 text-right text-green-500 font-bold">${formatCurrency(item.price * item.qty)}</td>
            </tr>
        `; 
    }); 
    
    const advStr = document.getElementById('rep-modal-adv').innerText.replace(/[^\d.]/g, '');
    const advanceAmount = parseFloat(advStr) || 0;
    const laborCost = parseFloat(document.getElementById('rep-labor').value || 0);
    
    const balanceDue = (totalParts + laborCost) - advanceAmount;
    
    document.getElementById('rep-total-due').innerText = formatCurrency(balanceDue); 
}

export async function finalizeRepair() { 
    const w = window.open('', '', 'width=400,height=600');
    if (w) w.document.write('<p style="font-family:sans-serif; text-align:center; margin-top:50px;">Processing Final Bill to Cloud...</p>');

    const sb = getSupabase();
    const labor = parseFloat(document.getElementById('rep-labor').value || 0); 
    
    const { data: repair } = await sb.from('repairs').select('*').eq('id', currentRepairId).single(); 
    
    const partsTotal = repairCart.reduce((sum, item) => sum + (item.price * item.qty), 0); 
    const finalTotalAmount = partsTotal + labor; 
    const balanceDue = finalTotalAmount - repair.advance;
    
    const receiptNo = "REP-" + Date.now().toString().slice(-8);

    const { data: sale, error: saleError } = await sb.from('sales').insert({ 
        receipt_no: receiptNo, 
        customer_name: repair.customer_name + " (Repair Checkout)", 
        phone: repair.phone, 
        service_cost: labor, 
        total_amount: finalTotalAmount, 
        date: new Date().toISOString() 
    }).select().single();
    
    if (saleError) {
        if (w) w.close();
        return alert("Error saving bill to database: " + saleError.message);
    }
    
    const partsForBill = [...repairCart];

    if (repairCart.length > 0) {
        const itemsToInsert = repairCart.map(i => ({ 
            sale_id: sale.id, 
            product_id: i.id, 
            quantity: i.qty, 
            price: i.price 
        }));
        
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
        balance_due: balanceDue,
        parts_used: JSON.stringify(partsForBill)
    }).eq('id', currentRepairId); 
    
    document.getElementById('repair-finalize-modal').classList.add('hidden'); 
    
    const { data: freshRepair } = await sb.from('repairs').select('*').eq('id', currentRepairId).single();
    
    if (w) populateFinalBill(w, freshRepair);
    
    await loadRepairs(); 
    await loadInventory(); // Reload inventory since parts were deducted
    
    showCustomConfirm("Completed", "Repair finished and billed successfully.", "success-green"); 
}

export function printRepairTicket(id) {
    const repair = repairsData.find(x => String(x.id) === String(id));
    if (!repair) return;
    
    const w = window.open('', '', 'width=400,height=600');
    if (w) populateRepairTicket(w, repair);
}

function populateRepairTicket(w, repair) {
    const websiteUrl = window.location.origin + "/track.html";
    
    setTimeout(() => {
        w.document.open();
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
    }, 100);
}

export function reprintFinalBill(id) {
    const r = repairsData.find(x => String(x.id) === String(id));
    if (!r) return;
    
    const w = window.open('', '', 'width=400,height=600');
    if (w) populateFinalBill(w, r);
}

function populateFinalBill(w, r) {
    let partsHtml = '';
    
    if (r.parts_used) {
        const parts = typeof r.parts_used === 'string' ? JSON.parse(r.parts_used) : r.parts_used;
        if (parts.length > 0) {
            partsHtml = parts.map(i => `
                <tr>
                    <td style="padding: 5px 0;">${i.name}</td>
                    <td align="center" style="padding: 5px 0;">${i.qty}</td>
                    <td align="right" style="padding: 5px 0;">${(i.price * i.qty).toFixed(2)}</td>
                </tr>
            `).join('');
        }
    }

    if (partsHtml === '') {
        partsHtml = `
            <tr>
                <td colspan="3" align="center" style="font-style:italic; padding: 10px 0; color: #666;">
                    Service / Labor Only
                </td>
            </tr>
        `;
    }

    setTimeout(() => {
        w.document.open();
        w.document.write(`
            <html>
            <head>
                <style>
                    body { font-family: 'Courier New', Courier, monospace; padding: 20px; font-size: 14px; color: #000; }
                    h2, p { margin: 0; padding: 2px 0; }
                    hr { border-top: 1px dashed #000; border-bottom: none; margin: 15px 0; }
                    table { width: 100%; border-collapse: collapse; margin: 10px 0; }
                    th { text-align: left; border-bottom: 1px solid #000; padding-bottom: 5px; }
                </style>
            </head>
            <body>
                <center>
                    <h2>CycleSense Repair Bill</h2>
                    <p>Tel: 075 633 9536</p>
                    <p>Ticket: ${r.repair_id}</p>
                </center>
                <hr>
                <p>Cust: ${r.customer_name}</p>
                <p>Phone: ${r.phone}</p>
                <hr>
                <table>
                    <tr>
                        <th>Item/Service</th>
                        <th style="text-align:center;">Qty</th>
                        <th style="text-align:right;">Price</th>
                    </tr>
                    ${partsHtml}
                </table>
                <hr>
                <div style="text-align: right;">
                    <p>Total Amount: ${r.final_amount.toFixed(2)}</p>
                    <p style="color: red;">Advance Paid: -${r.advance.toFixed(2)}</p>
                    <h3 style="margin-top: 10px;">Balance Paid: ${r.balance_due.toFixed(2)} LKR</h3>
                </div>
                <hr>
                <center><p style="font-size:10px;">Thank you for riding with us!</p></center>
                <script>window.print();</script>
            </body>
            </html>
        `);
        w.document.close();
    }, 100);
}


// ==========================================
// 6. HR, PAYROLL & ATTENDANCE SYSTEM
// ==========================================
let workersData = [];

export async function loadHR() {
    try {
        const sb = getSupabase();
        const { data } = await sb.from('workers').select('*').order('id', { ascending: false });
        
        workersData = data || [];
        
        const list = document.getElementById('workers-list');
        
        if (!list) {
            return; 
        }
        
        let optionsHtml = '<option value="">Select Worker...</option>';
        let htmlContent = '';

        workersData.forEach(w => {
            htmlContent += `
                <div class="p-4 bg-white dark:bg-slate-700 rounded-xl shadow-sm border border-gray-100 dark:border-gray-600 hover:shadow-md transition">
                    <div class="flex justify-between items-start">
                        <div>
                            <h4 class="font-black text-gray-800 dark:text-white">${w.name}</h4>
                            <p class="text-xs text-gray-500 mt-1">
                                <i class="fas fa-phone"></i> ${w.phone || 'N/A'}
                            </p>
                            <div class="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 font-bold px-2 py-1 rounded text-xs text-center border border-green-200 dark:border-green-800 mt-2 inline-block">
                                ${formatCurrency(w.daily_salary)} / Day
                            </div>
                        </div>
                        <div class="flex flex-col gap-2">
                            <div class="flex gap-2 justify-end">
                                <button type="button" onclick="window.posModule.viewWorkerProfile('${w.id}')" class="text-blue-500 hover:bg-blue-50 dark:hover:bg-slate-600 p-2 rounded transition" title="View Profile & PIN">
                                    <i class="fas fa-id-card"></i>
                                </button>
                                <button type="button" onclick="window.posModule.viewWorkerAttendance('${w.id}')" class="text-indigo-500 hover:bg-indigo-50 dark:hover:bg-slate-600 p-2 rounded transition" title="View Salary & Attendance">
                                    <i class="fas fa-chart-bar"></i>
                                </button>
                                <button type="button" onclick="window.posModule.openEditWorker('${w.id}')" class="text-green-500 hover:bg-green-50 dark:hover:bg-slate-600 p-2 rounded transition" title="Edit Worker Details">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button type="button" onclick="window.posModule.deleteWorker('${w.id}')" class="text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-slate-600 p-2 rounded transition" title="Delete Worker">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
                
            optionsHtml += `<option value="${w.id}">${w.name}</option>`;
        });
        
        list.innerHTML = htmlContent;

        const attSelect = document.getElementById('hr-att-worker');
        const advSelect = document.getElementById('hr-adv-worker');
        const paySelect = document.getElementById('hr-pay-worker');

        if (attSelect) attSelect.innerHTML = optionsHtml;
        if (advSelect) advSelect.innerHTML = optionsHtml;
        if (paySelect) paySelect.innerHTML = optionsHtml;
        
        const todayStr = new Date().toISOString().split('T')[0];
        
        if (document.getElementById('hr-att-date')) document.getElementById('hr-att-date').value = todayStr;
        if (document.getElementById('hr-adv-date')) document.getElementById('hr-adv-date').value = todayStr;

        loadHRDashboardSummary();
        
    } catch (err) {
        console.error("Error loading HR:", err);
    }
}

export function viewWorkerProfile(id) {
    const w = workersData.find(x => String(x.id) === String(id)); 
    
    if (!w) {
        return;
    }
    
    document.getElementById('vp-name').innerText = w.name;
    document.getElementById('vp-id').innerText = w.worker_uid || w.id;
    document.getElementById('vp-pin').innerText = w.pin || '1234';
    document.getElementById('vp-phone').innerText = w.phone || 'N/A';
    document.getElementById('vp-nic').innerText = w.nic || 'N/A';
    document.getElementById('vp-dob').innerText = w.dob || 'N/A';
    document.getElementById('vp-salary').innerText = formatCurrency(w.daily_salary);
    
    document.getElementById('view-worker-profile-modal').classList.remove('hidden');
}


async function loadHRDashboardSummary() {
    const sb = getSupabase();
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const startOfMonth = `${year}-${month}-01`;
    const todayStr = today.toISOString().split('T')[0];

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

    const salAlertEl = document.getElementById('salary-alert');
    
    if (salAlertEl) {
        if (today.getDate() >= 18 && today.getDate() <= 25) {
            salAlertEl.classList.remove('hidden');
            salAlertEl.innerHTML = `<i class="fas fa-exclamation-triangle"></i> Notice: Salary Date Approaching (25th). Prepare Payroll Slips.`;
        } else { 
            salAlertEl.classList.add('hidden'); 
        }
    }

    const { data: attData } = await sb.from('attendance').select('*').gte('date', startOfMonth).lte('date', todayStr);
    const { data: advData } = await sb.from('advances').select('*').gte('date', startOfMonth).lte('date', todayStr);

    let totalAccruedGross = 0; 
    let totalAdvancesGiven = 0;
    
    if (advData) {
        advData.forEach(a => {
            totalAdvancesGiven += Number(a.amount);
        });
    }

    workersData.forEach(w => {
        const myAtt = (attData || []).filter(a => String(a.worker_id) === String(w.id));
        let myGross = 0;
        
        myAtt.forEach(a => {
            if (a.status === 'Full Day' || a.status === 'Short Leave') {
                myGross += w.daily_salary;
            }
            else if (a.status === 'Half Day') {
                myGross += (w.daily_salary / 2);
            }

            if (a.status === 'Full Day' && a.in_time && a.out_time) {
                const parseTime = t => { 
                    const [hr, mn] = t.split(':').map(Number); 
                    return hr * 60 + mn; 
                };
                const inMins = parseTime(a.in_time); 
                const outMins = parseTime(a.out_time);
                
                let missedMins = 0;
                
                if (inMins > 600) { // 10:00 AM
                    missedMins += (inMins - 600);
                }
                if (outMins < 1020) { // 5:00 PM
                    missedMins += (1020 - outMins);
                }
                
                if (missedMins > 0) {
                    const ratePerMin = w.daily_salary / 420; 
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

    if (document.getElementById('accrued-gross')) {
        document.getElementById('accrued-gross').innerText = formatCurrency(totalAccruedGross);
    }
    if (document.getElementById('accrued-advances')) {
        document.getElementById('accrued-advances').innerText = "- " + formatCurrency(totalAdvancesGiven);
    }
    if (document.getElementById('accrued-net')) {
        document.getElementById('accrued-net').innerText = formatCurrency(netPayableCurrent);
    }
    if (document.getElementById('accrued-epf')) {
        document.getElementById('accrued-epf').innerText = formatCurrency(epfEmployerPortion + epfEmployeePortion);
    }
    if (document.getElementById('accrued-etf')) {
        document.getElementById('accrued-etf').innerText = formatCurrency(etfEmployerPortion);
    }
}

export async function addWorker(e) {
    e.preventDefault(); 
    
    const sb = getSupabase();
    const form = new FormData(e.target);
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
        await loadHR(); 
        showCustomConfirm("Success", `Worker Created!\nPortal ID: ${generatedUid}\nDefault PIN: 1234`, "success-green"); 
    }
}

export function openEditWorker(id) {
    const w = workersData.find(x => String(x.id) === String(id)); 
    
    if (!w) {
        return;
    }
    
    document.getElementById('ew-id').value = w.id; 
    document.getElementById('ew-name').value = w.name;
    document.getElementById('ew-phone').value = w.phone || ''; 
    document.getElementById('ew-nic').value = w.nic || '';
    document.getElementById('ew-dob').value = w.dob || ''; 
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
        daily_salary: Number(form.get('salary')), 
        pin: form.get('pin') 
    }).eq('id', form.get('id'));
    
    if (error) {
        alert(error.message);
    } else { 
        document.getElementById('edit-worker-modal').classList.add('hidden'); 
        await loadHR(); 
        showCustomConfirm("Success", "Worker Details Updated", "success-green"); 
    }
}

export async function deleteWorker(id) { 
    if (await showCustomConfirm("Delete Worker?", "This deletes the worker profile and all history permanently.", "danger")) { 
        const sb = getSupabase();
        
        await sb.from('attendance').delete().eq('worker_id', id);
        await sb.from('advances').delete().eq('worker_id', id);
        
        const { error } = await sb.from('workers').delete().eq('id', id); 
        
        if (error) {
            alert("Error deleting worker: " + error.message);
        } else {
            await loadHR(); 
        }
    } 
}

export async function markAttendance(e) {
    e.preventDefault(); 
    
    const sb = getSupabase();
    const form = new FormData(e.target); 
    const wId = form.get('worker_id'); 
    const d = form.get('date');
    
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
        await loadHRDashboardSummary(); 
        showCustomConfirm("Saved", "Attendance Logged Successfully", "success-green"); 
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
        await loadHRDashboardSummary(); 
        showCustomConfirm("Saved", "Advance registered successfully.", "success-green"); 
    }
}

export async function calculateWorkerSalary(wId, monthStr) {
    const sb = getSupabase();
    const worker = workersData.find(w => String(w.id) === String(wId));
    
    if (!worker) {
        return null;
    }

    const [year, month] = monthStr.split('-');
    const startDate = `${monthStr}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];

    const { data: attData } = await sb.from('attendance')
        .select('*')
        .eq('worker_id', wId)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', {ascending:true});
        
    const { data: advData } = await sb.from('advances')
        .select('*')
        .eq('worker_id', wId)
        .gte('date', startDate)
        .lte('date', endDate);

    let full = 0;
    let half = 0;
    let short = 0;
    let timePenalty = 0;

    if (attData) {
        attData.forEach(a => {
            if (a.status === 'Half Day') {
                half++;
            } else if (a.status === 'Short Leave') {
                short++;
            } else if (a.status === 'Full Day') {
                full++;
                if (a.in_time && a.out_time) {
                    const parse = t => { 
                        const [h,m] = t.split(':').map(Number); 
                        return h * 60 + m; 
                    };
                    const inMins = parse(a.in_time); 
                    const outMins = parse(a.out_time);
                    
                    let missed = 0;
                    
                    if (inMins > 600) {
                        missed += (inMins - 600);
                    }
                    if (outMins < 1020) {
                        missed += (1020 - outMins);
                    }
                    
                    if (missed > 0) {
                        timePenalty += (missed * (worker.daily_salary / 420));
                    }
                }
            }
        });
    }

    const baseGross = (full * worker.daily_salary) + (short * worker.daily_salary) + (half * (worker.daily_salary / 2));
    const grossEarnings = baseGross - timePenalty;
    
    let totalAdvances = 0;
    if (advData) {
        totalAdvances = advData.reduce((sum, a) => sum + Number(a.amount), 0);
    }
    
    const epfDeduction = grossEarnings > 0 ? grossEarnings * 0.08 : 0;
    const netPay = grossEarnings - totalAdvances - epfDeduction;

    return { 
        worker, 
        attData, 
        advData, 
        full, 
        half, 
        short, 
        timePenalty, 
        grossEarnings, 
        totalAdvances, 
        epfDeduction, 
        netPay, 
        monthStr 
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
    
    if (!data) {
        return;
    }

    document.getElementById('view-att-name').innerText = data.worker.name;
    document.getElementById('view-att-gross').innerText = formatCurrency(data.grossEarnings);
    document.getElementById('view-att-net').innerText = formatCurrency(data.netPay);
    
    const tbody = document.getElementById('view-att-table');
    let htmlContent = '';
    
    if (data.attData) {
        data.attData.forEach(a => {
            let penText = '-';
            
            if (a.status === 'Full Day' && a.in_time && a.out_time) {
                const inMins = parseInt(a.in_time.split(':')[0]) * 60 + parseInt(a.in_time.split(':')[1]);
                const outMins = parseInt(a.out_time.split(':')[0]) * 60 + parseInt(a.out_time.split(':')[1]);
                
                let missed = 0;
                if (inMins > 600) {
                    missed += (inMins - 600);
                }
                if (outMins < 1020) {
                    missed += (1020 - outMins);
                }
                
                if (missed > 0) { 
                    penText = formatCurrency(missed * (data.worker.daily_salary / 420)); 
                }
            }
            
            htmlContent += `
                <tr class="border-b dark:border-gray-700 text-sm">
                    <td class="p-2 font-bold">${a.date}</td>
                    <td class="p-2">${a.status}</td>
                    <td class="p-2">${a.in_time || '-'} to ${a.out_time || '-'}</td>
                </tr>
            `;
        });
    }
    
    if (!data.attData || data.attData.length === 0) {
        htmlContent = `<tr><td colspan="3" class="p-4 text-center text-gray-500">No records found for this month.</td></tr>`;
    }
    
    tbody.innerHTML = htmlContent;
}

export async function generatePayroll(e) {
    e.preventDefault(); 
    
    const w = window.open('', '', 'width=600,height=800');
    if (w) w.document.write('<p style="font-family:sans-serif; text-align:center; margin-top:50px;">Calculating Payroll Data...</p>');

    const form = new FormData(e.target); 
    const wId = form.get('worker_id'); 
    const mStr = form.get('month');
    
    const data = await calculateWorkerSalary(wId, mStr);
    
    if (!data) {
        if (w) w.close();
        return alert("Error locating worker details.");
    }
    
    let advancesHtml = '';
    if (data.advData) {
        advancesHtml = data.advData.map(a => `
            <div style="font-size: 12px; color: #888; padding-left: 20px; margin: 2px 0;">
                ${a.date} : ${formatCurrency(a.amount)}
            </div>
        `).join('');
    }
    
    if (w) {
        setTimeout(() => {
            w.document.open();
            w.document.write(`
                <html>
                <head>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 40px; color: #333; }
                        h1 { margin: 0; color: #1e3a8a; } 
                        h3 { margin: 5px 0; color: #666; }
                        .row { display: flex; justify-content: space-between; border-bottom: 1px dashed #eee; padding: 10px 0; font-size:14px; }
                        .bold { font-weight: bold; }
                    </style>
                </head>
                <body>
                    <div style="text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 20px;">
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
                    
                    <div style="margin-top: 30px; font-size: 14px; text-transform: uppercase; color: #888; border-bottom: 1px solid #ccc; padding-bottom: 5px;">Earnings & Deductions</div>
                    <div class="row">
                        <span>Full Days (${data.full})</span> 
                        <span>${formatCurrency(data.full * data.worker.daily_salary)}</span>
                    </div>
                    <div class="row">
                        <span>Half Days (${data.half})</span> 
                        <span>${formatCurrency(data.half * (data.worker.daily_salary / 2))}</span>
                    </div>
                    <div class="row">
                        <span>Short Leaves (${data.short})</span> 
                        <span>${formatCurrency(data.short * data.worker.daily_salary)}</span>
                    </div>
                    <div class="row">
                        <span>Time Penalties (Late/Early)</span> 
                        <span style="color:red">- ${formatCurrency(data.timePenalty)}</span>
                    </div>
                    
                    <div class="row" style="background:#f4f4f4; padding: 15px 5px;">
                        <span><b>Gross Earnings</b></span> 
                        <span class="bold">${formatCurrency(data.grossEarnings)}</span>
                    </div>
                    
                    <div style="margin-top: 30px; font-size: 14px; text-transform: uppercase; color: #888; border-bottom: 1px solid #ccc; padding-bottom: 5px;">Subtractions</div>
                    <div class="row">
                        <span>Advances Taken</span> 
                        <span style="color:red">- ${formatCurrency(data.totalAdvances)}</span>
                    </div>
                    ${advancesHtml}
                    
                    <div class="row">
                        <span>EPF Deduction (8%)</span> 
                        <span style="color:red">- ${formatCurrency(data.epfDeduction)}</span>
                    </div>
                    
                    <div style="display: flex; justify-content: space-between; border-top: 2px solid #333; border-bottom: 2px solid #333; padding: 15px 0; font-size: 18px; margin-top: 20px; background: #f8fafc;">
                        <span class="bold" style="color: #16a34a;">NET PAYABLE</span> 
                        <span class="bold" style="color: #16a34a;">${formatCurrency(data.netPay)}</span>
                    </div>
                    
                    <div style="margin-top: 30px; font-size: 14px; text-transform: uppercase; color: #888; border-bottom: 1px solid #ccc; padding-bottom: 5px;">Employer Contributions (Info Only)</div>
                    <div class="row">
                        <span>EPF Contribution (12%)</span> 
                        <span>${formatCurrency(data.grossEarnings * 0.12)}</span>
                    </div>
                    <div class="row">
                        <span>ETF Contribution (3%)</span> 
                        <span>${formatCurrency(data.grossEarnings * 0.03)}</span>
                    </div>
                    
                    <div style="margin-top: 60px; display: flex; justify-content: space-between;">
                        <div style="border-top: 1px solid #333; width: 200px; text-align: center; padding-top: 5px;">Manager Signature</div>
                        <div style="border-top: 1px solid #333; width: 200px; text-align: center; padding-top: 5px;">Employee Signature</div>
                    </div>
                    
                    <script>window.print();</script>
                </body>
                </html>
            `);
            w.document.close();
        }, 100);
    }
}


// ==========================================
// 7. CALENDAR SYSTEM
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
    const monthNames = [
        "January", "February", "March", "April", "May", "June", 
        "July", "August", "September", "October", "November", "December"
    ];
    
    document.getElementById('cal-month-year').innerText = `${monthNames[month]} ${year}`;
    
    const daysContainer = document.getElementById('cal-days');
    
    if (!daysContainer) {
        return;
    }
    
    daysContainer.innerHTML = '';
    
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const sDate = `${year}-${String(month+1).padStart(2,'0')}-01`;
    const eDate = `${year}-${String(month+1).padStart(2,'0')}-${daysInMonth}`;
    
    const sb = getSupabase();
    
    const { data: events } = await sb.from('calendar_events')
        .select('*')
        .gte('event_date', sDate)
        .lte('event_date', eDate);
        
    const slHolidays = {
        "01-01": "New Year's Day", "01-14": "Tamil Thai Pongal", "02-04": "Independence Day",
        "04-03": "Good Friday", "04-13": "Sinhala/Tamil New Year Eve", "04-14": "Sinhala/Tamil New Year",
        "05-01": "May Day", "12-25": "Christmas Day"
    };

    const poyaDays = {
        "01-03": "Duruthu Full Moon", "02-01": "Navam Full Moon", "03-03": "Medin Full Moon",
        "04-01": "Bak Full Moon", "05-01": "Vesak Full Moon", "05-30": "Poson Full Moon",
        "06-29": "Esala Full Moon", "07-28": "Esala Full Moon (Adhi)", "08-27": "Nikini Full Moon",
        "09-25": "Binara Full Moon", "10-25": "Vap Full Moon", "11-23": "Ill Full Moon", "12-23": "Unduvap Full Moon"
    };
    
    let htmlContent = '';
    
    for (let i = 0; i < firstDay; i++) { 
        htmlContent += `
            <div class="p-4 border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-slate-800 opacity-50 rounded"></div>
        `; 
    }
    
    for (let day = 1; day <= daysInMonth; day++) {
        const fullDate = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
        const monthDayStr = `${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
        
        let eventHtml = '';
        
        if (slHolidays[monthDayStr]) {
            eventHtml += `
                <div class="bg-red-100 text-red-800 text-[10px] p-1 rounded mt-1 truncate font-bold shadow-sm" title="${slHolidays[monthDayStr]}">
                    🎌 ${slHolidays[monthDayStr]}
                </div>
            `;
        }

        if (poyaDays[monthDayStr]) {
            eventHtml += `
                <div class="bg-yellow-100 text-yellow-800 text-[10px] p-1 rounded mt-1 truncate font-bold shadow-sm" title="${poyaDays[monthDayStr]}">
                    🌕 Poya Day
                </div>
            `;
        }
        
        if (events) {
            const dayEvents = events.filter(e => e.event_date === fullDate);
            dayEvents.forEach(e => { 
                eventHtml += `
                    <div class="bg-blue-100 text-blue-800 text-[10px] p-1 rounded mt-1 truncate shadow-sm" title="${e.title}">
                        📍 ${e.title}
                    </div>
                `; 
            });
        }
        
        htmlContent += `
            <div class="p-2 border border-gray-100 dark:border-gray-700 min-h-[80px] rounded cursor-pointer hover:bg-blue-50 dark:hover:bg-slate-700 transition" onclick="window.posModule.openEventModal('${fullDate}')">
                <span class="font-bold text-gray-700 dark:text-gray-300">${day}</span>
                ${eventHtml}
            </div>
        `;
    }
    
    daysContainer.innerHTML = htmlContent;
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
    
    const { error } = await sb.from('calendar_events').insert({ 
        event_date: dateStr, 
        title: title 
    });
    
    if (error) {
        alert("Error saving event: " + error.message);
    } else {
        document.getElementById('calendar-event-modal').classList.add('hidden');
        renderCalendar(currentMonth, currentYear);
    }
}
