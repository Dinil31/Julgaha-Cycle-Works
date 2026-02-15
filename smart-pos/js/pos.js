const partSelect = document.querySelector('#part-select');
const partQty = document.querySelector('#part-qty');
const addPartButton = document.querySelector('#add-part');
const partsTableBody = document.querySelector('#parts-table tbody');
const serviceCostInput = document.querySelector('#service-cost');
const partsTotalEl = document.querySelector('#parts-total');
const serviceTotalEl = document.querySelector('#service-total');
const grandTotalEl = document.querySelector('#grand-total');
const profitTotalEl = document.querySelector('#profit-total');
const saleForm = document.querySelector('#sale-form');
const saleMessage = document.querySelector('#sale-message');
const repairIdInput = document.querySelector('#repair-id');
const generateRepairIdButton = document.querySelector('#generate-repair-id');
const customerAlert = document.querySelector('#customer-alert');
const todaySalesEl = document.querySelector('#today-sales');
const predictedRevenueEl = document.querySelector('#predicted-revenue');
const performanceAlertEl = document.querySelector('#performance-alert');
const topPartEl = document.querySelector('#top-part');
const pastSalesTableBody = document.querySelector('#past-sales-table tbody');

let products = [];
let cart = [];

const formatCurrency = (value) => `LKR ${Number(value || 0).toFixed(2)}`;
const generateRepairId = () => `REP-${Date.now().toString().slice(-6)}`;

const normalizeRepairId = (value) => {
  const raw = String(value || '').trim().toUpperCase();
  if (!raw) return '';
  return raw.startsWith('REP-') ? raw : `REP-${raw.replace(/^REP/i, '').replace(/^-/, '')}`;
};

const buildBillPayload = ({ repairId = '', customerName, phone, serviceCost, partsTotal, totalAmount, paidAmount = 0 }) => ({
  bill_number: `BILL-${Date.now().toString().slice(-8)}`,
  repair_id: repairId || null,
  date: new Date().toISOString(),
  customer_name: customerName,
  phone,
  service_cost: serviceCost,
  parts_total: partsTotal,
  total_amount: totalAmount,
  paid_amount: paidAmount,
  unpaid_amount: Math.max(totalAmount - paidAmount, 0),
  parts: cart.map((item) => ({
    name: item.name,
    quantity: item.quantity,
    unit_price: item.unit_price,
    total: item.total,
  })),
});

const downloadBillPdf = (bill) => {
  const popup = window.open('', '_blank', 'width=900,height=700');
  if (!popup) {
    saleMessage.textContent = 'Unable to open bill preview. Please allow popups.';
    return;
  }

  const rows = bill.parts
    .map(
      (item) => `
      <tr>
        <td>${item.name}</td>
        <td>${item.quantity}</td>
        <td>${formatCurrency(item.unit_price)}</td>
        <td>${formatCurrency(item.total)}</td>
      </tr>`,
    )
    .join('');

  popup.document.write(`
    <html>
      <head>
        <title>${bill.bill_number}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 28px; color:#111; }
          h1 { margin-bottom: 6px; }
          .meta { margin: 2px 0; }
          table { width:100%; border-collapse: collapse; margin-top: 18px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align:left; }
          th { background:#f8f8f8; }
          .summary { margin-top: 18px; font-size: 15px; }
          .summary p { margin: 6px 0; }
        </style>
      </head>
      <body>
        <h1>Cycle Sense Repair Bill</h1>
        <p class="meta"><strong>Bill No:</strong> ${bill.bill_number}</p>
        <p class="meta"><strong>Date:</strong> ${new Date(bill.date).toLocaleString()}</p>
        <p class="meta"><strong>Customer:</strong> ${bill.customer_name}</p>
        <p class="meta"><strong>Phone:</strong> ${bill.phone}</p>
        <p class="meta"><strong>Repair ID:</strong> ${bill.repair_id || 'N/A'}</p>
        <table>
          <thead>
            <tr>
              <th>Part</th><th>Qty</th><th>Unit Price</th><th>Total</th>
            </tr>
          </thead>
          <tbody>${rows || '<tr><td colspan="4">No parts used</td></tr>'}</tbody>
        </table>
        <div class="summary">
          <p><strong>Parts Total:</strong> ${formatCurrency(bill.parts_total)}</p>
          <p><strong>Service Cost:</strong> ${formatCurrency(bill.service_cost)}</p>
          <p><strong>Grand Total:</strong> ${formatCurrency(bill.total_amount)}</p>
          <p><strong>Advance/Paid:</strong> ${formatCurrency(bill.paid_amount)}</p>
          <p><strong>Balance:</strong> ${formatCurrency(bill.unpaid_amount)}</p>
        </div>
      </body>
    </html>
  `);

  popup.document.close();
  popup.focus();
  popup.print();
};

const ensureRepairRecord = async (repairId, customerName, phone) => {
  if (!repairId) return null;

  const { data: existing, error: existingError } = await supabaseClient
    .from('repairs')
    .select('repair_id')
    .eq('repair_id', repairId)
    .maybeSingle();

  if (!existingError && existing) return existing;

  const predictedDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  await supabaseHelpers.insert('repairs', {
    repair_id: repairId,
    customer_name: customerName,
    phone,
    advance: 0,
    predicted_date: predictedDate,
    status: 'Working',
    unpaid_amount: 0,
  });

  return { repair_id: repairId };
};

const completeRepairIfLinked = async (repairId, bill) => {
  if (!repairId) return;

  const updatePayload = {
    status: 'Completed',
    unpaid_amount: bill.unpaid_amount,
    final_bill: bill,
    completed_at: new Date().toISOString(),
  };

  try {
    await supabaseHelpers.update('repairs', updatePayload, { repair_id: repairId });
  } catch (error) {
    await supabaseHelpers.update('repairs', { status: 'Completed', unpaid_amount: bill.unpaid_amount }, { repair_id: repairId });
  }
};

const prefillRepairFromUrl = async () => {
  const params = new URLSearchParams(window.location.search);
  const repairId = normalizeRepairId(params.get('repairId'));
  if (!repairId) return;

  repairIdInput.value = repairId;
  const { data } = await supabaseClient
    .from('repairs')
    .select('customer_name, phone')
    .eq('repair_id', repairId)
    .maybeSingle();

  if (!data) return;

  document.querySelector('#customer-name').value = data.customer_name || '';
  document.querySelector('#customer-phone').value = data.phone || '';
};

const buildBillPayload = ({ repairId = '', customerName, phone, serviceCost, partsTotal, totalAmount, paidAmount = 0 }) => ({
  bill_number: `BILL-${Date.now().toString().slice(-8)}`,
  repair_id: repairId || null,
  date: new Date().toISOString(),
  customer_name: customerName,
  phone,
  service_cost: serviceCost,
  parts_total: partsTotal,
  total_amount: totalAmount,
  paid_amount: paidAmount,
  unpaid_amount: Math.max(totalAmount - paidAmount, 0),
  parts: cart.map((item) => ({
    name: item.name,
    quantity: item.quantity,
    unit_price: item.unit_price,
    total: item.total,
  })),
});

const downloadBillPdf = (bill) => {
  const popup = window.open('', '_blank', 'width=900,height=700');
  if (!popup) {
    saleMessage.textContent = 'Unable to open bill preview. Please allow popups.';
    return;
  }

  const rows = bill.parts
    .map(
      (item) => `
      <tr>
        <td>${item.name}</td>
        <td>${item.quantity}</td>
        <td>${formatCurrency(item.unit_price)}</td>
        <td>${formatCurrency(item.total)}</td>
      </tr>`,
    )
    .join('');

  popup.document.write(`
    <html>
      <head>
        <title>${bill.bill_number}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 28px; color:#111; }
          h1 { margin-bottom: 6px; }
          .meta { margin: 2px 0; }
          table { width:100%; border-collapse: collapse; margin-top: 18px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align:left; }
          th { background:#f8f8f8; }
          .summary { margin-top: 18px; font-size: 15px; }
          .summary p { margin: 6px 0; }
        </style>
      </head>
      <body>
        <h1>Cycle Sense Repair Bill</h1>
        <p class="meta"><strong>Bill No:</strong> ${bill.bill_number}</p>
        <p class="meta"><strong>Date:</strong> ${new Date(bill.date).toLocaleString()}</p>
        <p class="meta"><strong>Customer:</strong> ${bill.customer_name}</p>
        <p class="meta"><strong>Phone:</strong> ${bill.phone}</p>
        <p class="meta"><strong>Repair ID:</strong> ${bill.repair_id || 'N/A'}</p>
        <table>
          <thead>
            <tr>
              <th>Part</th><th>Qty</th><th>Unit Price</th><th>Total</th>
            </tr>
          </thead>
          <tbody>${rows || '<tr><td colspan="4">No parts used</td></tr>'}</tbody>
        </table>
        <div class="summary">
          <p><strong>Parts Total:</strong> ${formatCurrency(bill.parts_total)}</p>
          <p><strong>Service Cost:</strong> ${formatCurrency(bill.service_cost)}</p>
          <p><strong>Grand Total:</strong> ${formatCurrency(bill.total_amount)}</p>
          <p><strong>Advance/Paid:</strong> ${formatCurrency(bill.paid_amount)}</p>
          <p><strong>Balance:</strong> ${formatCurrency(bill.unpaid_amount)}</p>
        </div>
      </body>
    </html>
  `);

  popup.document.close();
  popup.focus();
  popup.print();
};

const completeRepairIfLinked = async (repairId, bill) => {
  if (!repairId) return;

  const updatePayload = {
    status: 'Completed',
    unpaid_amount: bill.unpaid_amount,
    final_bill: bill,
    completed_at: new Date().toISOString(),
  };

  try {
    await supabaseHelpers.update('repairs', updatePayload, { repair_id: repairId });
  } catch (error) {
    await supabaseHelpers.update('repairs', { status: 'Completed', unpaid_amount: bill.unpaid_amount }, { repair_id: repairId });
  }
};

const prefillRepairFromUrl = async () => {
  const params = new URLSearchParams(window.location.search);
  const repairId = params.get('repairId');
  if (!repairId) return;

  repairIdInput.value = repairId;
  const { data, error } = await supabaseClient
    .from('repairs')
    .select('customer_name, phone, advance')
    .eq('repair_id', repairId)
    .maybeSingle();

  if (error || !data) return;

  const customerNameInput = document.querySelector('#customer-name');
  const customerPhoneInput = document.querySelector('#customer-phone');
  customerNameInput.value = data.customer_name || '';
  customerPhoneInput.value = data.phone || '';
};

const refreshProductOptions = () => {
  partSelect.innerHTML = products
    .map(
      (product) =>
        `<option value="${product.id}" data-price="${product.unit_price}" data-name="${product.name}">${product.name} (Stock: ${product.stock})</option>`,
    )
    .join('');
};

const renderCart = () => {
  partsTableBody.innerHTML = '';
  cart.forEach((item, index) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${item.name}</td>
      <td>${item.quantity}</td>
      <td>${formatCurrency(item.unit_price)}</td>
      <td>${formatCurrency(item.total)}</td>
      <td><button type="button" class="secondary" data-index="${index}">Remove</button></td>
    `;
    partsTableBody.appendChild(row);
  });

  partsTableBody.querySelectorAll('button').forEach((button) => {
    button.addEventListener('click', () => {
      const index = Number(button.dataset.index);
      cart.splice(index, 1);
      renderCart();
      updateTotals();
    });
  });
};

const updateTotals = () => {
  const partsTotal = cart.reduce((sum, item) => sum + item.total, 0);
  const serviceCost = Number(serviceCostInput.value || 0);
  const grandTotal = partsTotal + serviceCost;
  const estimatedProfit = partsTotal * 0.2 + serviceCost;

  partsTotalEl.textContent = formatCurrency(partsTotal);
  serviceTotalEl.textContent = formatCurrency(serviceCost);
  grandTotalEl.textContent = formatCurrency(grandTotal);
  profitTotalEl.textContent = formatCurrency(estimatedProfit);
};

const loadProducts = async () => {
  products = await supabaseHelpers.fetchAll('products', '*');
  refreshProductOptions();
};

const loadPastSales = async () => {
  const { data, error } = await supabaseClient
    .from('sales')
    .select('date, customer_name, phone, total_amount, repair_id')
    .order('date', { ascending: false })
    .limit(20);

  if (error) {
    pastSalesTableBody.innerHTML = '<tr><td colspan="5">Unable to load sales.</td></tr>';
    return;
  }

  pastSalesTableBody.innerHTML = '';
  const sales = data || [];
  if (sales.length === 0) {
    pastSalesTableBody.innerHTML = '<tr><td colspan="5">No past sales found.</td></tr>';
    return;
  }

  sales.forEach((sale) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${new Date(sale.date).toLocaleString()}</td>
      <td>${sale.customer_name || '-'}</td>
      <td>${sale.phone || '-'}</td>
      <td>${sale.repair_id || '-'}</td>
      <td>${formatCurrency(sale.total_amount)}</td>
    `;
    pastSalesTableBody.appendChild(row);
  });
};

const checkCustomerAlerts = async (phone) => {
  if (!phone) return;
  const { data, error } = await supabaseClient
    .from('repairs')
    .select('repair_id, unpaid_amount, status')
    .eq('phone', phone)
    .gt('unpaid_amount', 0)
    .order('predicted_date', { ascending: false });

  if (error) {
    customerAlert.textContent = 'Unable to check unpaid repairs.';
    return;
  }

  if (!data || data.length === 0) {
    customerAlert.textContent = 'No unpaid repairs found for this customer.';
    return;
  }

  const repair = data[0];
  customerAlert.textContent = `Alert: Customer has unpaid repair ${repair.repair_id} (LKR ${repair.unpaid_amount}). Status: ${repair.status}.`;
};

generateRepairIdButton.addEventListener('click', () => {
  repairIdInput.value = generateRepairId();
});

addPartButton.addEventListener('click', () => {
  const selected = partSelect.options[partSelect.selectedIndex];
  if (!selected) return;

  const productId = selected.value;
  const name = selected.dataset.name;
  const unitPrice = Number(selected.dataset.price);
  const quantity = Number(partQty.value || 1);

  const product = products.find((item) => String(item.id) === String(productId));
  if (!product || quantity > product.stock) {
    saleMessage.textContent = 'Not enough stock for the selected item.';
    return;
  }

  cart.push({ product_id: productId, name, unit_price: unitPrice, quantity, total: unitPrice * quantity });
  renderCart();
  updateTotals();
  saleMessage.textContent = '';
});

serviceCostInput.addEventListener('input', updateTotals);
document.querySelector('#customer-phone').addEventListener('blur', (event) => checkCustomerAlerts(event.target.value));

saleForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  saleMessage.textContent = '';

  const formData = new FormData(saleForm);
  const customerName = formData.get('customer_name').trim();
  const phone = formData.get('phone').trim();
  const repairId = normalizeRepairId(formData.get('repair_id'));
  repairIdInput.value = repairId;
  const repairId = formData.get('repair_id').trim();
  const serviceCost = Number(formData.get('service_cost') || 0);

  if (cart.length === 0) {
    saleMessage.textContent = 'Add at least one spare part.';
    return;
  }

  const partsTotal = cart.reduce((sum, item) => sum + item.total, 0);
  const totalAmount = partsTotal + serviceCost;

  try {
    let paidAmount = 0;

    if (repairId) {
      await ensureRepairRecord(repairId, customerName, phone);
      const { data: repair } = await supabaseClient
    if (repairId) {
      const { data: repair, error: repairError } = await supabaseClient
        .from('repairs')
        .select('advance')
        .eq('repair_id', repairId)
        .maybeSingle();

      paidAmount = Number(repair?.advance || 0);
    }

    const bill = buildBillPayload({ repairId, customerName, phone, serviceCost, partsTotal, totalAmount, paidAmount });
      if (!repairError && repair) {
        paidAmount = Number(repair.advance || 0);
      }
    }

    const bill = buildBillPayload({
      repairId,
      customerName,
      phone,
      serviceCost,
      partsTotal,
      totalAmount,
      paidAmount,
    });

    const salePayload = {
      date: new Date().toISOString(),
      customer_name: customerName,
      phone,
      service_cost: serviceCost,
      total_amount: totalAmount,
      repair_id: repairId || null,
    };

    let saleInsert;
    try {
      saleInsert = await supabaseHelpers.insert('sales', salePayload);
    } catch (error) {
      saleInsert = await supabaseHelpers.insert('sales', {
        date: salePayload.date,
        customer_name: salePayload.customer_name,
        phone: salePayload.phone,
        service_cost: salePayload.service_cost,
        total_amount: salePayload.total_amount,
      });
    }
    const saleId = saleInsert[0].id;

    const saleId = saleInsert[0].id;
    const saleItemsPayload = cart.map((item) => ({
      sale_id: saleId,
      product_id: item.product_id,
      quantity: item.quantity,
      price: item.unit_price,
    }));

    await supabaseHelpers.insert('sale_items', saleItemsPayload);

    for (const item of cart) {
      const product = products.find((p) => String(p.id) === String(item.product_id));
      const newStock = Math.max(0, (product?.stock || 0) - item.quantity);
      await supabaseHelpers.update('products', { stock: newStock }, { id: item.product_id });
    }

    await completeRepairIfLinked(repairId, bill);
    downloadBillPdf(bill);

    saleMessage.textContent = repairId
      ? `Repair ${repairId} completed and final bill generated.`
      : 'Sale completed successfully and bill generated.';

    cart = [];
    renderCart();
    updateTotals();
    repairIdInput.value = '';

    await loadProducts();
    await refreshInsights();
    await loadPastSales();
  } catch (error) {
    saleMessage.textContent = `Error completing sale: ${error.message}`;
  }
});

const refreshInsights = async () => {
  try {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
    const { data: todaySales, error } = await supabaseClient
      .from('sales')
      .select('total_amount')
      .gte('date', startOfDay);

    if (error) throw error;

    const todayTotal = (todaySales || []).reduce((sum, sale) => sum + Number(sale.total_amount || 0), 0);
    todaySalesEl.textContent = formatCurrency(todayTotal);

    const lastWeekStart = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: weekSales } = await supabaseClient
      .from('sales')
      .select('total_amount')
      .gte('date', lastWeekStart);

    const weekTotal = (weekSales || []).reduce((sum, sale) => sum + Number(sale.total_amount || 0), 0);
    const predicted = weekSales && weekSales.length > 0 ? weekTotal / 7 : 0;
    predictedRevenueEl.textContent = formatCurrency(predicted);

    performanceAlertEl.textContent = todayTotal >= predicted ? 'On Track' : 'Below Expectation';
    performanceAlertEl.style.color = todayTotal >= predicted ? 'var(--success)' : 'var(--danger)';

    await loadTopSellingPart();
  } catch (error) {
    performanceAlertEl.textContent = 'Unable to load insights.';
  }
};

const loadTopSellingPart = async () => {
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();

  const { data, error } = await supabaseClient
    .from('sale_items')
    .select('quantity, product_id, sales!inner(date)')
    .gte('sales.date', monthStart);

  if (error) {
    topPartEl.textContent = 'Unable to load.';
    return;
  }

  const totals = data.reduce((acc, item) => {
    acc[item.product_id] = (acc[item.product_id] || 0) + Number(item.quantity || 0);
    return acc;
  }, {});

  const topProductId = Object.keys(totals).sort((a, b) => totals[b] - totals[a])[0];
  if (!topProductId) {
    topPartEl.textContent = 'No sales yet this month.';
    return;
  }

  const product = products.find((p) => String(p.id) === String(topProductId));
  topPartEl.textContent = product ? `${product.name} (${totals[topProductId]} sold)` : 'Top part not found.';
};

(async () => {
  await loadProducts();
  await prefillRepairFromUrl();
  updateTotals();
  await refreshInsights();
  await loadPastSales();
})();
