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
const customerAlert = document.querySelector('#customer-alert');
const todaySalesEl = document.querySelector('#today-sales');
const predictedRevenueEl = document.querySelector('#predicted-revenue');
const performanceAlertEl = document.querySelector('#performance-alert');
const topPartEl = document.querySelector('#top-part');

let products = [];
let cart = [];

const formatCurrency = (value) => `LKR ${Number(value || 0).toFixed(2)}`;

const refreshProductOptions = () => {
  partSelect.innerHTML = products
    .map(
      (product) =>
        `<option value="${product.id}" data-price="${product.unit_price}" data-name="${product.name}">${product.name} (Stock: ${product.stock})</option>`
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

  const buttons = partsTableBody.querySelectorAll('button');
  buttons.forEach((button) => {
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

  // Estimated profit uses a simple 20% margin on parts + full service cost.
  const partsMargin = partsTotal * 0.2;
  const estimatedProfit = partsMargin + serviceCost;

  partsTotalEl.textContent = formatCurrency(partsTotal);
  serviceTotalEl.textContent = formatCurrency(serviceCost);
  grandTotalEl.textContent = formatCurrency(grandTotal);
  profitTotalEl.textContent = formatCurrency(estimatedProfit);
};

const loadProducts = async () => {
  products = await supabaseHelpers.fetchAll('products', '*');
  refreshProductOptions();
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

  cart.push({
    product_id: productId,
    name,
    unit_price: unitPrice,
    quantity,
    total: unitPrice * quantity,
  });

  renderCart();
  updateTotals();
  saleMessage.textContent = '';
});

serviceCostInput.addEventListener('input', updateTotals);

saleForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  saleMessage.textContent = '';

  const formData = new FormData(saleForm);
  const customerName = formData.get('customer_name').trim();
  const phone = formData.get('phone').trim();
  const serviceCost = Number(formData.get('service_cost') || 0);

  if (cart.length === 0) {
    saleMessage.textContent = 'Add at least one spare part.';
    return;
  }

  const partsTotal = cart.reduce((sum, item) => sum + item.total, 0);
  const totalAmount = partsTotal + serviceCost;

  try {
    const salePayload = {
      date: new Date().toISOString(),
      customer_name: customerName,
      phone,
      service_cost: serviceCost,
      total_amount: totalAmount,
    };

    const saleInsert = await supabaseHelpers.insert('sales', salePayload);
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

    saleMessage.textContent = 'Sale completed successfully.';
    cart = [];
    renderCart();
    updateTotals();
    await loadProducts();
    await refreshInsights();
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

document.querySelector('#customer-phone').addEventListener('blur', (event) => checkCustomerAlerts(event.target.value));

(async () => {
  await loadProducts();
  updateTotals();
  await refreshInsights();
})();
