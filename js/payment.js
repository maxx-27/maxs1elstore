// ============================================
// MaxShop - TokoPay Payment Gateway Integration
// ============================================

let selectedPaymentMethod = null;

document.addEventListener('DOMContentLoaded', () => {
  renderOrderSummary();
});

// === TokoPay API Config ===
const TOKOPAY_API_BASE = 'https://api.tokopay.id/v1/order';

function getTokopayCredentials() {
  const settings = getApiSettings();
  return {
    merchant: settings.apiKey || '',
    secret: settings.apiSecret || ''
  };
}

// === METHOD NAMES MAP ===
const TOKOPAY_METHOD_NAMES = {
  QRISREALTIME: 'QRIS',
  QRIS: 'QRIS',
  BCAVA: 'BCA Virtual Account',
  BNIVA: 'BNI Virtual Account',
  BRIVA: 'BRI Virtual Account',
  MANDIRIVA: 'Mandiri Virtual Account',
  GOPAY: 'GoPay',
  OVO: 'OVO',
  DANA: 'DANA',
  SHOPEEPAY: 'ShopeePay',
  LINKAJA: 'LinkAja'
};

// === RENDER ORDER SUMMARY ===
function renderOrderSummary() {
  const container = document.getElementById('orderSummary');
  const totalEl = document.getElementById('orderTotal');
  if (!container) return;

  const cart = getCart();
  const products = getProducts();

  if (cart.length === 0) {
    container.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:20px 0;">Keranjang kosong. <a href="index.html" style="color:var(--accent-1);">Kembali belanja</a></p>';
    return;
  }

  let total = 0;
  container.innerHTML = cart.map(item => {
    const product = products.find(p => p.id === item.id);
    if (!product) return '';
    const subtotal = product.price * item.qty;
    total += subtotal;
    return `
      <div class="order-item">
        <span class="item-name">${product.name} × ${item.qty}</span>
        <span class="item-price">${formatRupiah(subtotal)}</span>
      </div>`;
  }).join('');

  if (totalEl) totalEl.textContent = formatRupiah(total);
}

// === SELECT PAYMENT METHOD ===
function selectPayment(el) {
  document.querySelectorAll('.payment-method').forEach(m => m.classList.remove('selected'));
  el.classList.add('selected');
  selectedPaymentMethod = el.dataset.method;
  document.getElementById('payBtn').disabled = false;
}

// === PROCESS PAYMENT ===
async function processPayment() {
  const name = document.getElementById('buyerName').value.trim();
  const email = document.getElementById('buyerEmail').value.trim();
  const phone = document.getElementById('buyerPhone').value.trim();
  const address = document.getElementById('buyerAddress').value.trim();

  if (!name || !email || !phone) {
    showToast('Mohon lengkapi data pembeli (nama, email, no HP)!', 'error');
    return;
  }

  if (!selectedPaymentMethod) {
    showToast('Mohon pilih metode pembayaran!', 'error');
    return;
  }

  const cart = getCart();
  if (cart.length === 0) {
    showToast('Keranjang kosong!', 'error');
    return;
  }

  const products = getProducts();
  for (const item of cart) {
    const product = products.find(p => p.id === item.id);
    if (!product || product.stock < item.qty) {
      showToast(`Stok ${product ? product.name : 'produk'} tidak mencukupi!`, 'error');
      return;
    }
  }

  // Calculate total
  let total = 0;
  cart.forEach(item => {
    const product = products.find(p => p.id === item.id);
    if (product) total += product.price * item.qty;
  });

  // Get TokoPay credentials
  const creds = getTokopayCredentials();
  if (!creds.merchant || !creds.secret) {
    showToast('API Payment Gateway belum dikonfigurasi! Silakan setting di Admin → API Setting.', 'error');
    return;
  }

  // Show processing modal
  showPaymentProcessing();

  // Disable pay button
  document.getElementById('payBtn').disabled = true;

  // Generate unique ref_id
  const refId = generateOrderId();

  // Save pending order with buyer data in localStorage (for after redirect)
  const pendingOrder = {
    refId: refId,
    buyer: { name, email, phone, address },
    cart: JSON.parse(JSON.stringify(cart)),
    method: selectedPaymentMethod,
    total: total,
    createdAt: new Date().toISOString()
  };
  localStorage.setItem('pendingOrder', JSON.stringify(pendingOrder));

  try {
    // Build TokoPay Simple Order URL
    const orderUrl = `${TOKOPAY_API_BASE}?merchant=${encodeURIComponent(creds.merchant)}&secret=${encodeURIComponent(creds.secret)}&ref_id=${encodeURIComponent(refId)}&nominal=${total}&metode=${encodeURIComponent(selectedPaymentMethod)}`;

    // Call TokoPay API
    const response = await fetch(orderUrl);
    const result = await response.json();

    if (result.status === 'Success' && result.data) {
      // Show success with payment details
      showPaymentDetails(result.data, refId, total);
    } else {
      // API returned error
      showPaymentError(result.status || 'Gagal membuat order. Cek konfigurasi API Anda.');
    }
  } catch (error) {
    console.error('TokoPay API Error:', error);
    showPaymentError('Gagal menghubungi server pembayaran. Periksa koneksi internet dan konfigurasi API Anda.');
  }
}

// === SHOW PROCESSING MODAL ===
function showPaymentProcessing() {
  const modal = document.getElementById('paymentModal');
  const content = document.getElementById('paymentModalContent');

  content.innerHTML = `
    <div class="spinner"></div>
    <h3>Membuat Pesanan...</h3>
    <p>Menghubungkan ke TokoPay Payment Gateway.<br>Mohon tunggu sebentar.</p>
  `;

  modal.classList.add('show');
}

// === SHOW PAYMENT DETAILS (from TokoPay response) ===
function showPaymentDetails(data, refId, total) {
  const content = document.getElementById('paymentModalContent');
  const methodName = TOKOPAY_METHOD_NAMES[selectedPaymentMethod] || selectedPaymentMethod;

  let paymentInfoHTML = '';

  // QRIS: show QR code image
  if (data.qr_link) {
    paymentInfoHTML = `
      <div style="margin:16px 0;">
        <div style="background:white;border-radius:16px;padding:20px;display:inline-block;">
          <img src="${data.qr_link}" alt="QRIS QR Code" style="width:220px;height:220px;object-fit:contain;" 
               onerror="this.style.display='none';this.parentElement.innerHTML='<p style=color:#666;padding:20px;>QR gagal dimuat. Gunakan link pembayaran di bawah.</p>';">
        </div>
        <p style="font-size:0.85rem;color:var(--text-secondary);margin-top:12px;">
          Scan QR code di atas menggunakan<br>e-wallet atau mobile banking Anda
        </p>
      </div>
    `;
  }

  // Virtual Account: show VA number
  if (data.nomor_va) {
    paymentInfoHTML = `
      <div style="margin:16px 0;">
        <p style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:8px;">Nomor Virtual Account:</p>
        <div style="background:var(--bg-glass);border:2px solid var(--border-active);border-radius:var(--radius-sm);padding:16px;margin:0 auto;max-width:320px;cursor:pointer;" 
             onclick="copyToClipboard('${data.nomor_va}')">
          <span style="font-size:1.4rem;font-weight:900;letter-spacing:2px;color:var(--accent-1);">${data.nomor_va}</span>
          <p style="font-size:0.72rem;color:var(--text-muted);margin-top:6px;">📋 Klik untuk salin</p>
        </div>
      </div>
    `;
  }

  // E-Wallet checkout URL
  if (data.checkout_url && !data.qr_link && !data.nomor_va) {
    paymentInfoHTML = `
      <div style="margin:16px 0;">
        <p style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:12px;">
          Klik tombol di bawah untuk melanjutkan pembayaran via ${methodName}
        </p>
        <a href="${data.checkout_url}" target="_blank" class="btn btn-success" style="width:auto;display:inline-flex;">
          📱 Buka ${methodName}
        </a>
      </div>
    `;
  }

  content.innerHTML = `
    <div class="modal-icon">💳</div>
    <h3>Pesanan Dibuat!</h3>
    <p>Silakan selesaikan pembayaran Anda via <strong>${methodName}</strong></p>

    ${paymentInfoHTML}

    <div style="background:var(--bg-glass);border:1px solid var(--border-glass);border-radius:var(--radius-sm);padding:16px;margin:16px 0;text-align:left;">
      <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
        <span style="color:var(--text-muted);font-size:0.82rem;">ID Pesanan</span>
        <span style="font-weight:700;font-size:0.82rem;">${refId}</span>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
        <span style="color:var(--text-muted);font-size:0.82rem;">TokoPay TRX ID</span>
        <span style="font-weight:700;font-size:0.82rem;">${data.trx_id || '-'}</span>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
        <span style="color:var(--text-muted);font-size:0.82rem;">Total Bayar</span>
        <span style="font-weight:800;background:var(--accent-gradient);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">${formatRupiah(data.total_bayar || total)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;">
        <span style="color:var(--text-muted);font-size:0.82rem;">Status</span>
        <span class="status-badge pending">Menunggu Pembayaran</span>
      </div>
    </div>

    ${data.pay_url ? `
      <a href="${data.pay_url}" target="_blank" class="btn btn-primary" style="margin-bottom:10px;">
        🔗 Buka Halaman Pembayaran TokoPay
      </a>` : ''}

    <div style="display:flex;gap:10px;justify-content:center;margin-top:8px;">
      <button class="btn btn-secondary" style="width:auto;" onclick="checkPaymentStatus('${refId}')">
        🔄 Cek Status Pembayaran
      </button>
      <a href="index.html" class="btn btn-secondary" style="width:auto;">
        🛒 Kembali ke Toko
      </a>
    </div>

    <p style="font-size:0.72rem;color:var(--text-muted);margin-top:16px;">
      Setelah pembayaran berhasil, akun premium akan dikirim otomatis.
    </p>
  `;

  // Save order as pending in local orders
  savePendingOrderLocal(refId, data);
}

// === SAVE PENDING ORDER LOCALLY ===
function savePendingOrderLocal(refId, tokopayData) {
  const pending = JSON.parse(localStorage.getItem('pendingOrder') || '{}');
  const products = getProducts();
  const cart = pending.cart || getCart();

  const orderItems = [];
  cart.forEach(item => {
    const product = products.find(p => p.id === item.id);
    if (product) {
      orderItems.push({
        productId: product.id,
        name: product.name,
        price: product.price,
        qty: item.qty,
        subtotal: product.price * item.qty
      });
    }
  });

  const order = {
    id: refId,
    buyer: pending.buyer || {},
    items: orderItems,
    total: pending.total || 0,
    method: selectedPaymentMethod,
    status: 'pending',
    tokopayTrxId: tokopayData.trx_id || '',
    payUrl: tokopayData.pay_url || '',
    date: new Date().toISOString()
  };

  const orders = getOrders();
  // Avoid duplicate
  const existingIdx = orders.findIndex(o => o.id === refId);
  if (existingIdx >= 0) {
    orders[existingIdx] = order;
  } else {
    orders.unshift(order);
  }
  saveOrders(orders);
}

// === CHECK PAYMENT STATUS ===
async function checkPaymentStatus(refId) {
  const creds = getTokopayCredentials();
  if (!creds.merchant || !creds.secret) {
    showToast('API belum dikonfigurasi!', 'error');
    return;
  }

  showToast('Mengecek status pembayaran...', 'info');

  try {
    // TokoPay: creating order with same ref_id returns status
    const url = `${TOKOPAY_API_BASE}?merchant=${encodeURIComponent(creds.merchant)}&secret=${encodeURIComponent(creds.secret)}&ref_id=${encodeURIComponent(refId)}&nominal=0&metode=QRISREALTIME`;
    const response = await fetch(url);
    const result = await response.json();

    if (result.status === 'Success' || result.status === 'Completed') {
      // Payment confirmed! Deliver accounts
      completePaymentAfterConfirm(refId);
    } else if (result.status === 'Pending') {
      showToast('Pembayaran belum diterima. Silakan selesaikan pembayaran Anda.', 'info');
    } else {
      showToast(`Status: ${result.status || 'Unknown'}. Silakan coba lagi.`, 'info');
    }
  } catch (error) {
    console.error('Status check error:', error);
    showToast('Gagal mengecek status. Periksa koneksi internet.', 'error');
  }
}

// === COMPLETE PAYMENT AFTER CONFIRMATION ===
function completePaymentAfterConfirm(refId) {
  const content = document.getElementById('paymentModalContent');
  const orders = getOrders();
  const order = orders.find(o => o.id === refId);

  if (!order) {
    showToast('Pesanan tidak ditemukan!', 'error');
    return;
  }

  const products = getProducts();
  const deliveredAccounts = [];

  // Deliver accounts from stock
  order.items.forEach(item => {
    const product = products.find(p => p.id === item.productId);
    if (product) {
      const takenAccounts = [];
      for (let i = 0; i < item.qty; i++) {
        if (product.accounts && product.accounts.length > 0) {
          takenAccounts.push(product.accounts.shift());
        } else {
          takenAccounts.push({ email: 'Akun sedang diproses manual', password: '-' });
        }
      }
      product.stock = product.accounts ? product.accounts.length : 0;
      item.accounts = takenAccounts;

      deliveredAccounts.push({
        productName: item.name,
        accounts: takenAccounts
      });
    }
  });

  // Update product stock
  saveProducts(products);

  // Update order status
  order.status = 'paid';
  saveOrders(orders);

  // Clear cart and pending order
  saveCart([]);
  localStorage.removeItem('pendingOrder');

  // Show success with account data
  let accountsHTML = deliveredAccounts.map(da => `
    <div style="margin-top:14px;">
      <div style="font-weight:700;font-size:0.92rem;margin-bottom:8px;color:var(--accent-1);">📱 ${da.productName}</div>
      ${da.accounts.map((acc, i) => `
        <div style="background:var(--bg-glass);border:1px solid var(--border-glass);border-radius:var(--radius-xs);padding:12px;margin-bottom:8px;text-align:left;">
          <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:4px;">Akun ${i + 1}</div>
          <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
            <span style="color:var(--text-muted);font-size:0.82rem;">Email/User:</span>
            <span style="font-weight:700;font-size:0.82rem;color:var(--success);">${acc.email}</span>
          </div>
          <div style="display:flex;justify-content:space-between;">
            <span style="color:var(--text-muted);font-size:0.82rem;">Password:</span>
            <span style="font-weight:700;font-size:0.82rem;color:var(--success);">${acc.password}</span>
          </div>
        </div>
      `).join('')}
    </div>
  `).join('');

  const methodName = TOKOPAY_METHOD_NAMES[selectedPaymentMethod] || order.method;

  content.innerHTML = `
    <div class="modal-icon" style="color: var(--success);">✅</div>
    <h3>Pembayaran Berhasil!</h3>
    <p>Pembayaran melalui <strong>${methodName}</strong> telah dikonfirmasi oleh TokoPay.</p>
    <div style="background:var(--bg-glass);border:1px solid var(--border-glass);border-radius:var(--radius-sm);padding:16px;margin:16px 0;text-align:left;">
      <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
        <span style="color:var(--text-muted);font-size:0.82rem;">ID Pesanan</span>
        <span style="font-weight:700;font-size:0.88rem;">${order.id}</span>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
        <span style="color:var(--text-muted);font-size:0.82rem;">Total Bayar</span>
        <span style="font-weight:800;background:var(--accent-gradient);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">${formatRupiah(order.total)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;">
        <span style="color:var(--text-muted);font-size:0.82rem;">Status</span>
        <span class="status-badge paid">Lunas ✅</span>
      </div>
    </div>

    <div style="background:rgba(0,230,118,0.06);border:1px solid rgba(0,230,118,0.15);border-radius:var(--radius-sm);padding:16px;margin:16px 0;">
      <h4 style="font-size:0.95rem;margin-bottom:4px;">🎉 Data Akun Premium Anda</h4>
      <p style="font-size:0.78rem;color:var(--text-muted);margin-bottom:8px;">Simpan data akun di bawah ini dengan baik!</p>
      ${accountsHTML}
    </div>

    <div style="display:flex;gap:10px;justify-content:center;">
      <a href="index.html" class="btn btn-primary" style="width:auto;">🛒 Lanjut Belanja</a>
    </div>
  `;
}

// === COPY TO CLIPBOARD ===
function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    showToast('Nomor VA berhasil disalin!', 'success');
  }).catch(() => {
    // Fallback
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    showToast('Nomor VA berhasil disalin!', 'success');
  });
}

// === SHOW PAYMENT ERROR ===
function showPaymentError(message) {
  const content = document.getElementById('paymentModalContent');
  content.innerHTML = `
    <div class="modal-icon" style="color:var(--danger);">❌</div>
    <h3>Gagal Membuat Pesanan</h3>
    <p style="margin-bottom:16px;">${message}</p>
    <div style="background:rgba(255,23,68,0.06);border:1px solid rgba(255,23,68,0.15);border-radius:var(--radius-sm);padding:14px;margin-bottom:20px;text-align:left;">
      <p style="font-size:0.82rem;color:var(--text-secondary);">Pastikan:</p>
      <ul style="font-size:0.78rem;color:var(--text-muted);padding-left:16px;margin-top:6px;">
        <li>Merchant ID (API Key) dan Secret sudah benar</li>
        <li>Mode sudah set ke Production di API Setting</li>
        <li>Akun TokoPay aktif dan terverifikasi</li>
        <li>Saldo merchant mencukupi</li>
      </ul>
    </div>
    <div style="display:flex;gap:10px;justify-content:center;">
      <button class="btn btn-primary" style="width:auto;" onclick="closePaymentModal()">Coba Lagi</button>
      <a href="index.html" class="btn btn-secondary" style="width:auto;">Kembali ke Toko</a>
    </div>
  `;

  // Re-enable pay button
  document.getElementById('payBtn').disabled = false;
}

// === CLOSE PAYMENT MODAL ===
function closePaymentModal() {
  document.getElementById('paymentModal').classList.remove('show');
  document.getElementById('payBtn').disabled = false;
}
