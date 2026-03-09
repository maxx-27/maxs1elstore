// ============================================
// TokoKu - Admin Panel Logic (App Premium)
// ============================================

// === AUTH CHECK ===
(function checkAuth() {
  if (localStorage.getItem('adminLoggedIn') !== 'true') {
    window.location.href = 'admin.html';
  }
})();

// === INIT ===
document.addEventListener('DOMContentLoaded', () => {
  loadDashboard();
  loadProductsTable();
  loadOrdersTable();
  loadAccountsPanel();
  loadApiSettingsForm();
  updateApiStatus();
  setupSidebarResponsive();
});

// === SIDEBAR NAVIGATION ===
function switchPanel(panelName, linkEl) {
  document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.sidebar-nav a').forEach(a => a.classList.remove('active'));

  const panel = document.getElementById(`panel-${panelName}`);
  if (panel) panel.classList.add('active');
  if (linkEl) linkEl.classList.add('active');

  const titles = {
    dashboard: 'Dashboard',
    products: 'Manajemen App Premium',
    accounts: 'Data Akun',
    orders: 'Daftar Pesanan',
    api: 'API Setting'
  };
  document.getElementById('pageTitle').textContent = titles[panelName] || 'Dashboard';

  if (panelName === 'dashboard') loadDashboard();
  if (panelName === 'products') loadProductsTable();
  if (panelName === 'orders') loadOrdersTable();
  if (panelName === 'accounts') loadAccountsPanel();
  if (panelName === 'api') { loadApiSettingsForm(); updateApiStatus(); }

  if (window.innerWidth <= 768) {
    document.getElementById('adminSidebar')?.classList.remove('open');
  }
}

// === DASHBOARD STATS ===
function loadDashboard() {
  const products = getProducts();
  const orders = getOrders();

  const totalAccounts = products.reduce((sum, p) => sum + (p.accounts ? p.accounts.length : 0), 0);
  const paidOrders = orders.filter(o => o.status === 'paid');
  const totalRevenue = paidOrders.reduce((sum, o) => sum + o.total, 0);

  document.getElementById('statProducts').textContent = products.length;
  document.getElementById('statAccounts').textContent = totalAccounts;
  document.getElementById('statRevenue').textContent = formatRupiah(totalRevenue);
  document.getElementById('statOrders').textContent = orders.length;

  const tbody = document.getElementById('recentOrdersTable');
  if (orders.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:24px;">Belum ada pesanan</td></tr>';
    return;
  }

  const methodNames = {
    qris: 'QRIS',
    bca: 'BCA', bni: 'BNI', mandiri: 'Mandiri', bri: 'BRI',
    gopay: 'GoPay', ovo: 'OVO', dana: 'DANA', shopeepay: 'ShopeePay'
  };

  tbody.innerHTML = orders.slice(0, 5).map(order => {
    const date = new Date(order.date);
    const formatted = `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    const statusClass = order.status === 'paid' ? 'paid' : order.status === 'pending' ? 'pending' : 'cancelled';
    const statusText = order.status === 'paid' ? 'Lunas' : order.status === 'pending' ? 'Menunggu' : 'Dibatalkan';

    return `
      <tr>
        <td style="font-weight:600;font-size:0.85rem;">${order.id}</td>
        <td>${order.buyer.name}</td>
        <td style="font-weight:600;">${formatRupiah(order.total)}</td>
        <td>${methodNames[order.method] || order.method}</td>
        <td><span class="status-badge ${statusClass}">${statusText}</span></td>
        <td style="color:var(--text-muted);font-size:0.85rem;">${formatted}</td>
      </tr>`;
  }).join('');
}

// === PRODUCTS TABLE ===
function loadProductsTable() {
  const products = getProducts();
  const tbody = document.getElementById('productsTable');
  if (!tbody) return;

  if (products.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:24px;">Belum ada app premium. Klik "Tambah App" untuk memulai.</td></tr>';
    return;
  }

  tbody.innerHTML = products.map(p => `
    <tr>
      <td>
        <div class="product-cell">
          <img src="${p.image || 'https://via.placeholder.com/44/1e293b/64748b?text=App'}" 
               alt="${p.name}" class="product-thumb" 
               style="object-fit:contain;background:var(--bg-glass);padding:4px;"
               onerror="this.src='https://via.placeholder.com/44/1e293b/64748b?text=App'">
          <span>${p.name}</span>
        </div>
      </td>
      <td style="font-weight:600;">${formatRupiah(p.price)}</td>
      <td style="font-size:0.85rem;">${p.duration || '1 Bulan'}</td>
      <td>
        <span class="status-badge ${p.stock > 0 ? 'paid' : 'cancelled'}">
          ${p.stock > 0 ? p.stock + ' akun' : 'Kosong'}
        </span>
      </td>
      <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text-muted);font-size:0.85rem;">
        ${p.desc}
      </td>
      <td>
        <div class="action-btns">
          <button class="action-btn" onclick="editProduct(${p.id})" title="Edit">✏️</button>
          <button class="action-btn delete" onclick="deleteProduct(${p.id})" title="Hapus">🗑️</button>
        </div>
      </td>
    </tr>
  `).join('');
}

// === ORDERS TABLE ===
function loadOrdersTable() {
  const orders = getOrders();
  const tbody = document.getElementById('allOrdersTable');
  if (!tbody) return;

  if (orders.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:24px;">Belum ada pesanan</td></tr>';
    return;
  }

  const methodNames = {
    qris: 'QRIS',
    bca: 'BCA', bni: 'BNI', mandiri: 'Mandiri', bri: 'BRI',
    gopay: 'GoPay', ovo: 'OVO', dana: 'DANA', shopeepay: 'ShopeePay'
  };

  tbody.innerHTML = orders.map(order => {
    const date = new Date(order.date);
    const formatted = `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    const statusClass = order.status === 'paid' ? 'paid' : order.status === 'pending' ? 'pending' : 'cancelled';
    const statusText = order.status === 'paid' ? 'Lunas' : order.status === 'pending' ? 'Menunggu' : 'Dibatalkan';
    const itemNames = order.items.map(i => `${i.name} (${i.qty})`).join(', ');

    return `
      <tr>
        <td style="font-weight:600;font-size:0.85rem;">${order.id}</td>
        <td>${order.buyer.name}</td>
        <td style="font-size:0.85rem;color:var(--text-muted);">${order.buyer.email}</td>
        <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:0.85rem;" title="${itemNames}">
          ${itemNames}
        </td>
        <td style="font-weight:600;">${formatRupiah(order.total)}</td>
        <td>${methodNames[order.method] || order.method}</td>
        <td><span class="status-badge ${statusClass}">${statusText}</span></td>
        <td style="color:var(--text-muted);font-size:0.85rem;">${formatted}</td>
      </tr>`;
  }).join('');
}

// ==========================================
// ACCOUNTS PANEL
// ==========================================

function loadAccountsPanel() {
  populateProductDropdowns();
  loadAccountStockTable();
}

function populateProductDropdowns() {
  const products = getProducts();
  const options = products.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
  const defaultOpt = '<option value="">-- Pilih App --</option>';

  const accSelect = document.getElementById('accProduct');
  const bulkSelect = document.getElementById('bulkProduct');
  if (accSelect) accSelect.innerHTML = defaultOpt + options;
  if (bulkSelect) bulkSelect.innerHTML = defaultOpt + options;
}

// === ADD SINGLE ACCOUNT ===
function addSingleAccount() {
  const productId = parseInt(document.getElementById('accProduct').value);
  const email = document.getElementById('accEmail').value.trim();
  const password = document.getElementById('accPassword').value.trim();

  if (!productId) {
    showToast('Mohon pilih app premium!', 'error');
    return;
  }
  if (!email || !password) {
    showToast('Mohon isi email/username dan password!', 'error');
    return;
  }

  const products = getProducts();
  const product = products.find(p => p.id === productId);
  if (!product) return;

  if (!Array.isArray(product.accounts)) product.accounts = [];
  product.accounts.push({ email, password });
  product.stock = product.accounts.length;

  saveProducts(products);

  // Clear inputs
  document.getElementById('accEmail').value = '';
  document.getElementById('accPassword').value = '';

  loadAccountStockTable();
  loadDashboard();
  showToast(`Akun berhasil ditambahkan untuk ${product.name}!`);
}

// === ADD BULK ACCOUNTS ===
function addBulkAccounts() {
  const productId = parseInt(document.getElementById('bulkProduct').value);
  const bulkText = document.getElementById('bulkAccounts').value.trim();

  if (!productId) {
    showToast('Mohon pilih app premium!', 'error');
    return;
  }
  if (!bulkText) {
    showToast('Mohon masukkan data akun!', 'error');
    return;
  }

  const lines = bulkText.split('\n').filter(l => l.trim());
  if (lines.length === 0) {
    showToast('Tidak ada data akun yang valid!', 'error');
    return;
  }

  const products = getProducts();
  const product = products.find(p => p.id === productId);
  if (!product) return;

  if (!Array.isArray(product.accounts)) product.accounts = [];

  let added = 0;
  lines.forEach(line => {
    const parts = line.trim().split('|');
    if (parts.length >= 2) {
      product.accounts.push({
        email: parts[0].trim(),
        password: parts[1].trim()
      });
      added++;
    }
  });

  product.stock = product.accounts.length;
  saveProducts(products);

  document.getElementById('bulkAccounts').value = '';

  loadAccountStockTable();
  loadDashboard();
  showToast(`${added} akun berhasil ditambahkan untuk ${product.name}!`);
}

// === ACCOUNT STOCK TABLE ===
function loadAccountStockTable() {
  const products = getProducts();
  const tbody = document.getElementById('accountStockTable');
  if (!tbody) return;

  const hasAccounts = products.some(p => p.accounts && p.accounts.length > 0);

  if (!hasAccounts) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:24px;">Belum ada data akun. Tambahkan akun di atas.</td></tr>';
    return;
  }

  tbody.innerHTML = products.filter(p => p.accounts && p.accounts.length > 0).map(p => `
    <tr>
      <td>
        <div class="product-cell">
          <img src="${p.image || 'https://via.placeholder.com/44/1e293b/64748b?text=App'}" 
               alt="${p.name}" class="product-thumb"
               style="object-fit:contain;background:var(--bg-glass);padding:4px;"
               onerror="this.src='https://via.placeholder.com/44/1e293b/64748b?text=App'">
          <span>${p.name}</span>
        </div>
      </td>
      <td>
        <span class="status-badge ${p.accounts.length > 5 ? 'paid' : p.accounts.length > 0 ? 'pending' : 'cancelled'}">
          ${p.accounts.length} akun
        </span>
      </td>
      <td>
        <button class="btn btn-secondary btn-sm" onclick="showAccountDetails(${p.id})">👁️ Lihat</button>
      </td>
      <td>
        <button class="btn btn-danger btn-sm" onclick="clearAccounts(${p.id})">🗑️ Hapus Semua</button>
      </td>
    </tr>
  `).join('');
}

// === SHOW ACCOUNT DETAILS ===
function showAccountDetails(productId) {
  const products = getProducts();
  const product = products.find(p => p.id === productId);
  if (!product || !product.accounts) return;

  document.getElementById('accountDetailTitle').textContent = `Akun ${product.name} (${product.accounts.length})`;

  const content = document.getElementById('accountDetailContent');
  if (product.accounts.length === 0) {
    content.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:20px;">Tidak ada akun tersedia.</p>';
  } else {
    content.innerHTML = `
      <div style="max-height:400px;overflow-y:auto;">
        <table class="admin-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Email / Username</th>
              <th>Password</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            ${product.accounts.map((acc, i) => `
              <tr>
                <td>${i + 1}</td>
                <td style="font-size:0.85rem;">${acc.email}</td>
                <td style="font-size:0.85rem;font-family:monospace;">${acc.password}</td>
                <td><button class="action-btn delete" onclick="removeAccount(${productId}, ${i})" title="Hapus">🗑️</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>`;
  }

  document.getElementById('accountDetailModal').classList.add('show');
}

function closeAccountDetailModal() {
  document.getElementById('accountDetailModal')?.classList.remove('show');
}

// === REMOVE SINGLE ACCOUNT ===
function removeAccount(productId, index) {
  const products = getProducts();
  const product = products.find(p => p.id === productId);
  if (!product || !product.accounts) return;

  product.accounts.splice(index, 1);
  product.stock = product.accounts.length;
  saveProducts(products);

  showAccountDetails(productId);
  loadAccountStockTable();
  loadDashboard();
  showToast('Akun berhasil dihapus!', 'info');
}

// === CLEAR ALL ACCOUNTS ===
function clearAccounts(productId) {
  const products = getProducts();
  const product = products.find(p => p.id === productId);
  if (!product) return;

  if (confirm(`Yakin ingin menghapus semua akun untuk ${product.name}?`)) {
    product.accounts = [];
    product.stock = 0;
    saveProducts(products);
    loadAccountStockTable();
    loadDashboard();
    showToast(`Semua akun ${product.name} berhasil dihapus!`, 'info');
  }
}

// ==========================================
// API SETTINGS
// ==========================================

function loadApiSettingsForm() {
  const settings = getApiSettings();
  const ids = ['apiKey', 'apiSecret', 'webhookUrl', 'paymentMode', 'notifEmail', 'notifTelegram', 'telegramBotToken', 'telegramChatId'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = settings[id] || '';
  });
  const autoConfirm = document.getElementById('autoConfirm');
  if (autoConfirm) autoConfirm.checked = settings.autoConfirm !== false;
}

function saveApiSettingsForm(e) {
  e.preventDefault();

  const settings = {
    apiKey: document.getElementById('apiKey').value.trim(),
    apiSecret: document.getElementById('apiSecret').value.trim(),
    webhookUrl: document.getElementById('webhookUrl').value.trim(),
    paymentMode: document.getElementById('paymentMode').value,
    autoConfirm: document.getElementById('autoConfirm').checked,
    notifEmail: document.getElementById('notifEmail').value.trim(),
    notifTelegram: document.getElementById('notifTelegram').value.trim(),
    telegramBotToken: document.getElementById('telegramBotToken').value.trim(),
    telegramChatId: document.getElementById('telegramChatId').value.trim()
  };

  saveApiSettings(settings);
  updateApiStatus();
  showToast('Pengaturan API berhasil disimpan!');
  return false;
}

function updateApiStatus() {
  const settings = getApiSettings();

  const paymentEl = document.getElementById('apiStatusPayment');
  const emailEl = document.getElementById('apiStatusEmail');
  const telegramEl = document.getElementById('apiStatusTelegram');

  if (paymentEl) {
    if (settings.apiKey && settings.apiSecret) {
      paymentEl.textContent = settings.paymentMode === 'production' ? 'Production ✅' : 'Sandbox 🧪';
      paymentEl.className = 'status-badge ' + (settings.paymentMode === 'production' ? 'paid' : 'pending');
    } else {
      paymentEl.textContent = 'Belum Dikonfigurasi';
      paymentEl.className = 'status-badge pending';
    }
  }

  if (emailEl) {
    if (settings.notifEmail) {
      emailEl.textContent = 'Aktif ✅';
      emailEl.className = 'status-badge paid';
    } else {
      emailEl.textContent = 'Belum Dikonfigurasi';
      emailEl.className = 'status-badge pending';
    }
  }

  if (telegramEl) {
    if (settings.telegramBotToken && settings.telegramChatId) {
      telegramEl.textContent = 'Aktif ✅';
      telegramEl.className = 'status-badge paid';
    } else {
      telegramEl.textContent = 'Belum Dikonfigurasi';
      telegramEl.className = 'status-badge pending';
    }
  }
}

// ==========================================
// PRODUCT CRUD
// ==========================================

function openProductModal(productId = null) {
  const modal = document.getElementById('productModal');
  const title = document.getElementById('productModalTitle');
  const form = document.getElementById('productForm');

  form.reset();
  document.getElementById('editProductId').value = '';

  if (productId) {
    const products = getProducts();
    const product = products.find(p => p.id === productId);
    if (product) {
      title.textContent = 'Edit App Premium';
      document.getElementById('editProductId').value = product.id;
      document.getElementById('prodName').value = product.name;
      document.getElementById('prodPrice').value = product.price;
      document.getElementById('prodDuration').value = product.duration || '1 Bulan';
      document.getElementById('prodDesc').value = product.desc;
      document.getElementById('prodImage').value = product.image || '';
    }
  } else {
    title.textContent = 'Tambah App Premium Baru';
  }

  modal.classList.add('show');
}

function closeProductModal() {
  document.getElementById('productModal')?.classList.remove('show');
}

function saveProduct(e) {
  e.preventDefault();

  const editId = document.getElementById('editProductId').value;
  const name = document.getElementById('prodName').value.trim();
  const price = parseInt(document.getElementById('prodPrice').value);
  const duration = document.getElementById('prodDuration').value.trim() || '1 Bulan';
  const desc = document.getElementById('prodDesc').value.trim();
  const image = document.getElementById('prodImage').value.trim();

  if (!name || isNaN(price)) {
    showToast('Mohon lengkapi data app premium!', 'error');
    return false;
  }

  let products = getProducts();

  if (editId) {
    const idx = products.findIndex(p => p.id === parseInt(editId));
    if (idx !== -1) {
      products[idx] = {
        ...products[idx],
        name, price, duration, desc,
        image: image || products[idx].image
      };
      showToast(`"${name}" berhasil diperbarui!`);
    }
  } else {
    const newId = products.length > 0 ? Math.max(...products.map(p => p.id)) + 1 : 1;
    products.push({
      id: newId,
      name, price, duration, desc,
      stock: 0,
      accounts: [],
      image: image || `https://via.placeholder.com/400x300/1e293b/64748b?text=${encodeURIComponent(name)}`
    });
    showToast(`"${name}" berhasil ditambahkan!`);
  }

  saveProducts(products);
  closeProductModal();
  loadProductsTable();
  loadAccountsPanel();
  loadDashboard();
  return false;
}

function editProduct(productId) {
  openProductModal(productId);
}

function deleteProduct(productId) {
  const products = getProducts();
  const product = products.find(p => p.id === productId);
  if (!product) return;

  if (confirm(`Yakin ingin menghapus "${product.name}"?`)) {
    const filtered = products.filter(p => p.id !== productId);
    saveProducts(filtered);
    loadProductsTable();
    loadAccountsPanel();
    loadDashboard();
    showToast(`"${product.name}" berhasil dihapus!`, 'info');
  }
}

// === LOGOUT ===
function adminLogout() {
  localStorage.removeItem('adminLoggedIn');
  window.location.href = 'admin.html';
}

// === SIDEBAR RESPONSIVE ===
function setupSidebarResponsive() {
  const toggleBtn = document.getElementById('sidebarToggle');
  if (window.innerWidth <= 768 && toggleBtn) {
    toggleBtn.style.display = 'block';
  }
  window.addEventListener('resize', () => {
    if (toggleBtn) {
      toggleBtn.style.display = window.innerWidth <= 768 ? 'block' : 'none';
    }
  });
}

function toggleAdminSidebar() {
  document.getElementById('adminSidebar')?.classList.toggle('open');
}
