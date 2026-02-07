const inventoryTableBody = document.querySelector('#inventory-table tbody');
const productForm = document.querySelector('#product-form');
const productMessage = document.querySelector('#product-message');
const lowStockSummary = document.querySelector('#low-stock-summary');
const lowStockPdfButton = document.querySelector('#low-stock-pdf');

const formatCurrency = (value) => `LKR ${Number(value || 0).toFixed(2)}`;

const renderInventory = (products) => {
  inventoryTableBody.innerHTML = '';
  const lowStockItems = products.filter((product) => product.stock < product.reorder_level);

  products.forEach((product) => {
    const row = document.createElement('tr');
    if (product.stock < product.reorder_level) {
      row.classList.add('low-stock');
    }

    row.innerHTML = `
      <td>${product.code}</td>
      <td>${product.name}</td>
      <td>${product.stock}</td>
      <td>${product.reorder_level}</td>
      <td>${formatCurrency(product.unit_price)}</td>
      <td>
        <span class="badge ${product.stock < product.reorder_level ? 'danger' : 'success'}">
          ${product.stock < product.reorder_level ? 'Reorder' : 'Healthy'}
        </span>
      </td>
    `;
    inventoryTableBody.appendChild(row);
  });

  lowStockSummary.innerHTML = `${lowStockItems.length} item(s) are below reorder level.`;
};

const fetchInventory = async () => {
  try {
    const products = await supabaseHelpers.fetchAll('products', '*');
    renderInventory(products);
  } catch (error) {
    productMessage.textContent = `Error loading inventory: ${error.message}`;
  }
};

productForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  productMessage.textContent = '';

  const formData = new FormData(productForm);
  const payload = {
    code: formData.get('code').trim(),
    name: formData.get('name').trim(),
    stock: Number(formData.get('stock')),
    reorder_level: Number(formData.get('reorder_level')),
    unit_price: Number(formData.get('unit_price')),
  };

  try {
    const { data: existing, error } = await supabaseClient
      .from('products')
      .select('id')
      .eq('code', payload.code)
      .maybeSingle();

    if (error) throw error;
    if (existing) {
      productMessage.textContent = 'Product code already exists. Please use a unique code.';
      return;
    }

    await supabaseHelpers.insert('products', payload);
    productMessage.textContent = 'Product saved successfully.';
    productForm.reset();
    fetchInventory();
  } catch (error) {
    productMessage.textContent = `Error saving product: ${error.message}`;
  }
});

lowStockPdfButton.addEventListener('click', async () => {
  try {
    const products = await supabaseHelpers.fetchAll('products', '*');
    const lowStockItems = products.filter((product) => product.stock < product.reorder_level);

    const printable = window.open('', '', 'width=800,height=600');
    if (!printable) return;

    printable.document.write(`
      <h1>Low Stock List</h1>
      <p>Generated on ${new Date().toLocaleString()}</p>
      <table border="1" cellspacing="0" cellpadding="8">
        <thead>
          <tr>
            <th>Code</th>
            <th>Name</th>
            <th>Stock</th>
            <th>Reorder Level</th>
          </tr>
        </thead>
        <tbody>
          ${lowStockItems
            .map(
              (item) => `
                <tr>
                  <td>${item.code}</td>
                  <td>${item.name}</td>
                  <td>${item.stock}</td>
                  <td>${item.reorder_level}</td>
                </tr>`
            )
            .join('')}
        </tbody>
      </table>
    `);
    printable.document.close();
    printable.focus();
    printable.print();
  } catch (error) {
    productMessage.textContent = `Error generating PDF: ${error.message}`;
  }
});

fetchInventory();
