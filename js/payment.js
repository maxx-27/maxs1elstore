// ============================================
// MaxShop - TokoPay Payment Gateway Integration
// ============================================

let selectedPaymentMethod = null;
let pollingInterval = null;      // auto-poll timer
let pollingAttempts = 0;
const MAX_POLL_ATTEMPTS = 60;    // max ~5 minutes (60 × 5s)
const POLL_INTERVAL_MS = 5000;   // check every 5 seconds

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
    showToast('API Payment Gateway belum dikonfigurasi! Admin → API Setting.', 'error');
    return;
  }

  // Show processing modal & disable button
  showPaymentProcessing();
  document.getElementById('payBtn').disabled = true;

  // Generate unique ref_id
  const refId = generateOrderId();

  // Save pending order data for later delivery
  const pendingOrder = {
    refId,
    buyer: { name, email, phone, address },
    cart: JSON.parse(JSON.stringify(cart)),
    method: selectedPaymentMethod,
    total,
    createdAt: new Date().toISOString()
  };
  localStorage.setItem('pendingOrder', JSON.stringify(pendingOrder));

  try {
    const orderUrl = `${TOKOPAY_API_BASE}?merchant=${encodeURIComponent(creds.merchant)}&secret=${encodeURIComponent(creds.secret)}&ref_id=${encodeURIComponent(refId)}&nominal=${total}&metode=${encodeURIComponent(selectedPaymentMethod)}`;

    const response = await fetch(orderUrl);
    const result = await response.json();

    if (result.status === 'Success' && result.data) {
      // Save pending order to orders list
      savePendingOrderLocal(refId, result.data);
      // Show payment details + start auto-polling
      showPaymentDetails(result.data, refId, total);
      startPolling(refId);
    } else {
      showPaymentError(result.status || 'Gagal membuat order.');
    }
  } catch (error) {
    console.error('TokoPay API Error:', error);
    showPaymentError('Gagal menghubungi server pembayaran. Cek koneksi dan konfigurasi API.');
  }
}

// === START AUTO-POLLING ===
function startPolling(refId) {
  stopPolling(); // clear any existing timer
  pollingAttempts = 0;

  pollingInterval = setInterval(async () => {
    pollingAttempts++;

    // Stop after max attempts
    if (pollingAttempts >= MAX_POLL_ATTEMPTS) {
      stopPolling();
      updatePollingStatus('⏱️ Waktu habis. Klik "Cek Status" jika sudah bayar.', false);
      return;
    }

    const paid = await checkStatusSilently(refId);
    if (paid) {
      stopPolling();
      completePaymentAfterConfirm(refId);
    } else {
      // Update the countdown display
      const remaining = (MAX_POLL_ATTEMPTS - pollingAttempts) * (POLL_INTERVAL_MS / 1000);
      const mins = Math.floor(remaining / 60);
      const secs = remaining % 60;
      updatePollingStatus(`🔄 Menunggu pembayaran... (${mins}:${String(secs).padStart(2, '0')})`, true);
    }
  }, POLL_INTERVAL_MS);
}

// === STOP POLLING ===
function stopPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
}

// === UPDATE POLLING STATUS TEXT ===
function updatePollingStatus(text, isActive) {
  const el = document.getElementById('pollingStatus');
  if (el) {
    el.innerHTML = text;
    el.style.color = isActive ? 'var(--accent-1)' : 'var(--text-muted)';
  }
}

// === SILENT STATUS CHECK (returns true if paid) ===
async function checkStatusSilently(refId) {
  const creds = getTokopayCredentials();
  if (!creds.merchant || !creds.secret) return false;

  try {
    // TokoPay: sending same ref_id returns the existing order status
    const url = `${TOKOPAY_API_BASE}?merchant=${encodeURIComponent(creds.merchant)}&secret=${encodeURIComponent(creds.secret)}&ref_id=${encodeURIComponent(refId)}&nominal=1&metode=${encodeURIComponent(selectedPaymentMethod || 'QRISREALTIME')}`;
    const response = await fetch(url);
    const result = await response.json();

    // TokoPay sends 'Success' or 'Completed' when paid
    return result.status === 'Success' || result.status === 'Completed';
  } catch {
    return false;
  }
}

// === MANUAL STATUS CHECK (from button) ===
async function checkPaymentStatus(refId) {
  stopPolling();
  showToast('Mengecek status pembayaran...', 'info');

  const paid = await checkStatusSilently(refId);
  if (paid) {
    completePaymentAfterConfirm(refId);
  } else {
    showToast('Pembayaran belum diterima. Pastikan Anda sudah scan & konfirmasi.', 'info');
    // Restart polling
    startPolling(refId);
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

// === SHOW PAYMENT DETAILS ===
function showPaymentDetails(data, refId, total) {
  const content = document.getElementById('paymentModalContent');
  const methodName = TOKOPAY_METHOD_NAMES[selectedPaymentMethod] || selectedPaymentMethod;

  let paymentInfoHTML = '';

  // QRIS: show QR code image from TokoPay
  if (data.qr_link) {
    paymentInfoHTML = `
      <div style="margin:16px 0;">
        <div style="background:white;border-radius:16px;padding:20px;display:inline-block;box-shadow:0 4px 24px rgba(0,0,0,0.3);">
          <img src="${data.qr_link}" alt="QRIS QR Code"
               style="width:220px;height:220px;object-fit:contain;display:block;"
               onerror="this.style.display='none';document.getElementById('qrFallback').style.display='block';">
        </div>
        <div id="qrFallback" style="display:none;padding:14px;font-size:0.82rem;color:var(--text-secondary);">
          QR gagal dimuat. Gunakan link pembayaran di bawah.
        </div>
        <p style="font-size:0.82rem;color:var(--text-secondary);margin-top:10px;">
          Scan dengan e-wallet atau mobile banking manapun
        </p>
      </div>
    `;
  }

  // Virtual Account: show VA number with copy button
  if (data.nomor_va) {
    paymentInfoHTML = `
      <div style="margin:16px 0;">
        <p style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:8px;">Nomor Virtual Account:</p>
        <div style="background:var(--bg-glass);border:2px solid var(--border-active);border-radius:var(--radius-sm);
                    padding:16px 20px;cursor:pointer;transition:var(--transition);"
             onclick="copyToClipboard('${data.nomor_va}')" title="Klik untuk salin">
          <div style="font-size:1.5rem;font-weight:900;letter-spacing:3px;color:var(--accent-1);">${data.nomor_va}</div>
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
          Klik tombol berikut untuk membayar via ${methodName}
        </p>
        <a href="${data.checkout_url}" target="_blank" class="btn btn-success" style="width:auto;display:inline-flex;">
          📱 Buka Aplikasi ${methodName}
        </a>
      </div>
    `;
  }

  content.innerHTML = `
    <div class="modal-icon">💳</div>
    <h3>Selesaikan Pembayaran</h3>
    <p>via <strong>${methodName}</strong> — akun akan dikirim otomatis setelah lunas</p>

    ${paymentInfoHTML}

    <!-- Auto-polling status indicator -->
    <div id="pollingStatus"
         style="font-size:0.82rem;color:var(--accent-1);margin:8px 0 16px;min-height:20px;
                display:flex;align-items:center;justify-content:center;gap:6px;">
      🔄 Menunggu konfirmasi pembayaran...
    </div>

    <div style="background:var(--bg-glass);border:1px solid var(--border-glass);
                border-radius:var(--radius-sm);padding:14px;margin-bottom:16px;text-align:left;">
      <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
        <span style="color:var(--text-muted);font-size:0.78rem;">ID Pesanan</span>
        <span style="font-weight:700;font-size:0.78rem;">${refId}</span>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
        <span style="color:var(--text-muted);font-size:0.78rem;">TrxID TokoPay</span>
        <span style="font-weight:700;font-size:0.78rem;">${data.trx_id || '-'}</span>
      </div>
      <div style="display:flex;justify-content:space-between;">
        <span style="color:var(--text-muted);font-size:0.78rem;">Total Bayar</span>
        <span style="font-weight:800;background:var(--accent-gradient);
                     -webkit-background-clip:text;-webkit-text-fill-color:transparent;
                     background-clip:text;">${formatRupiah(data.total_bayar || total)}</span>
      </div>
    </div>

    ${data.pay_url ? `
      <a href="${data.pay_url}" target="_blank"
         style="display:block;margin-bottom:10px;"
         class="btn btn-primary">
        🔗 Buka Halaman TokoPay
      </a>` : ''}

    <div style="display:flex;gap:10px;justify-content:center;">
      <button class="btn btn-secondary" style="flex:1;" onclick="checkPaymentStatus('${refId}')">
        ✅ Sudah Bayar
      </button>
      <a href="index.html" class="btn btn-secondary" style="flex:1;"
         onclick="stopPolling()">
        ← Kembali
      </a>
    </div>
  `;
}

// === SAVE PENDING ORDER TO localStorage ===
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
    method: selectedPaymentMethod || pending.method,
    status: 'pending',
    tokopayTrxId: tokopayData.trx_id || '',
    payUrl: tokopayData.pay_url || '',
    date: new Date().toISOString()
  };

  const orders = getOrders();
  const idx = orders.findIndex(o => o.id === refId);
  if (idx >= 0) orders[idx] = order; else orders.unshift(order);
  saveOrders(orders);
}

// === COMPLETE PAYMENT — DELIVER ACCOUNTS ===
function completePaymentAfterConfirm(refId) {
  stopPolling();

  const content = document.getElementById('paymentModalContent');
  const orders = getOrders();
  const order = orders.find(o => o.id === refId);

  if (!order) {
    showToast('Pesanan tidak ditemukan!', 'error');
    return;
  }

  // Prevent double delivery
  if (order.status === 'paid') {
    showSuccessScreen(order);
    return;
  }

  const products = getProducts();
  const deliveredAccounts = [];

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
      deliveredAccounts.push({ productName: item.name, accounts: takenAccounts });
    }
  });

  saveProducts(products);

  order.status = 'paid';
  saveOrders(orders);

  // Clear cart & pending order
  saveCart([]);
  localStorage.removeItem('pendingOrder');

  showSuccessScreen(order, deliveredAccounts);
}

// === SHOW SUCCESS SCREEN ===
function showSuccessScreen(order, deliveredAccounts) {
  const content = document.getElementById('paymentModalContent');
  const methodName = TOKOPAY_METHOD_NAMES[order.method] || order.method;

  // Build accounts from items if deliveredAccounts not passed
  const accounts = deliveredAccounts || order.items.map(i => ({
    productName: i.name,
    accounts: i.accounts || []
  }));

  const accountsHTML = accounts.map(da => `
    <div style="margin-top:12px;">
      <div style="font-weight:700;font-size:0.88rem;margin-bottom:8px;color:var(--accent-1);">
        📱 ${da.productName}
      </div>
      ${da.accounts.map((acc, i) => `
        <div style="background:var(--bg-glass);border:1px solid rgba(0,230,118,0.2);
                    border-radius:var(--radius-xs);padding:12px;margin-bottom:8px;text-align:left;">
          <div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:4px;">Akun ${i + 1}</div>
          <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
            <span style="color:var(--text-muted);font-size:0.8rem;">Email/User:</span>
            <span style="font-weight:700;font-size:0.8rem;color:var(--success);cursor:pointer;"
                  onclick="copyToClipboard('${acc.email}')" title="Klik salin">
              ${acc.email} 📋
            </span>
          </div>
          <div style="display:flex;justify-content:space-between;">
            <span style="color:var(--text-muted);font-size:0.8rem;">Password:</span>
            <span style="font-weight:700;font-size:0.8rem;color:var(--success);cursor:pointer;"
                  onclick="copyToClipboard('${acc.password}')" title="Klik salin">
              ${acc.password} 📋
            </span>
          </div>
        </div>
      `).join('')}
    </div>
  `).join('');

  content.innerHTML = `
    <div class="modal-icon" style="color:var(--success);">✅</div>
    <h3>Pembayaran Berhasil!</h3>
    <p>Dikonfirmasi TokoPay via <strong>${methodName}</strong></p>

    <div style="background:rgba(0,230,118,0.06);border:1px solid rgba(0,230,118,0.2);
                border-radius:var(--radius-sm);padding:16px;margin:16px 0;">
      <h4 style="font-size:0.95rem;margin-bottom:4px;">🎉 Data Akun Premium Anda</h4>
      <p style="font-size:0.75rem;color:var(--text-muted);margin-bottom:8px;">
        Simpan baik-baik! Klik email/password untuk salin.
      </p>
      ${accountsHTML}
    </div>

    <div style="background:var(--bg-glass);border:1px solid var(--border-glass);
                border-radius:var(--radius-sm);padding:14px;margin-bottom:16px;text-align:left;">
      <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
        <span style="color:var(--text-muted);font-size:0.78rem;">ID Pesanan</span>
        <span style="font-weight:700;font-size:0.78rem;">${order.id}</span>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
        <span style="color:var(--text-muted);font-size:0.78rem;">Total Bayar</span>
        <span style="font-weight:800;background:var(--accent-gradient);
                     -webkit-background-clip:text;-webkit-text-fill-color:transparent;
                     background-clip:text;">${formatRupiah(order.total)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;">
        <span style="color:var(--text-muted);font-size:0.78rem;">Status</span>
        <span class="status-badge paid">Lunas ✅</span>
      </div>
    </div>

    <a href="index.html" class="btn btn-primary">🛒 Lanjut Belanja</a>
  `;
}

// === COPY TO CLIPBOARD ===
function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    showToast(`"${text}" disalin!`, 'success');
  }).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast('Berhasil disalin!', 'success');
  });
}

// === SHOW PAYMENT ERROR ===
function showPaymentError(message) {
  const content = document.getElementById('paymentModalContent');
  content.innerHTML = `
    <div class="modal-icon" style="color:var(--danger);">❌</div>
    <h3>Gagal Membuat Pesanan</h3>
    <p style="margin-bottom:16px;">${message}</p>
    <div style="background:rgba(255,23,68,0.06);border:1px solid rgba(255,23,68,0.15);
                border-radius:var(--radius-sm);padding:14px;margin-bottom:20px;text-align:left;">
      <p style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:6px;">Pastikan:</p>
      <ul style="font-size:0.78rem;color:var(--text-muted);padding-left:16px;">
        <li>Merchant ID dan Secret Key sudah benar</li>
        <li>Mode sudah <strong>Production</strong> di API Setting</li>
        <li>Akun TokoPay aktif dan terverifikasi</li>
      </ul>
    </div>
    <div style="display:flex;gap:10px;justify-content:center;">
      <button class="btn btn-primary" style="width:auto;" onclick="closePaymentModal()">Coba Lagi</button>
      <a href="index.html" class="btn btn-secondary" style="width:auto;">Kembali</a>
    </div>
  `;
  document.getElementById('payBtn').disabled = false;
}

// === CLOSE PAYMENT MODAL ===
function closePaymentModal() {
  stopPolling();
  document.getElementById('paymentModal').classList.remove('show');
  document.getElementById('payBtn').disabled = false;
}
