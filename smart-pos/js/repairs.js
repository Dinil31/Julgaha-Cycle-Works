const repairForm = document.querySelector('#repair-form');
const repairMessage = document.querySelector('#repair-message');
const repairsTableBody = document.querySelector('#repairs-table tbody');
const repairSearchInput = document.querySelector('#repair-search');
const repairSearchButton = document.querySelector('#repair-search-btn');
const repairStatus = document.querySelector('#repair-status');

const formatCurrency = (value) => `LKR ${Number(value || 0).toFixed(2)}`;

const generateRepairId = () => `REP-${Date.now().toString().slice(-6)}`;

const getAlertsForRepair = (repair) => {
  const alerts = [];
  const predictedDate = new Date(repair.predicted_date);
  const now = new Date();
  const monthsDiff = (now.getFullYear() - predictedDate.getFullYear()) * 12 + (now.getMonth() - predictedDate.getMonth());

  if (repair.status !== 'Completed' && monthsDiff >= 3) {
    alerts.push('Over 3 months - follow up customer');
  }
  if (repair.status !== 'Completed' && monthsDiff >= 12) {
    alerts.push('Over 1 year - mark as Cycle for Sale');
  }

  return alerts;
};

const renderRepairs = (repairs) => {
  repairsTableBody.innerHTML = '';
  repairs.forEach((repair) => {
    const alerts = getAlertsForRepair(repair);
    if (alerts.includes('Over 1 year - mark as Cycle for Sale')) {
      supabaseHelpers.update('repairs', { status: 'Cycle for Sale' }, { repair_id: repair.repair_id });
      repair.status = 'Cycle for Sale';
    }

    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${repair.repair_id}</td>
      <td>${repair.customer_name}</td>
      <td>${repair.phone}</td>
      <td>${formatCurrency(repair.advance)}</td>
      <td>${new Date(repair.predicted_date).toLocaleDateString()}</td>
      <td>${repair.status}</td>
      <td>${alerts.length ? alerts.join(', ') : 'No alerts'}</td>
    `;
    repairsTableBody.appendChild(row);
  });
};

const loadRepairs = async () => {
  try {
    const repairs = await supabaseHelpers.fetchAll('repairs', '*');
    renderRepairs(repairs);
  } catch (error) {
    repairMessage.textContent = `Error loading repairs: ${error.message}`;
  }
};

repairForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  repairMessage.textContent = '';

  const formData = new FormData(repairForm);
  const payload = {
    repair_id: generateRepairId(),
    customer_name: formData.get('customer_name').trim(),
    phone: formData.get('phone').trim(),
    advance: Number(formData.get('advance')),
    predicted_date: formData.get('predicted_date'),
    status: 'Repairing',
    unpaid_amount: 0,
  };

  try {
    await supabaseHelpers.insert('repairs', payload);
    repairMessage.textContent = `Repair created. ID: ${payload.repair_id}`;
    repairForm.reset();
    loadRepairs();
  } catch (error) {
    repairMessage.textContent = `Error creating repair: ${error.message}`;
  }
});

repairSearchButton.addEventListener('click', async () => {
  const repairId = repairSearchInput.value.trim();
  if (!repairId) return;

  const { data, error } = await supabaseClient
    .from('repairs')
    .select('status, predicted_date')
    .eq('repair_id', repairId)
    .maybeSingle();

  if (error || !data) {
    repairStatus.textContent = 'Repair ID not found.';
    return;
  }

  repairStatus.textContent = `Status: ${data.status}. Predicted completion: ${new Date(data.predicted_date).toLocaleDateString()}`;
});

loadRepairs();
