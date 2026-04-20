import { getSupabase } from './config.js';
import { showCustomConfirm } from './ui.js';

// ============================================================================
// GLOBAL FORMATTERS & HELPER FUNCTIONS
// ============================================================================

/**
 * Formats a raw number into Sri Lankan Rupees (LKR)
 * @param {number} val - The number to format
 * @returns {string} - Formatted currency string (e.g., LKR 1,500.00)
 */
const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-LK', { 
        style: 'currency', 
        currency: 'LKR' 
    }).format(val || 0);
};

/**
 * Universal fetch function to grab all records from a specified table
 * @param {string} table - The Supabase table name
 * @returns {Array} - Array of data objects
 */
async function fetchAll(table) {
    try {
        const sb = getSupabase();
        const { data, error } = await sb.from(table).select('*').order('id', { ascending: false });
        
        if (error) { 
            console.error(`Error fetching data from table '${table}':`, error.message); 
            return []; 
        }
        
        return data || [];
    } catch (err) {
        console.error(`Database Connection Error on '${table}':`, err);
        return [];
    }
}


// ============================================================================
// 1. CYCLE SHOWROOM SYSTEM
// ============================================================================

let showroomData = []; // Holds the bicycle data globally for editing

export async function loadShowroom() {
    try {
        const sb = getSupabase();
        
        // Fetch only items marked specifically as 'Bicycle'
        const { data, error } = await sb.from('products')
            .select('*')
            .eq('item_type', 'Bicycle')
            .order('id', { ascending: false });
        
        const grid = document.getElementById('admin-showroom-grid');
        
        if (!grid) return;

        if (error) {
            grid.innerHTML = `
                <div class="col-span-full bg-red-50 border border-red-200 text-red-600 p-6 rounded-2xl text-center font-bold shadow-sm">
                    <i class="fas fa-exclamation-triangle text-3xl mb-3 block"></i>
                    Error loading showroom inventory: ${error.message}
                </div>
            `;
            return;
        }

        showroomData = data || []; 
        let html = '';
        
        showroomData.forEach(bike => {
            let badgeColor = '';
            let warrantyText = '';
            let warrantyIcon = '';
            
            // Dynamic Warranty Logic based on Cycle Category
            if (bike.cycle_category === 'New') {
                badgeColor = 'bg-green-100 text-green-700 border-green-200';
                warrantyText = '5 Years Frame Warranty';
                warrantyIcon = 'text-green-500';
            } else if (bike.cycle_category === 'Japanese Reconditioned') {
                badgeColor = 'bg-blue-100 text-blue-700 border-blue-200';
                warrantyText = '6 Months Shop Warranty';
                warrantyIcon = 'text-blue-500';
            } else {
                badgeColor = 'bg-gray-200 text-gray-700 border-gray-300';
                warrantyText = 'No Warranty (Sold As-Is)';
                warrantyIcon = 'text-gray-400';
            }

            let stockBadge = bike.stock > 0 
                ? `<span class="text-green-500 text-xs font-black bg-green-50 px-2 py-1 rounded-lg border border-green-100"><i class="fas fa-check-circle"></i> In Stock: ${bike.stock}</span>` 
                : `<span class="text-red-500 text-xs font-black bg-red-50 px-2 py-1 rounded-lg border border-red-100"><i class="fas fa-times-circle"></i> Out of Stock</span>`;

            html += `
                <div class="bg-white dark:bg-slate-800 rounded-3xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col transition hover:shadow-2xl transform hover:-translate-y-1 duration-300 relative group">
                    
                    <button onclick="window.posModule.editBicycle('${bike.id}')" class="absolute top-4 right-4 bg-white/90 text-blue-600 p-2.5 rounded-xl shadow-lg hover:bg-blue-50 hover:scale-110 transition z-10 opacity-0 group-hover:opacity-100 duration-300" title="Edit Bicycle Details">
                        <i class="fas fa-edit"></i>
                    </button>

                    <div class="h-56 bg-gray-100 dark:bg-slate-900 relative overflow-hidden">
                        <img src="${bike.image_url || 'https://via.placeholder.com/400x300?text=No+Image'}" alt="${bike.name}" class="w-full h-full object-cover transition duration-500 group-hover:scale-110">
                        <div class="absolute top-4 left-4 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border shadow-md backdrop-blur-sm bg-white/90 ${badgeColor}">
                            ${bike.cycle_category}
                        </div>
                    </div>
                    
                    <div class="p-6 flex flex-col flex-grow">
                        <div class="flex justify-between items-start mb-3">
                            <h3 class="font-black text-xl text-gray-800 dark:text-white leading-tight pr-2">${bike.name}</h3>
                            <span class="text-[10px] text-gray-500 font-mono font-bold bg-gray-100 dark:bg-slate-700 border dark:border-gray-600 px-2 py-1 rounded shadow-inner whitespace-nowrap">
                                ${bike.code}
                            </span>
                        </div>
                        
                        <p class="text-sm text-gray-500 dark:text-gray-400 mb-4 flex-grow italic leading-relaxed">
                            "${bike.specs || 'No specific details provided.'}"
                        </p>
                        
                        <div class="mb-5 text-xs font-bold flex items-center gap-2 bg-gray-50 dark:bg-slate-700/50 p-3 rounded-xl border border-gray-100 dark:border-gray-600 shadow-inner">
                            <i class="fas fa-shield-alt text-lg ${warrantyIcon}"></i>
                            <span class="text-gray-600 dark:text-gray-300 uppercase tracking-wide">${warrantyText}</span>
                        </div>

                        <div class="flex justify-between items-end mb-6">
                            <div>${stockBadge}</div>
                            <div class="text-3xl font-black text-indigo-600 dark:text-indigo-400 tracking-tight">
                                ${formatCurrency(bike.unit_price)}
                            </div>
                        </div>
                        
                        <div class="flex gap-3 mt-auto border-t border-gray-100 dark:border-gray-700 pt-5">
                            <button onclick="window.posModule.deleteProduct('${bike.id}')" class="w-14 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-500 rounded-xl transition shadow-sm flex items-center justify-center text-lg" title="Delete Bicycle">
                                <i class="fas fa-trash-alt"></i>
                            </button>
                            <button onclick="window.posModule.sellBicycle('${bike.id}')" class="flex-grow bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black py-3.5 rounded-xl hover:from-blue-700 hover:to-indigo-700 transition flex items-center justify-center gap-2 shadow-lg shadow-blue-500/30 transform hover:-translate-y-0.5 active:translate-y-0 text-lg">
                                <i class="fas fa-cart-arrow-down"></i> Sell Now
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });
        
        grid.innerHTML = html || `
            <div class="col-span-full text-center py-20 bg-gray-50 dark:bg-slate-800/50 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-700 shadow-inner">
                <div class="w-24 h-24 bg-white dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-6 shadow-md">
                    <i class="fas fa-bicycle text-5xl text-gray-300 dark:text-gray-500"></i>
                </div>
                <h3 class="text-xl font-black text-gray-700 dark:text-gray-300 mb-2">Showroom is Empty</h3>
                <p class="text-gray-500 font-medium">Click "Add New Bicycle" to start building your catalog.</p>
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
    
    const stockQty = Number(form.get('stock'));
    const buyingPrice = Number(form.get('buying_price'));
    const unitPrice = Number(form.get('unit_price'));

    const { error } = await sb.from('products').insert({
        item_type: 'Bicycle',
        code: form.get('code').toUpperCase().trim(),
        name: form.get('name').trim(),
        cycle_category: form.get('category'),
        specs: form.get('specs').trim(),
        image_url: form.get('image_url').trim(),
        stock: stockQty,
        reorder_level: 1, 
        buying_price: buyingPrice,
        unit_price: unitPrice
    });

    if (error) {
        alert("Database Error: " + error.message);
    } else {
        e.target.reset();
        document.getElementById('add-bicycle-modal').classList.add('hidden');
        await loadShowroom();
        showCustomConfirm("Success", "New bicycle added to showroom successfully!", "success-green");
    }
}

export function editBicycle(id) {
    const bike = showroomData.find(x => String(x.id) === String(id));
    
    if (!bike) return;
    
    document.getElementById('edit-bike-id').value = bike.id;
    document.getElementById('edit-bike-code').value = bike.code;
    document.getElementById('edit-bike-name').value = bike.name;
    document.getElementById('edit-bike-category').value = bike.cycle_category;
    document.getElementById('edit-bike-stock').value = bike.stock;
    document.getElementById('edit-bike-specs').value = bike.specs || '';
    document.getElementById('edit-bike-image').value = bike.image_url || '';
    document.getElementById('edit-bike-buy').value = bike.buying_price;
    document.getElementById('edit-bike-sell').value = bike.unit_price;
    
    document.getElementById('edit-bicycle-modal').classList.remove('hidden');
}

export async function saveEditBicycle(e) {
    e.preventDefault();
    
    const sb = getSupabase();
    const form = new FormData(e.target);
    const id = form.get('id');
    
    const { error } = await sb.from('products').update({
        code: form.get('code').toUpperCase().trim(),
        name: form.get('name').trim(),
        cycle_category: form.get('category'),
        stock: Number(form.get('stock')),
        specs: form.get('specs').trim(),
        image_url: form.get('image_url').trim(),
        buying_price: Number(form.get('buying_price')),
        unit_price: Number(form.get('unit_price'))
    }).eq('id', id);
    
    if (error) {
        alert("Update Error: " + error.message);
    } else {
        document.getElementById('edit-bicycle-modal').classList.add('hidden');
        await loadShowroom();
        await loadInventory(); 
        showCustomConfirm("Updated Successfully", "Bicycle details have been modified.", "success-green");
    }
}

export function sellBicycle(id) {
    const sb = getSupabase();
    
    sb.from('products').select('*').eq('id', id).single().then(({data: bike}) => {
        
        if (!bike) return;
        
        if (bike.stock <= 0) {
            return showCustomConfirm("Out of Stock", "This bicycle is currently out of stock and cannot be sold.", "danger");
        }

        const existingItem = cart.find(i => i.id === id);
        
        if (existingItem) {
            existingItem.qty += 1;
        } else {
            cart.push({ 
                id: id, 
                name: bike.name, 
                price: bike.unit_price, 
                qty: 1,
                isBike: true,                 
                category: bike.cycle_category 
            });
        }

        if (bike.cycle_category === 'New' || bike.cycle_category === 'Japanese Reconditioned') {
            const svcInput = document.getElementById('pos-service-cost');
            let currentSvc = parseFloat(svcInput.value || 0);
            svcInput.value = currentSvc + 1500; 
            
            showCustomConfirm(
                "Added to POS Cart", 
                `${bike.name} has been added.\n\nA standard 1-day Assembly & Tuning charge of 1,500 LKR has been automatically added to the service cost.`, 
                "confirm"
            );
        } else {
            showCustomConfirm("Added to POS Cart", `${bike.name} added to cart.`, "success-green");
        }

        renderCart();
        window.handleNavClick('pos'); 
    }).catch(err => {
        console.error("Error selling bicycle:", err);
    });
}


// ============================================================================
// 2. POS & BILLING SYSTEM
// ============================================================================

let cart = []; 
let inventoryData = [];

export async function initPOS() {
    try {
        inventoryData = await fetchAll('products'); 
        const select = document.getElementById('pos-product-select');
        
        if (select) { 
            select.innerHTML = '<option value="">Select Spare Part or Accessory...</option>'; 
            const partsOnly = inventoryData.filter(p => p.item_type !== 'Bicycle');
            
            partsOnly.forEach(p => {
                const isOutOfStock = p.stock <= 0;
                const stockText = isOutOfStock ? 'OUT OF STOCK' : `Stock: ${p.stock}`;
                const disabled = isOutOfStock ? 'disabled' : '';
                
                select.innerHTML += `
                    <option value="${p.id}" data-price="${p.unit_price}" data-name="${p.name}" ${disabled}>
                        ${p.code} - ${p.name} (${stockText}) - ${formatCurrency(p.unit_price)}
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
        return alert("Please select a product from the dropdown list first.");
    }
    
    const option = select.options[select.selectedIndex];
    const name = option.getAttribute('data-name');
    const price = parseFloat(option.getAttribute('data-price'));
    const p = inventoryData.find(x => String(x.id) === String(id)); 
    const qty = parseInt(qtyInput.value);
    
    if (qty <= 0 || isNaN(qty)) {
        return alert("Quantity must be greater than 0.");
    }

    const existingItem = cart.find(i => i.id === id); 
    const currentCartQty = existingItem ? existingItem.qty : 0;
    
    if ((currentCartQty + qty) > p.stock) {
        return showCustomConfirm("Low Stock Warning", `You cannot add ${qty} more. Only ${p.stock - currentCartQty} units left available to sell.`, "danger");
    }
    
    if (existingItem) {
        existingItem.qty += qty; 
    } else {
        cart.push({ id: id, name: name, price: price, qty: qty });
    }
    
    renderCart(); 
    qtyInput.value = 1;
    select.value = "";
}

export function renderCart() {
    const tbody = document.getElementById('cart-table-body'); 
    const totalEl = document.getElementById('pos-total');
    
    if (!tbody) return; 
    
    let htmlContent = ''; 
    let total = 0;
    
    if (cart.length === 0) {
        htmlContent = `
            <tr>
                <td colspan="4" class="p-8 text-center text-gray-400 font-bold uppercase tracking-widest bg-gray-50/50 dark:bg-slate-800/20">
                    <i class="fas fa-shopping-basket text-3xl mb-2 block opacity-50"></i>
                    Cart is empty
                </td>
            </tr>
        `;
    } else {
        cart.forEach((item, idx) => { 
            const rowTotal = item.price * item.qty;
            total += rowTotal; 
            
            htmlContent += `
                <tr class="border-b border-gray-100 dark:border-gray-700 hover:bg-white dark:hover:bg-slate-800 transition duration-200">
                    <td class="p-4 font-bold text-gray-800 dark:text-gray-200">${item.name}</td>
                    <td align="center" class="p-4">
                        <span class="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-black px-3 py-1 rounded-lg border border-blue-100 dark:border-blue-800">${item.qty}</span>
                    </td>
                    <td align="right" class="p-4 text-green-600 dark:text-green-400 font-black text-lg">${formatCurrency(rowTotal)}</td>
                    <td align="center" class="p-4">
                        <button type="button" onclick="window.posModule.removeCartItem(${idx})" class="text-red-400 hover:text-white hover:bg-red-500 bg-red-50 dark:bg-red-900/20 w-10 h-10 rounded-xl transition shadow-sm flex items-center justify-center mx-auto" title="Remove Item">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </td>
                </tr>
            `; 
        });
    }
    
    tbody.innerHTML = htmlContent;
    const serviceCostInput = document.getElementById('pos-service-cost');
    const serviceCost = parseFloat(serviceCostInput?.value || 0);
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
        return showCustomConfirm("Empty Cart", "You cannot process a sale with an empty cart and zero service cost.", "danger");
    }

    const w = window.open('', '', 'width=450,height=700');
    if (w) {
        w.document.write(`
            <div style="font-family: sans-serif; text-align: center; margin-top: 50px; color: #666;">
                <h2 style="color: #3b82f6;">Processing Transaction...</h2>
                <p>Please wait while we sync with CycleSense Cloud.</p>
            </div>
        `);
    }

    const receiptNo = "POS-" + Date.now().toString().slice(-6) + Math.floor(Math.random() * 100);

    // --- DYNAMIC WARRANTY LOGIC (Fixes the 1970 Bug) ---
    const serialNumber = form.get('serial_number')?.trim();
    let warrantyExp = null;
    let warrantyMonths = 0;

    if (serialNumber) {
        const bikeInCart = cart.find(item => item.isBike);
        
        if (bikeInCart) {
            if (bikeInCart.category === 'New') {
                warrantyMonths = 60; // 5 Years
            } else if (bikeInCart.category === 'Japanese Reconditioned') {
                warrantyMonths = 6; // 6 Months
            }
        }

        if (warrantyMonths > 0) {
            const expDate = new Date();
            expDate.setMonth(expDate.getMonth() + warrantyMonths);
            warrantyExp = expDate.toISOString().split('T')[0];
        }
    }
    // ----------------------------------------------------

    const { data: sale, error } = await sb.from('sales').insert({ 
        receipt_no: receiptNo, 
        customer_name: form.get('customer_name') || 'Walk-in Customer', 
        phone: form.get('phone') || '-', 
        service_cost: svc, 
        total_amount: total, 
        date: new Date().toISOString(),
        warranty_serial: serialNumber || null,
        warranty_exp: warrantyExp
    }).select().single();

    if (error) {
        if(w) w.close();
        return showCustomConfirm("Transaction Failed", error.message, "danger");
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
        
        for (let item of cart) { 
            const { data: liveProduct } = await sb.from('products').select('stock').eq('id', item.id).single();
            if (liveProduct) {
                await sb.from('products').update({ stock: liveProduct.stock - item.qty }).eq('id', item.id); 
            }
        }
    }
    
    cart = []; 
    e.target.reset(); 
    renderCart(); 
    
    if (w) {
        populateBill(w, sale, itemsForBill, serialNumber, warrantyExp);
    }
    
    await initPOS(); 
    await loadInventory(); 
    await loadShowroom();
    
    showCustomConfirm("Transaction Successful", `Receipt ${receiptNo} generated and stock updated.`, "success-green");
}

function populateBill(w, sale, items, serialNumber = null, warrantyExp = null) {
    let itemsHtml = '';
    
    if (items && items.length > 0) {
        itemsHtml = items.map(i => `
            <tr>
                <td style="padding: 8px 0; border-bottom: 1px dotted #eee;">${i.name}</td>
                <td align="center" style="padding: 8px 0; border-bottom: 1px dotted #eee;">${i.qty}</td>
                <td align="right" style="padding: 8px 0; border-bottom: 1px dotted #eee;">${(i.price * i.qty).toFixed(2)}</td>
            </tr>
        `).join('');
    } else {
        itemsHtml = `<tr><td colspan="3" align="center" style="font-style:italic; padding: 15px 0; color: #888;">Labor / Service Only</td></tr>`;
    }

    let warrantyHtml = '';
    
    if (serialNumber && warrantyExp) {
        const expDateObj = new Date(warrantyExp);
        warrantyHtml = `
            <div style="margin-top: 20px; padding: 15px; border: 2px dashed #000; text-align: center; background-color: #fff;">
                <h3 style="margin: 0 0 8px 0; text-transform: uppercase; font-family: 'Arial', sans-serif; letter-spacing: 2px; font-size: 16px;">Official Warranty</h3>
                <p style="margin: 4px 0; font-size: 14px;">Frame S/N: <b style="font-family: monospace; font-size: 16px;">${serialNumber}</b></p>
                <p style="margin: 8px 0; font-size: 14px; font-weight: bold; background-color: #000; color: #fff; padding: 5px;">Valid Until: ${expDateObj.toLocaleDateString()}</p>
                <p style="margin: 8px 0 0 0; font-size: 10px; color: #333; text-transform: uppercase;">Retain this receipt for any warranty claims.</p>
                <div style="margin-top: 10px; padding-top: 10px; border-top: 1px dashed #ccc;">
                    <p style="font-size: 10px; font-weight: bold; text-transform: uppercase; margin-bottom: 3px;">Verify Status Online:</p>
                    <p style="font-size: 11px; font-family: monospace; font-weight: bold;">https://julgaha-cycle-works.netlify.app/warranty</p>
                </div>
            </div>
        `;
    } else if (serialNumber) {
        warrantyHtml = `
            <div style="margin-top: 20px; padding: 15px; border: 2px dashed #000; text-align: center; background-color: #f9f9f9;">
                <p style="margin: 4px 0; font-size: 14px;">Frame S/N: <b style="font-family: monospace; font-size: 16px;">${serialNumber}</b></p>
                <p style="margin: 8px 0; font-size: 14px; font-weight: bold; color: #555; padding: 5px;">Condition: SOLD AS-IS (No Warranty)</p>
                <div style="margin-top: 10px; padding-top: 10px; border-top: 1px dashed #ccc;">
                    <p style="font-size: 10px; font-weight: bold; text-transform: uppercase; margin-bottom: 3px;">Verify Status Online:</p>
                    <p style="font-size: 11px; font-family: monospace; font-weight: bold;">https://julgaha-cycle-works.netlify.app/warranty</p>
                </div>
            </div>
        `;
    }

    setTimeout(() => {
        w.document.open();
        w.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Receipt - ${sale.receipt_no}</title>
                <style>
                    @media print { @page { margin: 0; } body { margin: 1cm; } }
                    body { font-family: 'Courier New', Courier, monospace; padding: 10px; font-size: 13px; color: #000; max-width: 320px; margin: 0 auto; }
                    h2, p { margin: 0; padding: 2px 0; }
                    hr { border-top: 1px dashed #000; border-bottom: none; margin: 15px 0; }
                    table { width: 100%; border-collapse: collapse; margin: 10px 0; }
                    th { text-align: left; border-bottom: 2px solid #000; padding-bottom: 8px; text-transform: uppercase; font-size: 11px; letter-spacing: 1px;}
                    td { font-size: 13px; }
                    .header-title { font-family: 'Arial', sans-serif; font-weight: 900; font-size: 24px; text-transform: uppercase; letter-spacing: 1px;}
                </style>
            </head>
            <body>
                <center>
                    <h2 class="header-title">Julgaha Cycle Works</h2>
                    <p style="font-size: 12px; font-family: Arial, sans-serif;">417/A, Wakwella Road, Galle</p>
                    <p style="font-size: 12px; font-family: Arial, sans-serif;">Tel: 075 633 9536</p>
                    <p style="margin-top: 10px; font-weight: bold; font-size: 14px;">Receipt: ${sale.receipt_no}</p>
                </center>
                <hr>
                <div style="font-family: Arial, sans-serif; font-size: 12px;">
                    <p>Date: ${new Date(sale.date).toLocaleString()}</p>
                    <p>Cust: <span style="font-weight:bold;">${sale.customer_name}</span></p>
                </div>
                <hr>
                <table>
                    <tr><th>Item Description</th><th style="text-align:center; width: 40px;">Qty</th><th style="text-align:right; width: 80px;">Amount</th></tr>
                    ${itemsHtml}
                </table>
                <hr>
                <div style="text-align: right; font-family: Arial, sans-serif;">
                    ${sale.service_cost > 0 ? `<p style="font-size: 13px; color: #555;">Labor/Service Charge: ${sale.service_cost.toFixed(2)}</p>` : ''}
                    <h2 style="margin-top: 10px; font-size: 22px; font-weight: 900;">TOTAL: ${sale.total_amount.toFixed(2)}</h2>
                </div>
                ${warrantyHtml}
                <hr>
                <center>
                    <p style="font-size:12px; font-weight: bold; font-family: Arial, sans-serif; text-transform: uppercase;">Thank you for riding with us!</p>
                    <p style="font-size:9px; color: #888; margin-top: 5px; font-family: Arial, sans-serif;">Powered by CycleSense Cloud ERP</p>
                </center>
                <script>window.onload = function() { window.print(); }</script>
            </body>
            </html>
        `);
        w.document.close();
    }, 200);
}

export async function deleteProduct(id) {
    if(await showCustomConfirm("Delete Item?", "Are you sure you want to permanently remove this item from the database? This cannot be undone and will affect historical references.", "danger")) {
        const sb = getSupabase();
        
        const { error } = await sb.from('products').delete().eq('id', id);
        
        if (error) {
            alert("Deletion Error: " + error.message);
        } else {
            await loadShowroom();
            await loadInventory();
        }
    }
}


// ============================================================================
// 3. INVENTORY SYSTEM (SPARE PARTS & ACCESSORIES)
// ============================================================================

export async function loadInventory() {
    try {
        inventoryData = await fetchAll('products');
        const tbody = document.getElementById('inventory-table-body');
        
        if (!tbody) return; 
        
        let htmlContent = '';
        const partsOnly = inventoryData.filter(p => p.item_type !== 'Bicycle');
        
        if (partsOnly.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center py-12 text-gray-500 font-bold uppercase tracking-widest bg-gray-50/50 dark:bg-slate-800/20">
                        <i class="fas fa-box-open text-4xl mb-3 block opacity-40"></i>
                        No inventory records found.
                    </td>
                </tr>
            `;
            return;
        }

        // --- ACTUAL ML BURN RATE DATA (Daily Consumption) ---
        const mlBurnRates = {
            "Arm": 0.143, "At Packet": 0.143, "Axle": 0.071, "Ball": 0.425, "Basket": 0.143,
            "Battery": 0.286, "Bottom Set": 1.0, "Brake Cable": 0.106, "Brake Lever": 0.273,
            "Brake Set": 0.192, "Brake Shoe": 1.27, "Cable": 0.586, "Central Axel": 0.143,
            "Central Axle": 0.237, "Central Axle Cup": 0.148, "Central Axle Resar": 0.286,
            "Central Axlecup": 2.0, "Chain": 0.264, "Changer": 0.084, "Changer Pin": 0.286,
            "Cogwheel": 0.12, "Cogwheel Set": 0.054, "Cone": 0.423, "Cup": 0.143, "Cupset": 0.143,
            "Cutter Pin": 0.143, "Fork": 0.5, "Free Changer": 0.2, "Free Wheel": 0.186,
            "Gear": 0.286, "Gear Cable": 0.222, "Gear Lever": 0.05, "Guard Wheel": 0.077,
            "Handle": 0.5, "Handle Clip": 0.31, "Handle Cupset": 0.085, "Horn": 0.143,
            "Hub": 0.164, "Hub Brake": 0.143, "Hub Cup": 0.083, "Hub Flowers": 0.286,
            "Lever": 0.059, "Mud Guard": 0.19, "Outter": 0.125, "Pedal": 0.335, "Pedal Arm": 0.095,
            "Pins": 0.143, "Piston Lever": 0.143, "Pre Changer": 0.143, "Resar": 0.308, "Rim": 0.347,
            "Rim Complete": 0.143, "Rim Lumala": 0.143, "Rim Tape": 0.143, "Seat": 0.065,
            "Seat Bar": 0.05, "Seat Haro": 0.143, "Seat Pin": 0.067, "Spoke": 9.197, "Spring": 0.143,
            "Stand": 0.077, "Tube": 0.39, "Tyre": 0.397, "Tyre sm": 0.143, "Unspecified": 0.265, "Wheel": 0.143
        };

        partsOnly.forEach(p => {
            const isLow = p.stock <= p.reorder_level;
            
            let stockClass = 'text-emerald-500 font-black text-xl';
            let badgeClass = 'bg-emerald-50 text-emerald-600 border-emerald-200';
            let badgeText = 'IN STOCK';
            
            if (isLow) {
                stockClass = 'text-red-500 font-black text-xl';
                badgeClass = 'bg-red-50 text-red-600 border-red-200';
                badgeText = 'LOW STOCK ALERT';
            }

            let aiClassBadge = '';
            let aiSafeBadge = '';
            
            if (p.ai_class) {
                let classText = p.ai_class;
                let burnRateText = "UNKNOWN";

                if (p.ai_class.toUpperCase() === 'A' || p.ai_class.toUpperCase().includes('CLASS A')) {
                    classText = 'CLASS A (VIP / TOP 70% REVENUE)';
                    burnRateText = 'HIGH BURN RATE (Fast Moving)';
                } else if (p.ai_class.toUpperCase() === 'B' || p.ai_class.toUpperCase().includes('CLASS B')) {
                    classText = 'CLASS B (STEADY / NEXT 20% REVENUE)';
                    burnRateText = 'MODERATE BURN RATE (Steady)';
                } else if (p.ai_class.toUpperCase() === 'C' || p.ai_class.toUpperCase().includes('CLASS C')) {
                    classText = 'CLASS C (SLOW / BOTTOM 10% REVENUE)';
                    burnRateText = 'LOW BURN RATE (Slow Moving)';
                }

                let dailyBurnRate = 0.1;
                const dbName = p.name.toLowerCase();
                for (const [mlKey, mlValue] of Object.entries(mlBurnRates)) {
                    if (dbName.includes(mlKey.toLowerCase())) { 
                        dailyBurnRate = mlValue; 
                        break; 
                    }
                }

                let aiSafeStock = Math.ceil(dailyBurnRate * 30);
                if (aiSafeStock < p.reorder_level) { 
                    aiSafeStock = p.reorder_level + Math.ceil(dailyBurnRate * 7); 
                }

                aiClassBadge = `
                    <div class="mt-1.5 flex flex-col gap-1">
                        <span class="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest inline-flex items-center w-max shadow-sm border border-purple-200/50">
                            <i class="fas fa-chart-pie opacity-70 mr-1.5"></i> ${classText}
                        </span>
                        <span class="text-[9px] font-bold text-gray-500 ml-1 flex items-center gap-1 mt-0.5" title="Daily Consumption: ${dailyBurnRate} units/day">
                            <i class="fas fa-fire text-orange-500"></i> ${burnRateText}
                        </span>
                    </div>`;

                aiSafeBadge = `
                    <div class="mt-1 flex items-start">
                        <span class="bg-indigo-50 text-indigo-700 px-2 py-1 rounded-md border border-indigo-200 text-[9px] font-black uppercase tracking-widest shadow-sm w-max">
                            <i class="fas fa-shield-alt text-indigo-500 mr-1"></i> AI SAFE LIMIT: ${aiSafeStock}
                        </span>
                    </div>`;
            }
            
            htmlContent += `
                <tr class="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-slate-800 transition duration-200">
                    <td class="p-4 font-mono text-xs text-gray-500 dark:text-gray-400 font-medium">${p.code}</td>
                    <td class="p-4 font-bold text-gray-800 dark:text-white">${p.name}${aiClassBadge}</td>
                    <td class="p-4">
                        <div class="flex flex-col gap-1.5">
                            <div class="flex items-center gap-3">
                                <span class="${stockClass}">${p.stock}</span>
                                <button onclick="window.posModule.promptAddStock('${p.id}')" class="text-blue-500 bg-blue-50 border border-blue-100 hover:bg-blue-500 hover:text-white dark:bg-slate-800 dark:text-blue-400 dark:border-gray-600 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition"><i class="fas fa-plus"></i> ADD</button>
                            </div>
                            ${aiSafeBadge}
                        </div>
                    </td>
                    <td class="p-4 text-center align-middle">
                        <span class="bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-gray-400 px-4 py-1.5 rounded-lg text-xs font-black shadow-inner block w-fit mx-auto">${p.reorder_level}</span>
                    </td>
                    <td class="p-4 dark:text-gray-300">
                        <div class="text-[10px] text-gray-400 font-bold mb-0.5">Buy: ${formatCurrency(p.buying_price)}</div>
                        <div class="text-xs font-black text-emerald-600 dark:text-emerald-400">Sell: ${formatCurrency(p.unit_price)}</div>
                    </td>
                    <td class="p-4 text-center">
                        <span class="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-full border shadow-sm ${badgeClass}">${badgeText}</span>
                    </td>
                </tr>`;
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
        item_type: 'Part', 
        code: form.get('code').toUpperCase().trim(), 
        name: form.get('name').trim(), 
        stock: Number(form.get('stock')), 
        reorder_level: Number(form.get('reorder_level')), 
        buying_price: Number(form.get('buying_price')), 
        unit_price: Number(form.get('unit_price')) 
    });
    
    if (error) {
        showCustomConfirm("Error Saving Product", error.message, "danger");
    } else { 
        e.target.reset(); 
        await loadInventory(); 
        showCustomConfirm("Updated", "Product added successfully.", "success-green"); 
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
    
    if (!addQty || addQty <= 0 || isNaN(addQty)) {
        return alert("Please enter a valid quantity.");
    }

    const sb = getSupabase();
    const { data: p, error: fetchError } = await sb.from('products').select('stock, name').eq('id', id).single();
    
    if (fetchError) return alert("Error: " + fetchError.message);
    
    const { error: updateError } = await sb.from('products').update({ 
        stock: (p ? p.stock : 0) + addQty,
        buying_price: parseFloat(form.get('buying_price')),
        unit_price: parseFloat(form.get('selling_price'))
    }).eq('id', id);
    
    if (updateError) {
        alert("Error: " + updateError.message);
    } else {
        document.getElementById('quick-restock-modal').classList.add('hidden');
        await loadInventory();
        showCustomConfirm("Updated", `Added ${addQty} to ${p.name}.`, "success-green");
    }
}

export async function generateRestockPDF() {
    const sb = getSupabase();
    const { data } = await sb.from('products').select('*');
    const lowStockItems = data.filter(p => p.stock <= p.reorder_level && p.item_type !== 'Bicycle');
    
    if (lowStockItems.length === 0) {
        return showCustomConfirm("Optimal", "No ordering needed at this time.", "confirm");
    }
    
    const tbody = document.getElementById('restock-table-body'); 
    let htmlContent = '';
    
    lowStockItems.forEach((p, index) => {
        const defaultQty = ((p.reorder_level * 3) - p.stock) > 0 ? ((p.reorder_level * 3) - p.stock) : 10;
        htmlContent += `
            <tr id="restock-row-${index}" class="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-slate-800 transition">
                <td class="p-3 font-mono text-xs">${p.code}</td>
                <td class="p-3 font-black">${p.name}</td>
                <td class="p-3 text-center"><span class="bg-red-100 text-red-700 px-3 py-1 rounded-lg font-black">${p.stock}</span></td>
                <td class="p-3 text-center">${p.reorder_level}</td>
                <td class="p-3 text-center"><input type="number" min="1" class="w-24 border-2 border-blue-200 rounded-lg p-2 text-center dark:bg-slate-700 dark:text-white" value="${defaultQty}"></td>
                <td class="p-3 text-center"><button onclick="document.getElementById('restock-row-${index}').remove()" class="text-red-500 bg-red-50 p-2.5 rounded-lg"><i class="fas fa-times"></i></button></td>
            </tr>`;
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
                <td style="padding:12px; border:1px solid #ccc; font-family:monospace;">${cols[0].innerText}</td>
                <td style="padding:12px; border:1px solid #ccc; font-weight:bold;">${cols[1].innerText}</td>
                <td style="text-align:center; padding:12px; border:1px solid #ccc; color:red;">${cols[2].innerText}</td>
                <td style="text-align:center; padding:12px; border:1px solid #ccc; color:blue; background:#f0f8ff; font-weight:bold; font-size:18px;">${orderQty}</td>
                <td style="border:1px solid #ccc;"></td>
            </tr>`;
    });

    const printWindow = window.open('', '', 'width=850,height=800');
    if (printWindow) {
        setTimeout(() => {
            printWindow.document.open();
            printWindow.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Restock List</title>
                    <style>
                        body { font-family: 'Segoe UI', sans-serif; padding: 30px; color: #333; } 
                        table { width: 100%; border-collapse: collapse; margin-top: 20px; } 
                        th { background: #f8fafc; padding: 15px 10px; border: 1px solid #ccc; text-align: left; text-transform: uppercase; font-size: 12px; }
                        h2 { margin:0; font-size: 24px; text-transform: uppercase; }
                        p { margin: 5px 0; font-size: 14px; }
                    </style>
                </head>
                <body>
                    <h2>CycleSense Inventory Restock</h2>
                    <p style="font-weight: bold; margin-bottom: 20px;">Date: ${new Date().toLocaleDateString()}</p>
                    <p style="color: #555; margin-bottom: 20px;">Julgaha Cycle Works - 417/A, Wakwella Road, Galle</p>
                    <table>
                        <thead>
                            <tr>
                                <th>Item Code</th>
                                <th>Product Description</th>
                                <th style="text-align:center;">Current Stock</th>
                                <th style="text-align:center;">Order Qty</th>
                                <th style="text-align:center;">Supplier Check</th>
                            </tr>
                        </thead>
                        <tbody>${printRows}</tbody>
                    </table>
                    <div style="margin-top: 50px; display: flex; justify-content: space-between; width: 60%;">
                        <div style="border-top: 1px solid #000; width: 200px; text-align: center; padding-top: 10px; font-size: 12px;">Authorized Signature</div>
                        <div style="border-top: 1px solid #000; width: 200px; text-align: center; padding-top: 10px; font-size: 12px;">Date Received</div>
                    </div>
                    <script>window.onload=function(){window.print();}</script>
                </body>
                </html>
            `);
            printWindow.document.close();
        }, 300);
    }
}


// ============================================================================
// 4. REPORTS & SALES TRACKING
// ============================================================================

let allSales = [];

export async function openReportModal() { 
    document.getElementById('sales-report-modal').classList.remove('hidden'); 
    const sb = getSupabase();
    const { data, error } = await sb.from('sales').select('*').order('date', { ascending: false }); 
    
    if (error) console.error("Error loading sales:", error);
    
    allSales = data || []; 
    filterSales('today'); 
}

export function closeReportModal() { 
    document.getElementById('sales-report-modal').classList.add('hidden'); 
}

export function filterSales(period) {
    const t = document.getElementById('report-table-body'); 
    if (!t) return; 
    
    let htmlContent = ''; 
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

    if (filtered.length === 0) {
        htmlContent = `<tr><td colspan="5" class="p-8 text-center text-gray-500 font-bold uppercase tracking-widest bg-gray-50 dark:bg-slate-800/50">No sales recorded.</td></tr>`;
    } else {
        filtered.forEach(s => {
            totalRevenue += Number(s.total_amount); 
            htmlContent += `
                <tr class="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-slate-800 transition">
                    <td class="p-3">${new Date(s.date).toLocaleDateString()}</td>
                    <td class="p-3 font-mono text-blue-600 font-bold">${s.receipt_no || s.id}</td>
                    <td class="p-3 font-bold">${s.customer_name}</td>
                    <td class="p-3 text-right font-black text-green-600">${formatCurrency(s.total_amount)}</td>
                    <td class="p-3 text-center flex justify-center gap-2">
                        <button onclick="window.posModule.reprintSaleBill('${s.id}')" class="text-blue-500 bg-blue-50 w-10 h-10 rounded-lg hover:bg-blue-500 hover:text-white transition"><i class="fas fa-print"></i></button>
                        <button onclick="window.posModule.deleteSale('${s.id}')" class="text-red-500 bg-red-50 w-10 h-10 rounded-lg hover:bg-red-500 hover:text-white transition"><i class="fas fa-ban"></i></button>
                    </td>
                </tr>`;
        });
    }
    
    t.innerHTML = htmlContent;
    document.getElementById('report-total-sales').innerText = formatCurrency(totalRevenue);
}

export async function reprintSaleBill(saleId) {
    const w = window.open('', '', 'width=450,height=700');
    if(w) {
        w.document.write(`
            <div style="font-family: sans-serif; text-align: center; margin-top: 50px;">
                <h2 style="color: #6366f1;">Retrieving Document...</h2>
                <p style="color: #666;">Accessing secure vault in CycleSense Cloud.</p>
            </div>
        `);
    }

    const sb = getSupabase();
    const { data: sale } = await sb.from('sales').select('*').eq('id', saleId).single();
    
    if (!sale) {
        if(w) w.close();
        return alert("Error: Sale record not found in database.");
    }

    const { data: items } = await sb.from('sale_items').select('*, products(name)').eq('sale_id', saleId);
    
    const formattedItems = (items || []).map(i => ({
        name: i.products ? i.products.name : 'Unknown/Deleted Item',
        qty: i.quantity,
        price: i.price
    }));

    if (w) populateBill(w, sale, formattedItems, sale.warranty_serial, sale.warranty_exp);
}

export async function deleteSale(id) { 
    if (await showCustomConfirm("Void Sales Record?", "Are you absolutely sure? This will remove the sale permanently and restore stock.", "danger")) { 
        
        const sb = getSupabase();
        const { data: items } = await sb.from('sale_items').select('*').eq('sale_id', id);
        
        if (items && items.length > 0) {
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
        
        showCustomConfirm("Sale Voided", "The record has been deleted and stock levels have been restored.", "success-green");
    } 
}


// ============================================================================
// 5. REPAIRS WORKSHOP SYSTEM
// ============================================================================

let repairsData = []; 
let repairCart = []; 
let currentRepairId = null; 

export async function loadRepairs() { 
    const sb = getSupabase();
    const { data } = await sb.from('repairs').select('*').order('id', { ascending: false }); 
    repairsData = data || []; 
    
    const dateInput = document.querySelector('input[name="predicted_date"]');
    if (dateInput) {
        dateInput.setAttribute('min', new Date().toISOString().split('T')[0]);
    }
    filterRepairs(); 
}

export function filterRepairs() {
    const filter = document.getElementById('repair-filter')?.value || 'all'; 
    const tbody = document.getElementById('repairs-table-body'); 
    if (!tbody) return; 

    const filtered = repairsData.filter(r => {
        if (filter === 'pending') return r.status === 'Pending' || r.status === 'Under Repair'; 
        if (filter === 'completed') return r.status === 'Completed'; 
        if (filter === 'collected') return r.status === 'Collected'; 
        return true;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center py-12 text-gray-500 font-bold uppercase bg-gray-50 dark:bg-slate-800/50">No tickets found.</td></tr>`;
        return;
    }

    let htmlContent = '';
    filtered.forEach(r => {
        let statusHtml = ''; let rowClass = ''; let actionsHtml = '';
        
        if (r.status === 'Pending') {
            rowClass = 'bg-red-50 border-l-4 border-red-500 dark:bg-red-900/10';
            statusHtml = `<button onclick="window.posModule.startRepair('${r.id}')" class="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-2 rounded-xl text-[10px] uppercase font-black w-full shadow-md transition">Start Repair</button>`;
        } else if (r.status === 'Under Repair' || r.status === 'In Progress') {
            rowClass = 'bg-yellow-50 border-l-4 border-yellow-500 dark:bg-yellow-900/10';
            statusHtml = `<button onclick="window.posModule.openCompleteRepairModal('${r.id}')" class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-xl text-[10px] uppercase font-black w-full shadow-md transition">Finish & Bill</button>`;
        } else if (r.status === 'Completed') {
            rowClass = 'bg-blue-50 border-l-4 border-blue-500 dark:bg-blue-900/10';
            statusHtml = `<button onclick="window.posModule.markAsCollected('${r.id}')" class="bg-green-500 hover:bg-green-600 text-white px-3 py-2 rounded-xl text-[10px] uppercase font-black w-full shadow-md transition">Collect & Pay</button>`;
        } else {
            rowClass = 'opacity-60 border-l-4 border-green-500 dark:bg-slate-800';
            statusHtml = `<span class="bg-green-100 text-green-800 px-3 py-2 rounded-xl text-[10px] font-black block text-center border border-green-200">Collected</span>`;
        }

        actionsHtml = `
            <button onclick="window.posModule.editRepair('${r.id}')" class="text-blue-500 hover:text-white hover:bg-blue-500 bg-white dark:bg-slate-700 w-10 h-10 rounded-lg shadow-sm transition"><i class="fas fa-edit"></i></button>
            <button onclick="window.posModule.printRepairTicket('${r.id}')" class="text-gray-600 hover:text-white hover:bg-gray-600 bg-white dark:bg-slate-700 w-10 h-10 rounded-lg shadow-sm transition"><i class="fas fa-print"></i></button>
            <button onclick="window.posModule.deleteRepair('${r.id}')" class="text-red-500 hover:text-white hover:bg-red-500 bg-white dark:bg-slate-700 w-10 h-10 rounded-lg shadow-sm transition"><i class="fas fa-trash"></i></button>
        `;

        if (r.status === 'Completed' || r.status === 'Collected') {
            actionsHtml = `
                <button onclick="window.posModule.reprintFinalBill('${r.id}')" class="text-gray-700 bg-white dark:bg-slate-700 border border-gray-200 dark:border-gray-600 hover:bg-gray-800 hover:text-white dark:text-white py-2 px-4 rounded-xl transition text-xs font-black tracking-widest uppercase w-full flex items-center justify-center gap-2 shadow-sm">
                    <i class="fas fa-receipt"></i> Print Bill
                </button>
            `;
        }

        htmlContent += `<tr class="${rowClass} border-b dark:border-gray-700">
            <td class="p-4 font-mono font-black text-indigo-600 dark:text-indigo-400">${r.repair_id}</td>
            <td class="p-4 font-bold dark:text-white">${r.customer_name}</td>
            <td class="p-4 dark:text-gray-300"><i class="fas fa-phone text-xs text-gray-400 mr-1"></i> ${r.phone}</td>
            <td class="p-4 font-black text-green-600">${formatCurrency(r.advance)}</td>
            <td class="p-4 font-bold text-gray-600 dark:text-gray-400"><i class="far fa-calendar-alt mr-1"></i> ${new Date(r.predicted_date).toLocaleDateString()}</td>
            <td class="p-4 w-40 align-middle">${statusHtml}</td>
            <td class="p-4 flex gap-2 justify-center">${actionsHtml}</td>
        </tr>`;
    });
    
    tbody.innerHTML = htmlContent;
}

export async function startRepair(id) {
    const { error } = await getSupabase().from('repairs').update({ status: 'Under Repair' }).eq('id', id);
    if (!error) {
        await loadRepairs();
    } else {
        alert("Error: " + error.message);
    }
}

export async function markAsCollected(id) {
    if (await showCustomConfirm("Collect & Pay", "Confirm payment and collection of bicycle.", "confirm")) {
        await getSupabase().from('repairs').update({ status: 'Collected' }).eq('id', id);
        await loadRepairs();
    }
}

export async function deleteRepair(id) { 
    if (await showCustomConfirm("Delete Ticket?", "Are you sure you want to delete this repair permanently?", "danger")) { 
        await getSupabase().from('repairs').delete().eq('id', id); 
        await loadRepairs(); 
    } 
}

export async function addRepair(e) { 
    e.preventDefault(); 
    const form = new FormData(e.target); 
    const repairId = 'REP-' + Math.floor(100000 + Math.random() * 900000); 
    
    const w = window.open('', '', 'width=450,height=700');
    if (w) w.document.write(`<div style="text-align: center; margin-top: 50px; font-family: sans-serif;"><h2 style="color: #3b82f6;">Generating Ticket...</h2></div>`);
    
    const { data, error } = await getSupabase().from('repairs').insert({ 
        repair_id: repairId, 
        customer_name: form.get('customer_name').trim(), 
        phone: form.get('phone').trim(), 
        advance: Number(form.get('advance')), 
        predicted_date: form.get('predicted_date'), 
        status: 'Pending'
    }).select().single(); 
    
    if (error) {
        if(w) w.close();
        alert("Error: " + error.message);
    } else { 
        e.target.reset(); 
        if (w) populateRepairTicket(w, data);
        await loadRepairs(); 
        showCustomConfirm("Created", "Repair ticket generated.", "success-green"); 
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
    
    const { error } = await getSupabase().from('repairs').update({ 
        customer_name: document.getElementById('edit-repair-customer').value.trim(), 
        phone: document.getElementById('edit-repair-phone').value.trim(), 
        advance: parseFloat(document.getElementById('edit-repair-advance').value), 
        predicted_date: document.getElementById('edit-repair-date').value 
    }).eq('id', id); 
    
    if (!error) { 
        document.getElementById('repair-edit-modal').classList.add('hidden'); 
        await loadRepairs(); 
        showCustomConfirm("Updated", "Repair modified successfully.", "success-green");
    } else {
        alert("Error: " + error.message);
    }
}

export async function openCompleteRepairModal(id) {
    currentRepairId = id; 
    repairCart = []; 
    document.getElementById('rep-labor').value = ''; 
    
    const { data: r } = await getSupabase().from('repairs').select('*').eq('id', id).single();
    
    document.getElementById('rep-modal-customer').innerText = r.customer_name; 
    document.getElementById('rep-modal-adv').innerText = formatCurrency(r.advance);
    document.getElementById('repair-finalize-modal').classList.remove('hidden'); 
    
    const select = document.getElementById('rep-part-select'); 
    select.innerHTML = '<option value="">Select Replacement Part...</option>';
    
    const prods = await fetchAll('products'); 
    prods.filter(p => p.item_type !== 'Bicycle').forEach(p => { 
        select.innerHTML += `<option value="${p.id}" data-price="${p.unit_price}" data-name="${p.name}" ${p.stock<=0?'disabled':''}>${p.name} (${p.stock<=0?'OUT':'Stock: '+p.stock}) - ${formatCurrency(p.unit_price)}</option>`; 
    });
    
    recalcRepairTotal();
}

export function addRepairPart() { 
    const select = document.getElementById('rep-part-select'); 
    const qtyInput = document.getElementById('rep-part-qty').value;
    
    if (!select.value) return;
    
    const option = select.options[select.selectedIndex];
    const existingPart = repairCart.find(i => i.id === select.value);
    
    if (existingPart) {
        existingPart.qty += parseInt(qtyInput);
    } else {
        repairCart.push({ 
            id: select.value, 
            name: option.getAttribute('data-name'), 
            price: parseFloat(option.getAttribute('data-price')), 
            qty: parseInt(qtyInput) 
        }); 
    }
    
    document.getElementById('rep-part-qty').value = 1; 
    select.value = "";
    recalcRepairTotal(); 
}

export function recalcRepairTotal() {
    const tbody = document.getElementById('rep-parts-body'); 
    tbody.innerHTML = ''; 
    let totalParts = 0; 
    
    if (repairCart.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" class="p-3 text-center text-gray-400 italic text-xs">No replacement parts added.</td></tr>`;
    } else {
        repairCart.forEach(item => { 
            const rowTotal = item.price * item.qty; 
            totalParts += rowTotal; 
            tbody.innerHTML += `<tr class="border-b dark:border-gray-700"><td class="p-2 font-bold">${item.name}</td><td class="p-2 text-center"><span class="bg-blue-100 text-blue-800 px-2 rounded font-black">${item.qty}</span></td><td class="p-2 text-right text-green-600 font-bold">${formatCurrency(rowTotal)}</td></tr>`; 
        }); 
    }
    
    const advanceAmount = parseFloat(document.getElementById('rep-modal-adv').innerText.replace(/[^\d.]/g, '')) || 0;
    const laborCost = parseFloat(document.getElementById('rep-labor').value || 0);
    document.getElementById('rep-total-due').innerText = formatCurrency((totalParts + laborCost) - advanceAmount); 
}

export async function finalizeRepair() { 
    const sb = getSupabase();
    const labor = parseFloat(document.getElementById('rep-labor').value || 0); 
    const { data: repair } = await sb.from('repairs').select('*').eq('id', currentRepairId).single(); 
    
    const partsTotal = repairCart.reduce((sum, item) => sum + (item.price * item.qty), 0); 
    const finalTotalAmount = partsTotal + labor; 
    const balanceDue = finalTotalAmount - repair.advance;
    
    const w = window.open('', '', 'width=450,height=700');
    if (w) w.document.write(`<div style="text-align: center; margin-top: 50px; font-family: sans-serif;"><h2 style="color: #10b981;">Finalizing Repair...</h2></div>`);

    // Log Revenue to Sales Table
    const { data: sale } = await sb.from('sales').insert({ 
        receipt_no: "REP-" + Date.now().toString().slice(-8), 
        customer_name: repair.customer_name + " (Repair)", 
        phone: repair.phone, 
        service_cost: labor, 
        total_amount: finalTotalAmount, 
        date: new Date().toISOString() 
    }).select().single();
    
    if (repairCart.length > 0) {
        await sb.from('sale_items').insert(repairCart.map(i => ({ sale_id: sale.id, product_id: i.id, quantity: i.qty, price: i.price })));
        
        for (let item of repairCart) { 
            const { data: p } = await sb.from('products').select('stock').eq('id', item.id).single();
            if (p) await sb.from('products').update({ stock: p.stock - item.qty }).eq('id', item.id);
        }
    }

    await sb.from('repairs').update({ 
        status: 'Completed', 
        final_amount: finalTotalAmount, 
        balance_due: balanceDue, 
        parts_used: JSON.stringify(repairCart) 
    }).eq('id', currentRepairId); 
    
    document.getElementById('repair-finalize-modal').classList.add('hidden'); 
    
    const { data: freshRepair } = await sb.from('repairs').select('*').eq('id', currentRepairId).single();
    if (w) populateFinalBill(w, freshRepair);
    
    await loadRepairs(); 
    await loadInventory(); 
    showCustomConfirm("Completed", "Repair closed successfully.", "success-green"); 
}

export function printRepairTicket(id) {
    const repair = repairsData.find(x => String(x.id) === String(id));
    if (!repair) return;
    const w = window.open('', '', 'width=450,height=700');
    if (w) populateRepairTicket(w, repair);
}

function populateRepairTicket(w, repair) {
    const websiteUrl = "https://julgaha-cycle-works.netlify.app/track";
    setTimeout(() => {
        w.document.open();
        w.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Repair Ticket - ${repair.repair_id}</title>
                <style>
                    body { font-family: 'Courier New', monospace; padding: 20px; text-align: center; max-width: 320px; margin: 0 auto; color: #000; } 
                    .box { border: 3px dashed #000; padding: 20px 10px; margin: 20px 0; background: #f9f9f9; } 
                    .id { font-size: 28px; font-weight: 900; letter-spacing: 2px; } 
                    p { margin: 5px 0; font-size: 14px; }
                    .row { display: flex; justify-content: space-between; border-bottom: 1px dotted #ccc; padding: 5px 0;}
                    .label { font-weight: bold; text-transform: uppercase; font-size: 12px;}
                </style>
            </head>
            <body>
                <h2 style="font-family: Arial, sans-serif; font-weight: 900; text-transform: uppercase; margin-bottom: 5px;">Julgaha Cycle Works</h2>
                <p style="font-size: 12px; font-family: Arial, sans-serif;">417/A, Wakwella Road, Galle</p>
                <p style="font-size: 12px; font-family: Arial, sans-serif;">Workshop Service Ticket</p>
                <p style="font-size: 12px; font-family: Arial, sans-serif;">Date: ${new Date().toLocaleDateString()}</p>
                
                <div class="box">
                    <p style="margin-bottom:5px; font-size:12px; text-transform: uppercase; font-weight: bold; letter-spacing: 1px;">Service ID</p>
                    <div class="id">${repair.repair_id}</div>
                </div>
                
                <div class="row"><span class="label">Customer</span><span>${repair.customer_name}</span></div>
                <div class="row"><span class="label">Phone</span><span>${repair.phone}</span></div>
                <div class="row"><span class="label">Est. Finish</span><span style="font-weight: bold;">${new Date(repair.predicted_date).toLocaleDateString()}</span></div>
                <div class="row"><span class="label">Advance Paid</span><span style="font-weight: bold; color: green;">${formatCurrency(repair.advance)}</span></div>
                
                <hr style="margin: 25px 0; border-top: 2px solid #000;">
                
                <div style="background-color: #000; color: #fff; padding: 15px; border-radius: 10px;">
                    <h3 style="margin: 0 0 10px 0; font-family: Arial, sans-serif; text-transform: uppercase;">Track Live Status</h3>
                    <p style="font-size: 12px; margin-bottom: 5px;">Visit our portal:</p>
                    <p style="font-weight:bold; font-size: 14px; font-family: Arial, sans-serif;">${websiteUrl}</p>
                    <p style="font-size: 12px; margin-top: 10px;">Enter your Ticket ID online to see live updates.</p>
                </div>
                
                <script>window.onload = function() { window.print(); }</script>
            </body>
            </html>
        `);
        w.document.close();
    }, 200);
}

export function reprintFinalBill(id) {
    const r = repairsData.find(x => String(x.id) === String(id));
    if (!r) return;
    const w = window.open('', '', 'width=450,height=700');
    if (w) populateFinalBill(w, r);
}

function populateFinalBill(w, r) {
    let partsHtml = '';
    if (r.parts_used) {
        const parts = typeof r.parts_used === 'string' ? JSON.parse(r.parts_used) : r.parts_used;
        if (parts && parts.length > 0) {
            partsHtml = parts.map(i => `<tr><td style="padding: 8px 0; border-bottom: 1px dotted #ccc;">${i.name}</td><td align="center" style="padding: 8px 0; border-bottom: 1px dotted #ccc;">${i.qty}</td><td align="right" style="padding: 8px 0; border-bottom: 1px dotted #ccc;">${(i.price * i.qty).toFixed(2)}</td></tr>`).join('');
        }
    }
    if (partsHtml === '') {
        partsHtml = `<tr><td colspan="3" align="center" style="font-style:italic; padding: 15px 0; color: #666; border-bottom: 1px dotted #ccc;">Service / Labor Only</td></tr>`;
    }

    setTimeout(() => {
        w.document.open();
        w.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Final Bill - ${r.repair_id}</title>
                <style>
                    @media print { @page { margin: 0; } body { margin: 1cm; } }
                    body { font-family: 'Courier New', Courier, monospace; padding: 10px; font-size: 13px; color: #000; max-width: 320px; margin: 0 auto; }
                    h2, p { margin: 0; padding: 2px 0; }
                    hr { border-top: 1px dashed #000; border-bottom: none; margin: 15px 0; }
                    table { width: 100%; border-collapse: collapse; margin: 10px 0; }
                    th { text-align: left; border-bottom: 2px solid #000; padding-bottom: 8px; text-transform: uppercase; font-size: 11px;}
                    td { font-size: 13px; }
                    .header-title { font-family: 'Arial', sans-serif; font-weight: 900; font-size: 22px; text-transform: uppercase; letter-spacing: 1px;}
                </style>
            </head>
            <body>
                <center>
                    <h2 class="header-title">Julgaha Cycle Works</h2>
                    <p style="font-size: 12px; font-family: Arial, sans-serif;">417/A, Wakwella Road, Galle</p>
                    <p style="font-size: 12px; font-family: Arial, sans-serif;">Workshop Final Bill</p>
                    <p style="font-size: 12px; font-family: Arial, sans-serif;">Tel: 075 633 9536</p>
                    <p style="margin-top: 10px; font-weight: bold; font-size: 14px; background: #000; color: #fff; padding: 5px;">TICKET: ${r.repair_id}</p>
                </center>
                <hr>
                <div style="font-family: Arial, sans-serif; font-size: 12px;">
                    <p>Cust: <span style="font-weight:bold;">${r.customer_name}</span></p>
                    <p>Phone: ${r.phone}</p>
                    <p>Completed: ${new Date().toLocaleDateString()}</p>
                </div>
                <hr>
                <table>
                    <tr><th>Item/Service</th><th style="text-align:center; width: 40px;">Qty</th><th style="text-align:right; width: 80px;">Amount</th></tr>
                    ${partsHtml}
                </table>
                <hr>
                <div style="text-align: right; font-family: Arial, sans-serif;">
                    <p style="font-size: 14px; font-weight: bold; margin-bottom: 5px;">Total Amount: ${formatCurrency(r.final_amount)}</p>
                    <p style="color: #d32f2f; font-size: 13px; border-bottom: 1px solid #000; padding-bottom: 5px; display: inline-block;">Advance Paid: -${formatCurrency(r.advance)}</p>
                    <h2 style="margin-top: 10px; font-size: 20px; font-weight: 900;">BALANCE DUE: <br>${formatCurrency(r.balance_due)}</h2>
                </div>
                <hr>
                <center>
                    <p style="font-size:12px; font-weight: bold; font-family: Arial, sans-serif; text-transform: uppercase;">Thank you for riding with us!</p>
                </center>
                <script>window.onload = function() { window.print(); }</script>
            </body>
            </html>
        `);
        w.document.close();
    }, 200);
}


// ============================================================================
// 6. HR, PAYROLL & ATTENDANCE SYSTEM
// ============================================================================

let workersData = [];

export async function loadHR() {
    try {
        const sb = getSupabase();
        const { data, error } = await sb.from('workers').select('*').order('id', { ascending: false });
        
        if (error) {
            console.error("Error fetching workers:", error);
            return;
        }

        workersData = data || [];
        
        const list = document.getElementById('workers-list');
        if (!list) return; 
        
        let optionsHtml = '<option value="">Select Employee...</option>';
        let htmlContent = '';

        if (workersData.length === 0) {
            htmlContent = `
                <div class="text-center py-10 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl">
                    <i class="fas fa-users text-4xl text-gray-300 dark:text-gray-600 mb-3"></i>
                    <p class="text-gray-500 font-bold uppercase tracking-widest text-sm">No employees hired yet.</p>
                </div>
            `;
        } else {
            workersData.forEach(w => {
                htmlContent += `
                    <div class="p-5 bg-white dark:bg-slate-700 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-600 hover:shadow-md transition group">
                        <div class="flex justify-between items-start">
                            <div>
                                <h4 class="font-black text-gray-800 dark:text-white text-lg">${w.name}</h4>
                                <p class="text-xs text-gray-500 mt-1 font-medium"><i class="fas fa-phone text-gray-400"></i> ${w.phone || 'N/A'}</p>
                                <div class="bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-black px-3 py-1.5 rounded-lg border border-green-100 dark:border-green-800 mt-3 inline-block shadow-sm">
                                    ${formatCurrency(w.daily_salary)} <span class="text-[10px] font-bold text-green-600/70 dark:text-green-500/70">/ DAY</span>
                                </div>
                            </div>
                            <div class="flex flex-col gap-2">
                                <div class="flex gap-2 justify-end">
                                    <button type="button" onclick="window.posModule.viewWorkerProfile('${w.id}')" class="text-purple-600 hover:text-white hover:bg-purple-600 bg-purple-50 dark:bg-slate-600 dark:text-purple-400 w-10 h-10 rounded-xl transition shadow-sm"><i class="fas fa-id-card"></i></button>
                                    <button type="button" onclick="window.posModule.viewWorkerAttendance('${w.id}')" class="text-blue-600 hover:text-white hover:bg-blue-600 bg-blue-50 dark:bg-slate-600 dark:text-blue-400 w-10 h-10 rounded-xl transition shadow-sm"><i class="fas fa-chart-line"></i></button>
                                    <button type="button" onclick="window.posModule.openEditWorker('${w.id}')" class="text-gray-600 hover:text-white hover:bg-gray-600 bg-gray-100 dark:bg-slate-600 dark:text-gray-300 w-10 h-10 rounded-xl transition shadow-sm"><i class="fas fa-edit"></i></button>
                                    <button type="button" onclick="window.posModule.deleteWorker('${w.id}')" class="text-red-500 hover:text-white hover:bg-red-600 bg-red-50 dark:bg-slate-600 dark:text-red-400 w-10 h-10 rounded-xl transition shadow-sm"><i class="fas fa-user-minus"></i></button>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
                optionsHtml += `<option value="${w.id}">${w.worker_uid} - ${w.name}</option>`;
            });
        }
        
        list.innerHTML = htmlContent;

        if (document.getElementById('hr-att-worker')) document.getElementById('hr-att-worker').innerHTML = optionsHtml;
        if (document.getElementById('hr-adv-worker')) document.getElementById('hr-adv-worker').innerHTML = optionsHtml;
        if (document.getElementById('hr-pay-worker')) document.getElementById('hr-pay-worker').innerHTML = optionsHtml;
        
        const todayStr = new Date().toISOString().split('T')[0];
        if (document.getElementById('hr-att-date')) document.getElementById('hr-att-date').value = todayStr;
        if (document.getElementById('hr-adv-date')) document.getElementById('hr-adv-date').value = todayStr;

        loadHRDashboardSummary();
    } catch (err) {
        console.error("Error loading HR Module:", err);
    }
}

export function viewWorkerProfile(id) {
    const w = workersData.find(x => String(x.id) === String(id)); 
    if (!w) return;
    
    document.getElementById('vp-name').innerText = w.name;
    document.getElementById('vp-id').innerText = w.worker_uid || w.id;
    document.getElementById('vp-pin').innerText = w.pin || '1234';
    document.getElementById('vp-phone').innerText = w.phone || 'N/A';
    document.getElementById('vp-nic').innerText = w.nic || 'N/A';
    
    if (w.dob) document.getElementById('vp-dob').innerText = new Date(w.dob).toLocaleDateString();
    else document.getElementById('vp-dob').innerText = 'N/A';
    
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

    // --- AUTOMATED ALERTS LOGIC ---
    let birthdayMessages = "";
    workersData.forEach(w => {
        if (w.dob) {
            const parts = w.dob.split('-');
            if (parts.length === 3) {
                if (parts[1] === month && parseInt(parts[2]) === today.getDate()) { 
                    birthdayMessages += `🎉 Happy Birthday to ${w.name}! `; 
                }
            }
        }
    });
    
    const bdayAlertEl = document.getElementById('bday-alert');
    if (bdayAlertEl) {
        if (birthdayMessages !== "") { 
            bdayAlertEl.classList.remove('hidden'); 
            bdayAlertEl.innerHTML = `<div class="flex items-center justify-center gap-3"><i class="fas fa-birthday-cake text-2xl"></i> <span>${birthdayMessages}</span></div>`; 
        } else { 
            bdayAlertEl.classList.add('hidden'); 
        }
    }

    const salAlertEl = document.getElementById('salary-alert');
    if (salAlertEl) {
        if (today.getDate() >= 18 && today.getDate() <= 25) {
            salAlertEl.classList.remove('hidden');
            salAlertEl.innerHTML = `<div class="flex items-center justify-center gap-3"><i class="fas fa-exclamation-triangle text-2xl"></i> <span>Notice: Salary Date is approaching (25th). Please review attendance and prepare payroll slips.</span></div>`;
        } else { 
            salAlertEl.classList.add('hidden'); 
        }
    }

    // --- ACCRUED PAYROLL CALCULATION ---
    const { data: attData } = await sb.from('attendance').select('*').gte('date', startOfMonth).lte('date', todayStr);
    const { data: advData } = await sb.from('advances').select('*').gte('date', startOfMonth).lte('date', todayStr);

    let totalAccruedGross = 0; 
    let totalAdvancesGiven = 0;
    
    if (advData) advData.forEach(a => totalAdvancesGiven += Number(a.amount));

    workersData.forEach(w => {
        const myAtt = (attData || []).filter(a => String(a.worker_id) === String(w.id));
        let myGross = 0;
        
        myAtt.forEach(a => {
            if (a.status === 'Full Day' || a.status === 'Short Leave') myGross += w.daily_salary;
            else if (a.status === 'Half Day') myGross += (w.daily_salary / 2);

            if (a.status === 'Full Day' && a.in_time && a.out_time) {
                const parseTime = t => { const [hr, mn] = t.split(':').map(Number); return hr * 60 + mn; };
                const inMins = parseTime(a.in_time); 
                const outMins = parseTime(a.out_time);
                
                let missedMins = 0;
                if (inMins > 600) missedMins += (inMins - 600); // 10:00 AM
                if (outMins < 1020) missedMins += (1020 - outMins); // 5:00 PM
                
                if (missedMins > 0) {
                    const ratePerMin = w.daily_salary / 420; // 7 hour shift
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

    if (document.getElementById('accrued-gross')) document.getElementById('accrued-gross').innerText = formatCurrency(totalAccruedGross);
    if (document.getElementById('accrued-advances')) document.getElementById('accrued-advances').innerText = "- " + formatCurrency(totalAdvancesGiven);
    if (document.getElementById('accrued-net')) document.getElementById('accrued-net').innerText = formatCurrency(netPayableCurrent);
    if (document.getElementById('accrued-epf')) document.getElementById('accrued-epf').innerText = formatCurrency(epfEmployerPortion + epfEmployeePortion);
    if (document.getElementById('accrued-etf')) document.getElementById('accrued-etf').innerText = formatCurrency(etfEmployerPortion);
}

export async function addWorker(e) {
    e.preventDefault(); 
    const sb = getSupabase();
    const form = new FormData(e.target);
    const year = new Date().getFullYear();
    
    const { data: lastWorker } = await sb.from('workers').select('worker_uid').ilike('worker_uid', `W${year}%`).order('worker_uid', { ascending: false }).limit(1);

    let nextNumber = 1;
    if (lastWorker && lastWorker.length > 0 && lastWorker[0].worker_uid) {
        nextNumber = parseInt(lastWorker[0].worker_uid.slice(-3)) + 1;
    }
    
    const generatedUid = `W${year}${String(nextNumber).padStart(3, '0')}`;
    const generatedPin = Math.floor(1000 + Math.random() * 9000).toString();

    const { error } = await sb.from('workers').insert({ 
        worker_uid: generatedUid, name: form.get('name').trim(), phone: form.get('phone').trim(), 
        nic: form.get('nic').trim() || null, dob: form.get('dob') || null, 
        address: form.get('address').trim() || null, daily_salary: Number(form.get('daily_salary')), pin: generatedPin 
    });
    
    if (error) alert("Database Error: " + error.message);
    else { 
        e.target.reset(); await loadHR(); 
        showCustomConfirm("Employee Hired!", `Profile Created Successfully.\n\nPortal Login ID: ${generatedUid}\nGenerated PIN: ${generatedPin}\n\nPlease provide these credentials to the employee.`, "confirm"); 
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
    document.getElementById('ew-salary').value = w.daily_salary; 
    document.getElementById('ew-pin').value = w.pin || '1234';
    document.getElementById('edit-worker-modal').classList.remove('hidden');
}

export async function saveEditWorker(e) {
    e.preventDefault(); 
    const sb = getSupabase();
    const form = new FormData(e.target);
    
    const { error } = await sb.from('workers').update({ 
        name: form.get('name').trim(), phone: form.get('phone').trim(), 
        nic: form.get('nic').trim() || null, dob: form.get('dob') || null, 
        daily_salary: Number(form.get('salary')), pin: form.get('pin').trim() 
    }).eq('id', form.get('id'));
    
    if (error) alert("Update Error: " + error.message);
    else { 
        document.getElementById('edit-worker-modal').classList.add('hidden'); 
        await loadHR(); 
        showCustomConfirm("Success", "Worker details and portal credentials updated.", "success-green"); 
    }
}

export async function deleteWorker(id) { 
    if (await showCustomConfirm("Terminate Employee?", "Are you sure you want to permanently delete this worker? This will remove all their historical attendance and advance records.", "danger")) { 
        const sb = getSupabase();
        await sb.from('attendance').delete().eq('worker_id', id);
        await sb.from('advances').delete().eq('worker_id', id);
        
        const { error } = await sb.from('workers').delete().eq('id', id); 
        if (error) alert("Error deleting worker: " + error.message);
        else await loadHR(); 
    } 
}

export async function markAttendance(e) {
    e.preventDefault(); 
    const sb = getSupabase();
    const form = new FormData(e.target); 
    const wId = form.get('worker_id'); const d = form.get('date');
    
    await sb.from('attendance').delete().match({ worker_id: wId, date: d });
    const { error } = await sb.from('attendance').insert({ 
        worker_id: wId, date: d, status: form.get('status'), in_time: form.get('in_time'), out_time: form.get('out_time') 
    });
    
    if (error) alert("Database Error: " + error.message);
    else { 
        e.target.reset(); 
        document.getElementById('hr-att-date').value = new Date().toISOString().split('T')[0]; 
        await loadHRDashboardSummary(); 
        showCustomConfirm("Attendance Logged", "The daily log has been updated successfully.", "success-green"); 
    }
}
export async function addAdvance(event) {
  event.preventDefault();
  const form = event.target;
  const formData = new FormData(form);
  
  const worker_id = formData.get("worker_id");
  const dateStr = formData.get("date");
  const amount = parseFloat(formData.get("amount"));
  
  if (!worker_id || !dateStr || isNaN(amount) || amount <= 0) {
      await showCustomConfirm("Error", "Please fill all fields correctly.", "danger");
      return;
  }

  const sb = getSupabase();
  if (!sb) return;

  // --- NEW VALIDATION LOGIC START ---
  
  // 1. Get the worker's daily salary
  const { data: workerData, error: workerErr } = await sb.from('workers').select('daily_salary').eq('id', worker_id).single();
  if (workerErr || !workerData) {
      await showCustomConfirm("Error", "Could not verify worker details.", "danger");
      return;
  }
  const dailySalary = parseFloat(workerData.daily_salary) || 0;

  // 2. Get the month start date for calculation
  const [year, month] = dateStr.split('-');
  const startDate = `${year}-${month}-01`;

  // 3. Calculate total accrued gross salary for the month up to the selected date
  const { data: attData, error: attErr } = await sb.from('attendance')
      .select('*')
      .eq('worker_id', worker_id)
      .gte('date', startDate)
      .lte('date', dateStr); // Only calculate up to the date of the advance
      
  if (attErr) {
      await showCustomConfirm("Error", "Could not verify attendance records.", "danger");
      return;
  }

  let accruedGross = 0;
  if (attData) {
      attData.forEach(a => {
          if (a.status === 'Full Day') {
              let earned = dailySalary;
              // Apply time penalties if applicable
              if (a.in_time && a.out_time) {
                  const parse = t => { const [h,m] = t.split(':').map(Number); return h * 60 + m; };
                  const inMins = parse(a.in_time); 
                  const outMins = parse(a.out_time);
                  let missed = 0;
                  if (inMins > 600) missed += (inMins - 600); // 10:00 AM
                  if (outMins < 1020) missed += (1020 - outMins); // 5:00 PM
                  if (missed > 0) {
                      earned -= (missed * (dailySalary / 420)); // Assuming 7 hour workday (420 mins)
                  }
              }
              accruedGross += Math.max(0, earned);
          }
          else if (a.status === 'Half Day') accruedGross += (dailySalary / 2);
          else if (a.status === 'Short Leave') accruedGross += (dailySalary * 0.75); // Adjust based on your policy
      });
  }

  // 4. Calculate total advances ALREADY taken this month
  const { data: existingAdvances, error: advErr } = await sb.from('advances')
      .select('amount')
      .eq('worker_id', worker_id)
      .gte('date', startDate)
      .lte('date', dateStr); // Include any taken today or earlier this month
      
  let totalPriorAdvances = 0;
  if (existingAdvances) {
      existingAdvances.forEach(adv => totalPriorAdvances += parseFloat(adv.amount) || 0);
  }

  // 5. Calculate available balance
  const availableBalance = accruedGross - totalPriorAdvances;

  // 6. Perform the block!
  if (amount > availableBalance) {
      const formatCurrency = (val) => new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR' }).format(val);
      
      await showCustomConfirm(
          "Advance Denied", 
          `This advance exceeds the employee's available earned balance.\n\nAccrued This Month: ${formatCurrency(accruedGross)}\nPrior Advances: ${formatCurrency(totalPriorAdvances)}\nMax Available: ${formatCurrency(availableBalance)}`, 
          "danger"
      );
      return; // Stop the form submission!
  }
  
  // --- NEW VALIDATION LOGIC END ---

  document.getElementById('loader').classList.remove('hidden');

  try {
      const { error } = await sb.from('advances').insert([{ worker_id, date: dateStr, amount }]);
      if (error) throw error;
      
      await showCustomConfirm("Advance Issued", "Advance payment recorded successfully.", "success-green");
      form.reset();
      
      // Update the UI if needed
      if (typeof updateAdminAttendanceView === 'function') {
          updateAdminAttendanceView();
      }
      
  } catch (err) {
      await showCustomConfirm("Error", err.message, "danger");
  } finally {
      document.getElementById('loader').classList.add('hidden');
  }
}

export async function calculateWorkerSalary(wId, monthStr) {
    const sb = getSupabase();
    const worker = workersData.find(w => String(w.id) === String(wId));
    if (!worker) return null;

    const [year, month] = monthStr.split('-');
    const startDate = `${monthStr}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];

    const { data: attData } = await sb.from('attendance').select('*').eq('worker_id', wId).gte('date', startDate).lte('date', endDate).order('date', {ascending: true});
    const { data: advData } = await sb.from('advances').select('*').eq('worker_id', wId).gte('date', startDate).lte('date', endDate);

    let full = 0; let half = 0; let short = 0; let timePenalty = 0;

    if (attData) {
        attData.forEach(a => {
            if (a.status === 'Half Day') half++;
            else if (a.status === 'Short Leave') short++;
            else if (a.status === 'Full Day') {
                full++;
                if (a.in_time && a.out_time) {
                    const parse = t => { const [h,m] = t.split(':').map(Number); return h * 60 + m; };
                    const inMins = parse(a.in_time); const outMins = parse(a.out_time);
                    let missed = 0;
                    if (inMins > 600) missed += (inMins - 600); // 10:00 AM
                    if (outMins < 1020) missed += (1020 - outMins); // 5:00 PM
                    if (missed > 0) timePenalty += (missed * (worker.daily_salary / 420));
                }
            }
        });
    }

    const baseGross = (full * worker.daily_salary) + (short * worker.daily_salary) + (half * (worker.daily_salary / 2));
    const grossEarnings = baseGross - timePenalty;
    let totalAdvances = 0;
    if (advData) totalAdvances = advData.reduce((sum, a) => sum + Number(a.amount), 0);
    
    const epfDeduction = grossEarnings > 0 ? grossEarnings * 0.08 : 0;
    const netPay = grossEarnings - totalAdvances - epfDeduction;

    return { worker, attData, advData, full, half, short, timePenalty, grossEarnings, totalAdvances, epfDeduction, netPay, monthStr };
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

    document.getElementById('view-att-name').innerText = data.worker.name;
    document.getElementById('view-att-gross').innerText = formatCurrency(data.grossEarnings);
    document.getElementById('view-att-net').innerText = formatCurrency(data.netPay);
    
    const tbody = document.getElementById('view-att-table');
    let htmlContent = '';
    
    if (data.attData && data.attData.length > 0) {
        data.attData.forEach(a => {
            let penText = '-';
            let rowClass = 'border-b dark:border-gray-700 text-sm hover:bg-gray-50 dark:hover:bg-slate-800 transition';
            let statusBadge = '';
            
            if (a.status === 'Full Day') statusBadge = `<span class="bg-green-100 text-green-800 px-2 py-1 rounded text-[10px] font-black uppercase">Full</span>`;
            else if (a.status === 'Half Day') statusBadge = `<span class="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-[10px] font-black uppercase">Half</span>`;
            else if (a.status === 'Short Leave') statusBadge = `<span class="bg-blue-100 text-blue-800 px-2 py-1 rounded text-[10px] font-black uppercase">Short</span>`;
            else { statusBadge = `<span class="bg-red-100 text-red-800 px-2 py-1 rounded text-[10px] font-black uppercase">Absent</span>`; rowClass += ' opacity-50'; }
            
            if (a.status === 'Full Day' && a.in_time && a.out_time) {
                const inMins = parseInt(a.in_time.split(':')[0]) * 60 + parseInt(a.in_time.split(':')[1]);
                const outMins = parseInt(a.out_time.split(':')[0]) * 60 + parseInt(a.out_time.split(':')[1]);
                let missed = 0;
                if (inMins > 600) missed += (inMins - 600);
                if (outMins < 1020) missed += (1020 - outMins);
                if (missed > 0) { 
                    const penAmount = missed * (data.worker.daily_salary / 420);
                    penText = `<span class="text-red-500 font-bold text-xs" title="Late/Early Deduction">- ${formatCurrency(penAmount)}</span>`; 
                }
            }
            
            let timeStr = '-';
            if (a.status !== 'Absent') timeStr = `${a.in_time || '??'} to ${a.out_time || '??'} ${penText !== '-' ? '<br>' + penText : ''}`;

            htmlContent += `<tr class="${rowClass}"><td class="p-3 font-bold">${a.date}</td><td class="p-3">${statusBadge}</td><td class="p-3 font-mono text-xs">${timeStr}</td></tr>`;
        });
    } else {
        htmlContent = `<tr><td colspan="3" class="p-8 text-center text-gray-500 font-bold uppercase tracking-widest bg-gray-50 dark:bg-slate-800/50"><i class="fas fa-calendar-times text-3xl mb-2 block opacity-40"></i>No attendance records found for this month.</td></tr>`;
    }
    
    tbody.innerHTML = htmlContent;
}

export async function generatePayroll(e) {
    e.preventDefault(); 
    const w = window.open('', '', 'width=700,height=900');
    if (w) w.document.write(`<div style="text-align: center; margin-top: 100px; font-family: sans-serif;"><h2 style="color: #2563eb;">Calculating Payroll Math...</h2></div>`);

    const form = new FormData(e.target); 
    const wId = form.get('worker_id'); 
    const mStr = form.get('month');
    const data = await calculateWorkerSalary(wId, mStr);
    
    if (!data) {
        if (w) w.close();
        return alert("Error locating worker details.");
    }
    
    let advancesHtml = '';
    if (data.advData && data.advData.length > 0) {
        advancesHtml = data.advData.map(a => `<div style="font-size: 12px; color: #666; padding-left: 20px; margin: 4px 0; display: flex; justify-content: space-between;"><span>↳ Advance on ${a.date}</span><span>${formatCurrency(a.amount)}</span></div>`).join('');
    } else {
        advancesHtml = `<div style="font-size: 12px; color: #aaa; padding-left: 20px; font-style: italic;">No advances taken this month.</div>`;
    }

    const dateObj = new Date(mStr + "-01");
    const formattedMonth = dateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    
    if (w) {
        setTimeout(() => {
            w.document.open();
            w.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Payroll Slip - ${data.worker.name} - ${formattedMonth}</title>
                    <style>
                        @media print { @page { margin: 1cm; size: portrait; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
                        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 30px; color: #333; max-width: 600px; margin: 0 auto;}
                        h1 { margin: 0; color: #0f172a; text-transform: uppercase; letter-spacing: 2px; font-size: 28px;} 
                        h3 { margin: 5px 0; color: #475569; font-weight: normal; font-size: 16px;}
                        .header-box { text-align: center; border-bottom: 3px solid #0f172a; padding-bottom: 20px; margin-bottom: 30px; }
                        .row { display: flex; justify-content: space-between; border-bottom: 1px dotted #cbd5e1; padding: 12px 0; font-size:15px; align-items: center;}
                        .bold { font-weight: 800; color: #0f172a;}
                        .section-title { margin-top: 30px; font-size: 13px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; color: #64748b; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;}
                        .highlight-box { background-color: #f1f5f9; padding: 15px 10px; border-radius: 8px; margin-top: 10px; }
                        .net-pay { display: flex; justify-content: space-between; border-top: 4px solid #0f172a; border-bottom: 4px solid #0f172a; padding: 20px 0; font-size: 22px; margin-top: 30px; background-color: #f8fafc;}
                        .deduct { color: #dc2626; font-weight: bold;}
                    </style>
                </head>
                <body>
                    <div class="header-box">
                        <h1>Julgaha Cycle Works</h1>
                        <h3>Official Salary & Remittance Slip</h3>
                        <p style="margin-top: 10px; font-weight: bold; background: #e2e8f0; display: inline-block; padding: 5px 15px; border-radius: 20px;">Payroll Period: ${formattedMonth}</p>
                    </div>
                    
                    <div class="row" style="border-top: 1px dotted #cbd5e1;"><span>Employee Name:</span> <span class="bold" style="font-size: 16px;">${data.worker.name}</span></div>
                    <div class="row"><span>Employee ID:</span> <span class="bold" style="font-family: monospace;">${data.worker.worker_uid}</span></div>
                    <div class="row"><span>Contracted Daily Base Rate:</span> <span class="bold">${formatCurrency(data.worker.daily_salary)}</span></div>
                    
                    <div class="section-title">Earnings & Adjustments</div>
                    <div class="row"><span>Full Days Worked (${data.full})</span> <span>${formatCurrency(data.full * data.worker.daily_salary)}</span></div>
                    <div class="row"><span>Half Days Worked (${data.half})</span> <span>${formatCurrency(data.half * (data.worker.daily_salary / 2))}</span></div>
                    <div class="row"><span>Short Leaves Recorded (${data.short})</span> <span>${formatCurrency(data.short * data.worker.daily_salary)}</span></div>
                    <div class="row"><span>Automated Time Penalties (Late In / Early Out)</span> <span class="deduct">- ${formatCurrency(data.timePenalty)}</span></div>
                    
                    <div class="row highlight-box"><span class="bold" style="font-size: 16px;">Calculated Gross Earnings</span> <span class="bold" style="font-size: 18px; color: #1e40af;">${formatCurrency(data.grossEarnings)}</span></div>
                    
                    <div class="section-title">Deductions</div>
                    <div class="row"><span>Total Advances Disbursed</span> <span class="deduct">- ${formatCurrency(data.totalAdvances)}</span></div>
                    ${advancesHtml}
                    <div class="row" style="margin-top: 10px;"><span>EPF Statutory Deduction (8%)</span> <span class="deduct">- ${formatCurrency(data.epfDeduction)}</span></div>
                    
                    <div class="net-pay"><span class="bold" style="color: #16a34a;">NET SALARY PAYABLE</span> <span class="bold" style="color: #16a34a;">${formatCurrency(data.netPay)}</span></div>
                    
                    <div class="section-title">Employer Contributions (Information Only)</div>
                    <div class="row"><span style="font-size: 12px; color: #666;">EPF Contribution (12%)</span> <span style="font-size: 12px; color: #666;">${formatCurrency(data.grossEarnings * 0.12)}</span></div>
                    <div class="row"><span style="font-size: 12px; color: #666;">ETF Contribution (3%)</span> <span style="font-size: 12px; color: #666;">${formatCurrency(data.grossEarnings * 0.03)}</span></div>
                    
                    <div style="margin-top: 80px; display: flex; justify-content: space-between;">
                        <div style="border-top: 1px solid #0f172a; width: 45%; text-align: center; padding-top: 8px; font-size: 12px; font-weight: bold; text-transform: uppercase;">Authorized Signature</div>
                        <div style="border-top: 1px solid #0f172a; width: 45%; text-align: center; padding-top: 8px; font-size: 12px; font-weight: bold; text-transform: uppercase;">Employee Signature</div>
                    </div>
                    <div style="text-align: center; margin-top: 40px; font-size: 10px; color: #94a3b8; font-family: monospace;">Generated securely by CycleSense Cloud HR Module on ${new Date().toLocaleString()}</div>
                    <script>window.onload = function() { window.print(); }</script>
                </body>
                </html>
            `);
            w.document.close();
        }, 300);
    }
}


// ============================================================================
// 7. CALENDAR SYSTEM & INTERNAL WARRANTY
// ============================================================================

let currentMonth = new Date().getMonth(); let currentYear = new Date().getFullYear();

export async function initCalendar() { renderCalendar(currentMonth, currentYear); }
export function nextMonth() { currentMonth++; if(currentMonth>11){currentMonth=0;currentYear++;} renderCalendar(currentMonth, currentYear); }
export function prevMonth() { currentMonth--; if(currentMonth<0){currentMonth=11;currentYear--;} renderCalendar(currentMonth, currentYear); }

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
    const { data: events } = await sb.from('calendar_events').select('*').gte('event_date', sDate).lte('event_date', eDate);
        
    const slHolidays = {
        "01-01": "New Year's Day", "01-14": "Tamil Thai Pongal", "02-04": "Independence Day",
        "04-03": "Good Friday", "04-13": "Sinhala/Tamil New Year Eve", "04-14": "Sinhala/Tamil New Year",
        "05-01": "May Day", "12-25": "Christmas Day"
    };

    const poyaDays = {
        "01-03": "Duruthu Full Moon Poya", "02-01": "Navam Full Moon Poya", "03-03": "Medin Full Moon Poya",
        "04-01": "Bak Full Moon Poya", "05-01": "Vesak Full Moon Poya", "05-30": "Poson Full Moon Poya",
        "06-29": "Esala Full Moon Poya", "08-27": "Nikini Full Moon Poya", "09-25": "Binara Full Moon Poya", 
        "10-25": "Vap Full Moon Poya", "11-23": "Ill Full Moon Poya", "12-23": "Unduvap Full Moon Poya"
    };
    
    let htmlContent = '';
    for (let i = 0; i < firstDay; i++) { 
        htmlContent += `<div class="p-4 border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-slate-800/30 opacity-50 rounded-lg"></div>`; 
    }
    
    for (let day = 1; day <= daysInMonth; day++) {
        const fullDate = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
        const monthDayStr = `${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
        let eventHtml = '';
        
        if (slHolidays[monthDayStr]) eventHtml += `<div class="bg-red-100 text-red-800 text-[9px] p-1.5 rounded mt-1.5 truncate font-black shadow-sm uppercase tracking-wider" title="${slHolidays[monthDayStr]}">🎌 ${slHolidays[monthDayStr]}</div>`;
        if (poyaDays[monthDayStr]) eventHtml += `<div class="bg-yellow-100 text-yellow-800 text-[9px] p-1.5 rounded mt-1.5 truncate font-black shadow-sm uppercase tracking-wider" title="${poyaDays[monthDayStr]}">🌕 Poya Day</div>`;
        if (events) {
            events.filter(e => e.event_date === fullDate).forEach(e => { 
                eventHtml += `<div class="bg-blue-100 text-blue-800 text-[10px] p-1.5 rounded mt-1.5 truncate font-bold shadow-sm" title="${e.title}">📍 ${e.title}</div>`; 
            });
        }
        
        const todayObj = new Date();
        const isToday = (day === todayObj.getDate() && month === todayObj.getMonth() && year === todayObj.getFullYear());
        const todayClass = isToday ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700 shadow-md ring-2 ring-blue-400' : 'bg-white dark:bg-darkcard border-gray-100 dark:border-gray-700 hover:bg-blue-50 dark:hover:bg-slate-700 hover:shadow-md';
        const textClass = isToday ? 'text-blue-600 dark:text-blue-400 text-lg' : 'text-gray-700 dark:text-gray-300';
        
        htmlContent += `<div class="p-2 border min-h-[100px] rounded-lg cursor-pointer transition duration-200 flex flex-col ${todayClass}" onclick="window.posModule.openEventModal('${fullDate}')"><span class="font-black self-end ${textClass}">${day}</span><div class="flex-grow flex flex-col justify-end">${eventHtml}</div></div>`;
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
    const { error } = await sb.from('calendar_events').insert({ event_date: document.getElementById('event-date').value, title: document.getElementById('event-title').value.trim() });
    if (error) alert("Error: " + error.message);
    else {
        document.getElementById('calendar-event-modal').classList.add('hidden');
        renderCalendar(currentMonth, currentYear);
        showCustomConfirm("Saved", "Custom event added.", "success-green");
    }
}

/**
 * Internal Warranty Checker Logic
 */
export async function checkInternalWarranty(e) {
    e.preventDefault();
    const sb = getSupabase();
    const serialInput = document.getElementById('internal-serial-input').value.toUpperCase().trim();
    const resultBox = document.getElementById('internal-warranty-result');
    const btn = document.getElementById('internal-warranty-btn');

    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Checking Database...';
    btn.disabled = true;

    try {
        const { data, error } = await sb.from('sales')
            .select('customer_name, date, warranty_exp, receipt_no')
            .eq('warranty_serial', serialInput)
            .single();

        if (error || !data) {
            resultBox.innerHTML = `
                <div class="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-xl border border-red-200 dark:border-red-800 font-bold text-sm text-center">
                    <i class="fas fa-times-circle text-lg mb-1 block"></i> Serial Number not found in the database.
                </div>`;
            return;
        }

        // Fixes the 1970 bug for bicycles sold As-Is
        if (!data.warranty_exp) {
            resultBox.innerHTML = `
                <div class="bg-gray-100 dark:bg-slate-800 p-4 rounded-xl border border-gray-300 dark:border-gray-600 text-center">
                    <i class="fas fa-info-circle text-3xl text-gray-500 mb-2"></i>
                    <h4 class="font-black text-gray-700 dark:text-gray-300 text-lg">No Warranty Provided</h4>
                    <p class="text-gray-500 font-bold text-sm">This bicycle was sold As-Is.</p>
                    <div class="mt-4 pt-4 border-t border-gray-300 dark:border-gray-600 text-sm text-left">
                        <div class="flex justify-between mb-1"><span class="text-gray-500">Customer:</span><b class="dark:text-white">${data.customer_name}</b></div>
                        <div class="flex justify-between"><span class="text-gray-500">Purchased:</span><b class="dark:text-white">${new Date(data.date).toLocaleDateString()}</b></div>
                    </div>
                </div>`;
            return;
        }

        const expDate = new Date(data.warranty_exp);
        const today = new Date();
        const daysRemaining = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));
        
        let statusHtml = '';
        if (daysRemaining > 0) {
            const years = (daysRemaining / 365).toFixed(1);
            statusHtml = `
                <div class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4 rounded-xl text-center">
                    <i class="fas fa-check-circle text-3xl text-green-500 mb-2"></i>
                    <h4 class="font-black text-green-700 dark:text-green-400 text-lg">Warranty Active</h4>
                    <p class="text-green-600 dark:text-green-500 font-bold text-sm">${daysRemaining > 365 ? years + ' Years' : daysRemaining + ' Days'} Remaining</p>
                </div>
            `;
        } else {
            statusHtml = `
                <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-xl text-center">
                    <i class="fas fa-exclamation-triangle text-3xl text-red-500 mb-2"></i>
                    <h4 class="font-black text-red-700 dark:text-red-400 text-lg">Warranty Expired</h4>
                    <p class="text-red-600 dark:text-red-500 font-bold text-sm">Expired on ${expDate.toLocaleDateString()}</p>
                </div>
            `;
        }

        resultBox.innerHTML = `
            ${statusHtml}
            <div class="mt-4 bg-gray-50 dark:bg-slate-800 p-4 rounded-xl border dark:border-gray-700 text-sm">
                <div class="flex justify-between border-b dark:border-gray-700 pb-2 mb-2">
                    <span class="text-gray-500 font-bold">Customer:</span>
                    <span class="font-black dark:text-white">${data.customer_name}</span>
                </div>
                <div class="flex justify-between border-b dark:border-gray-700 pb-2 mb-2">
                    <span class="text-gray-500 font-bold">Receipt No:</span>
                    <span class="font-mono font-bold text-blue-600 dark:text-blue-400">${data.receipt_no}</span>
                </div>
                <div class="flex justify-between">
                    <span class="text-gray-500 font-bold">Purchased:</span>
                    <span class="font-bold dark:text-white">${new Date(data.date).toLocaleDateString()}</span>
                </div>
            </div>
        `;

    } catch (err) {
        resultBox.innerHTML = `<div class="text-red-500 font-bold text-center text-sm">An error occurred. Try again.</div>`;
    } finally {
        btn.innerHTML = 'Verify Status';
        btn.disabled = false;
    }
}
