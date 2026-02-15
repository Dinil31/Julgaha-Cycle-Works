const repairForm = document.querySelector('#repair-form');
const repairMessage = document.querySelector('#repair-message');
const repairsTableBody = document.querySelector('#repairs-table tbody');
const repairSearchInput = document.querySelector('#repair-search');
const repairSearchButton = document.querySelector('#repair-search-btn');
const repairStatus = document.querySelector('#repair-status');
const publicStatusLink = document.querySelector('#public-status-link');

const formatCurrency = (value) => `LKR ${Number(value || 0).toFixed(2)}`;
const generateRepairId = () => `REP-${Date.now().toString().slice(-6)}`;

const normalizeRepairId = (value) => {
  const raw = String(value || '').trim().toUpperCase();
  if (!raw) return '';
  return raw.startsWith('REP-') ? raw : `REP-${raw.replace(/^REP/i, '').replace(/^-/, '')}`;
};

const findRepairById = async (repairId) => {
  const normalized = normalizeRepairId(repairId);
  if (!normalized) return { data: null, error: null };

  let query = await supabaseClient.from('repairs').select('*').eq('repair_id', normalized).maybeSingle();
  if (!query.error && query.data) return query;

  query = await supabaseClient.from('repairs').select('*').ilike('repair_id', normalized).maybeSingle();
  return query;
};

const downloadRegistrationPdf = (repair) => {
  const popup = window.open('', '_blank', 'width=800,height=680');
  if (!popup) return;

  popup.document.write(`
    <html>
      <head>
        <title>Repair ${repair.repair_id}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 28px; }
          h1 { margin-bottom: 6px; }
          p { margin: 5px 0; }
        </style>
      </head>
      <body>
        <h1>Cycle Sense Repair Service Slip</h1>
        <p><strong>Repair ID:</strong> ${repair.repair_id}</p>
        <p><strong>Customer:</strong> ${repair.customer_name}</p>
        <p><strong>Phone:</strong> ${repair.phone}</p>
        <p><strong>Advance:</strong> ${formatCurrency(repair.advance)}</p>
        <p><strong>Predicted Completion:</strong> ${new Date(repair.predicted_date).toLocaleDateString()}</p>
        <p><strong>Status:</strong> ${repair.status}</p>
      </body>
    </html>
  `);

  popup.document.close();
  popup.focus();
  popup.print();
};

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

const buildPublicStatusUrl = (repairId = '') => {
  const url = new URL('repair-status.html', window.location.href);
  if (repairId) {
    url.searchParams.set('repairId', normalizeRepairId(repairId));
    url.searchParams.set('repairId', repairId);
  }
  return url.toString();
};

const updateRepairStatus = async (repairId, status) => {
  await supabaseHelpers.update('repairs', { status }, { repair_id: repairId });
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
      <td>
        <select class="status-select" data-repair-id="${repair.repair_id}">
          <option value="Working" ${repair.status === 'Working' ? 'selected' : ''}>Working</option>
          <option value="Pending Parts" ${repair.status === 'Pending Parts' ? 'selected' : ''}>Pending Parts</option>
          <option value="Completed" ${repair.status === 'Completed' ? 'selected' : ''}>Completed</option>
          <option value="Cycle for Sale" ${repair.status === 'Cycle for Sale' ? 'selected' : ''}>Cycle for Sale</option>
        </select>
      </td>
      <td>${alerts.length ? alerts.join(', ') : 'No alerts'}</td>
      <td>
        <button type="button" class="secondary open-pos" data-repair-id="${repair.repair_id}">Add Parts / Finalize</button>
        <button type="button" class="secondary print-reg" data-repair-id="${repair.repair_id}">Print Slip</button>
      </td>
    `;
    repairsTableBody.appendChild(row);
  });

  repairsTableBody.querySelectorAll('.status-select').forEach((input) => {
    input.addEventListener('change', async () => {
      try {
        await updateRepairStatus(input.dataset.repairId, input.value);
        repairMessage.textContent = `Status updated for ${input.dataset.repairId}`;
      } catch (error) {
        repairMessage.textContent = `Status update failed: ${error.message}`;
      }
    });
  });

  repairsTableBody.querySelectorAll('.open-pos').forEach((btn) => {
    btn.addEventListener('click', () => {
      const repairId = normalizeRepairId(btn.dataset.repairId);
  repairsTableBody.querySelectorAll('.open-pos').forEach((btn) => {
    btn.addEventListener('click', () => {
      const repairId = btn.dataset.repairId;
      window.location.href = `pos.html?repairId=${encodeURIComponent(repairId)}`;
    });
  });

  repairsTableBody.querySelectorAll('.print-reg').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const { data } = await findRepairById(btn.dataset.repairId);
      const repairId = btn.dataset.repairId;
      const { data } = await supabaseClient
        .from('repairs')
        .select('*')
        .eq('repair_id', repairId)
        .maybeSingle();
      if (data) downloadRegistrationPdf(data);
    });
  });
};

const loadRepairs = async () => {
  try {
    const repairs = await supabaseHelpers.fetchAll('repairs', '*');
    repairs.sort((a, b) => new Date(b.predicted_date) - new Date(a.predicted_date));
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
    status: 'Working',
    unpaid_amount: 0,
  };

  try {
    await supabaseHelpers.insert('repairs', payload);
    repairMessage.textContent = `Repair created. ID: ${payload.repair_id}`;
    downloadRegistrationPdf(payload);
    publicStatusLink.textContent = buildPublicStatusUrl(payload.repair_id);
    repairForm.reset();
    loadRepairs();
  } catch (error) {
    repairMessage.textContent = `Error creating repair: ${error.message}`;
  }
});

repairSearchButton.addEventListener('click', async () => {
  const repairId = normalizeRepairId(repairSearchInput.value);
  if (!repairId) return;

  repairSearchInput.value = repairId;
  const { data, error } = await findRepairById(repairId);
  const { data, error } = await supabaseClient
    .from('repairs')
    .select('status, predicted_date, unpaid_amount')
    .eq('repair_id', repairId)
    .maybeSingle();

  if (error || !data) {
    repairStatus.textContent = 'Repair ID not found.';
    return;
  }

  repairStatus.textContent = `Status: ${data.status}. Predicted completion: ${new Date(data.predicted_date).toLocaleDateString()}. Balance: ${formatCurrency(data.unpaid_amount || 0)}`;
});

publicStatusLink.textContent = buildPublicStatusUrl();
loadRepairs();
