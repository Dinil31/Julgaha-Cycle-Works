const repairIdInput = document.querySelector('#public-repair-id');
const checkButton = document.querySelector('#public-check-btn');
const resultBox = document.querySelector('#public-result');
const billContainer = document.querySelector('#public-bill');

const formatCurrency = (value) => `LKR ${Number(value || 0).toFixed(2)}`;

const renderBill = (bill) => {
  if (!bill || !Array.isArray(bill.parts)) {
    billContainer.innerHTML = '<p>Final bill is not available yet.</p>';
    return;
  }

  const rows = bill.parts
    .map((item) => `
      <tr>
        <td>${item.name}</td>
        <td>${item.quantity}</td>
        <td>${formatCurrency(item.unit_price)}</td>
        <td>${formatCurrency(item.total)}</td>
      </tr>
    `)
    .join('');

  billContainer.innerHTML = `
    <h3>Final Bill</h3>
    <table class="table">
      <thead>
        <tr><th>Part</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr>
      </thead>
      <tbody>${rows || '<tr><td colspan="4">No parts used</td></tr>'}</tbody>
    </table>
    <p><strong>Service:</strong> ${formatCurrency(bill.service_cost)}</p>
    <p><strong>Parts Total:</strong> ${formatCurrency(bill.parts_total)}</p>
    <p><strong>Total:</strong> ${formatCurrency(bill.total_amount)}</p>
    <p><strong>Paid:</strong> ${formatCurrency(bill.paid_amount)}</p>
    <p><strong>Balance:</strong> ${formatCurrency(bill.unpaid_amount)}</p>
  `;
};

const loadRepair = async (repairId) => {
  resultBox.textContent = 'Checking...';
  billContainer.innerHTML = '';

  const { data, error } = await supabaseClient
    .from('repairs')
    .select('repair_id, customer_name, status, predicted_date, unpaid_amount, final_bill')
    .eq('repair_id', repairId)
    .maybeSingle();

  if (error || !data) {
    resultBox.textContent = 'Repair ID not found.';
    return;
  }

  resultBox.innerHTML = `
    <p><strong>Repair ID:</strong> ${data.repair_id}</p>
    <p><strong>Customer:</strong> ${data.customer_name}</p>
    <p><strong>Status:</strong> ${data.status}</p>
    <p><strong>Expected Date:</strong> ${new Date(data.predicted_date).toLocaleDateString()}</p>
    <p><strong>Balance:</strong> ${formatCurrency(data.unpaid_amount || 0)}</p>
  `;

  renderBill(data.final_bill);
};

checkButton.addEventListener('click', () => {
  const repairId = repairIdInput.value.trim();
  if (!repairId) return;
  loadRepair(repairId);
});

const params = new URLSearchParams(window.location.search);
const initialRepairId = params.get('repairId');
if (initialRepairId) {
  repairIdInput.value = initialRepairId;
  loadRepair(initialRepairId);
}
