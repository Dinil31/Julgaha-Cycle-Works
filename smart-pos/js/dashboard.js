const dashboardSales = document.querySelector('#dashboard-sales');
const dashboardLowStock = document.querySelector('#dashboard-low-stock');
const dashboardRepairs = document.querySelector('#dashboard-repairs');
const dashboardSalary = document.querySelector('#dashboard-salary');
const dashboardAlerts = document.querySelector('#dashboard-alerts');

const formatCurrency = (value) => `LKR ${Number(value || 0).toFixed(2)}`;

const loadDashboard = async () => {
  try {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();

    const { data: salesData } = await supabaseClient
      .from('sales')
      .select('total_amount')
      .gte('date', startOfDay);

    const totalSales = (salesData || []).reduce((sum, sale) => sum + Number(sale.total_amount || 0), 0);
    dashboardSales.textContent = formatCurrency(totalSales);

    const products = await supabaseHelpers.fetchAll('products', '*');
    const lowStockCount = products.filter((product) => product.stock < product.reorder_level).length;
    dashboardLowStock.textContent = lowStockCount;

    const repairs = await supabaseHelpers.fetchAll('repairs', '*');
    const pendingRepairs = repairs.filter((repair) => repair.status !== 'Completed');
    dashboardRepairs.textContent = pendingRepairs.length;

    const daysUntilSalary = 25 - today.getDate();
    dashboardSalary.textContent = daysUntilSalary >= 0 ? `${daysUntilSalary} day(s)` : 'Salary payment due';

    dashboardAlerts.innerHTML = '';
    if (lowStockCount > 0) {
      dashboardAlerts.innerHTML += `<li>${lowStockCount} item(s) need reorder.</li>`;
    }
    if (pendingRepairs.length > 0) {
      dashboardAlerts.innerHTML += `<li>${pendingRepairs.length} repairs pending delivery.</li>`;
    }
    if (daysUntilSalary <= 3) {
      dashboardAlerts.innerHTML += `<li>Salary payout is coming soon.</li>`;
    }
    if (dashboardAlerts.innerHTML === '') {
      dashboardAlerts.innerHTML = '<li>No urgent alerts.</li>';
    }
  } catch (error) {
    dashboardAlerts.innerHTML = `<li>Unable to load dashboard data: ${error.message}</li>`;
  }
};

loadDashboard();
