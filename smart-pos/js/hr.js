const workerForm = document.querySelector('#worker-form');
const workerMessage = document.querySelector('#worker-message');
const workersTableBody = document.querySelector('#workers-table tbody');
const salaryForm = document.querySelector('#salary-form');
const salaryMessage = document.querySelector('#salary-message');
const salarySummary = document.querySelector('#salary-summary');
const salaryWorkerSelect = document.querySelector('#salary-worker');
const salaryPdfButton = document.querySelector('#salary-pdf');

const formatCurrency = (value) => `LKR ${Number(value || 0).toFixed(2)}`;

const sriLankanHolidays = [
  '01-01',
  '04-13',
  '04-14',
  '05-01',
  '12-25',
];

const isHoliday = (date) => {
  const monthDay = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return sriLankanHolidays.includes(monthDay);
};

const calculateWorkingDays = (year, month) => {
  const date = new Date(year, month, 1);
  let workingDays = 0;

  while (date.getMonth() === month) {
    const isMonday = date.getDay() === 1;
    if (!isMonday && !isHoliday(date)) {
      workingDays += 1;
    }
    date.setDate(date.getDate() + 1);
  }

  return workingDays;
};

const loadWorkers = async () => {
  const workers = await supabaseHelpers.fetchAll('workers', '*');
  workersTableBody.innerHTML = '';

  workers.forEach((worker) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${worker.name}</td>
      <td>${formatCurrency(worker.daily_salary)}</td>
    `;
    workersTableBody.appendChild(row);
  });

  salaryWorkerSelect.innerHTML = workers
    .map((worker) => `<option value="${worker.id}" data-salary="${worker.daily_salary}">${worker.name}</option>`)
    .join('');
};

workerForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  workerMessage.textContent = '';

  const formData = new FormData(workerForm);
  const payload = {
    name: formData.get('name').trim(),
    daily_salary: Number(formData.get('daily_salary')),
  };

  try {
    await supabaseHelpers.insert('workers', payload);
    workerMessage.textContent = 'Worker saved.';
    workerForm.reset();
    loadWorkers();
  } catch (error) {
    workerMessage.textContent = `Error saving worker: ${error.message}`;
  }
});

salaryForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  salaryMessage.textContent = '';

  const formData = new FormData(salaryForm);
  const workerId = formData.get('worker_id');
  const monthValue = formData.get('month');
  const deductions = Number(formData.get('deductions') || 0);

  if (!monthValue) {
    salaryMessage.textContent = 'Select a month.';
    return;
  }

  const [year, month] = monthValue.split('-').map(Number);
  const workingDays = calculateWorkingDays(year, month - 1);

  const workerOption = salaryWorkerSelect.querySelector(`option[value="${workerId}"]`);
  const dailySalary = Number(workerOption?.dataset.salary || 0);

  const grossSalary = workingDays * dailySalary;
  const finalSalary = Math.max(0, grossSalary - deductions);
  const epf = grossSalary * 0.08;
  const etf = grossSalary * 0.03;

  try {
    const payload = {
      worker_id: workerId,
      month: monthValue,
      deductions,
      final_salary: finalSalary,
    };
    await supabaseHelpers.insert('salary_records', payload);

    salarySummary.innerHTML = `
      <p>Working Days: <strong>${workingDays}</strong></p>
      <p>Gross Salary: <strong>${formatCurrency(grossSalary)}</strong></p>
      <p>Deductions/Advances: <strong>${formatCurrency(deductions)}</strong></p>
      <p>Final Salary: <strong>${formatCurrency(finalSalary)}</strong></p>
      <p>EPF (8%): <strong>${formatCurrency(epf)}</strong> | ETF (3%): <strong>${formatCurrency(etf)}</strong></p>
    `;

    salaryMessage.textContent = 'Salary record generated.';
  } catch (error) {
    salaryMessage.textContent = `Error saving salary record: ${error.message}`;
  }
});

salaryPdfButton.addEventListener('click', () => {
  const printable = window.open('', '', 'width=800,height=600');
  if (!printable) return;

  printable.document.write(`
    <h1>Salary Receipt</h1>
    <p>Generated on ${new Date().toLocaleString()}</p>
    ${salarySummary.innerHTML || '<p>No salary summary available.</p>'}
  `);
  printable.document.close();
  printable.focus();
  printable.print();
});

loadWorkers();
