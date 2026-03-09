// ============================================
// MaxShop - Payment Gateway (QRIS + Bank + E-Wallet)
// ============================================

let selectedPaymentMethod = null;

document.addEventListener('DOMContentLoaded', () => {
  renderOrderSummary();
});

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
function processPayment() {
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

  showPaymentProcessing();

  // QRIS gets a slightly longer delay for "scanning" simulation
  const processingTime = selectedPaymentMethod === 'qris'
    ? 3000 + Math.random() * 2000
    : 2000 + Math.random() * 2000;

  setTimeout(() => {
    completePayment(name, email, phone, address);
  }, processingTime);
}

// === SHOW PROCESSING MODAL ===
function showPaymentProcessing() {
  const modal = document.getElementById('paymentModal');
  const content = document.getElementById('paymentModalContent');

  const methodNames = {
    qris: 'QRIS',
    bca: 'BCA', bni: 'BNI', mandiri: 'Mandiri', bri: 'BRI',
    gopay: 'GoPay', ovo: 'OVO', dana: 'DANA', shopeepay: 'ShopeePay'
  };

  if (selectedPaymentMethod === 'qris') {
    // Generate a simulated QR code visual
    content.innerHTML = `
      <div style="margin-bottom:20px;">
        <div style="background:white;border-radius:16px;padding:20px;display:inline-block;margin-bottom:16px;">
          <svg viewBox="0 0 200 200" width="180" height="180" xmlns="http://www.w3.org/2000/svg">
            ${generateQRPattern()}
          </svg>
        </div>
        <h3 style="margin-bottom:4px;">Scan QRIS</h3>
        <p style="font-size:0.85rem;">Buka aplikasi e-wallet atau mobile banking Anda, lalu scan QR code di atas.</p>
        <p style="font-size:0.8rem;color:var(--accent-1);margin-top:8px;">⏳ Menunggu pembayaran...</p>
      </div>
      <div class="spinner"></div>
    `;
  } else {
    content.innerHTML = `
      <div class="spinner"></div>
      <h3>Memproses Pembayaran...</h3>
      <p>Menghubungkan ke ${methodNames[selectedPaymentMethod] || selectedPaymentMethod}.<br>Mohon tunggu sebentar.</p>
    `;
  }

  modal.classList.add('show');
}

// === GENERATE SIMPLE QR CODE PATTERN ===
function generateQRPattern() {
  let rects = '';
  const size = 8;
  const grid = 25;

  // Fixed corners (QR finder patterns)
  const corners = [
    [0, 0], [0, grid - 7], [grid - 7, 0]
  ];

  corners.forEach(([sx, sy]) => {
    // Outer border
    for (let i = 0; i < 7; i++) {
      rects += `<rect x="${(sx + i) * size}" y="${sy * size}" width="${size}" height="${size}" fill="#1a1a2e"/>`;
      rects += `<rect x="${(sx + i) * size}" y="${(sy + 6) * size}" width="${size}" height="${size}" fill="#1a1a2e"/>`;
      rects += `<rect x="${sx * size}" y="${(sy + i) * size}" width="${size}" height="${size}" fill="#1a1a2e"/>`;
      rects += `<rect x="${(sx + 6) * size}" y="${(sy + i) * size}" width="${size}" height="${size}" fill="#1a1a2e"/>`;
    }
    // Inner block
    for (let i = 2; i < 5; i++) {
      for (let j = 2; j < 5; j++) {
        rects += `<rect x="${(sx + i) * size}" y="${(sy + j) * size}" width="${size}" height="${size}" fill="#1a1a2e"/>`;
      }
    }
  });

  // Random data pattern
  for (let i = 0; i < grid; i++) {
    for (let j = 0; j < grid; j++) {
      const inCorner = corners.some(([cx, cy]) =>
        i >= cx && i < cx + 7 && j >= cy && j < cy + 7
      );
      if (!inCorner && Math.random() > 0.55) {
        const color = Math.random() > 0.7 ? '#7b2fff' : '#1a1a2e';
        rects += `<rect x="${i * size}" y="${j * size}" width="${size}" height="${size}" fill="${color}" rx="1"/>`;
      }
    }
  }

  return rects;
}

// === COMPLETE PAYMENT ===
function completePayment(name, email, phone, address) {
  const cart = getCart();
  const products = getProducts();
  const content = document.getElementById('paymentModalContent');

  let total = 0;
  const orderItems = [];
  const deliveredAccounts = [];

  cart.forEach(item => {
    const product = products.find(p => p.id === item.id);
    if (product) {
      const subtotal = product.price * item.qty;
      total += subtotal;

      const takenAccounts = [];
      for (let i = 0; i < item.qty; i++) {
        if (product.accounts && product.accounts.length > 0) {
          takenAccounts.push(product.accounts.shift());
        } else {
          takenAccounts.push({ email: 'Akun sedang diproses', password: '-' });
        }
      }
      product.stock = product.accounts ? product.accounts.length : 0;

      orderItems.push({
        productId: product.id,
        name: product.name,
        price: product.price,
        qty: item.qty,
        subtotal: subtotal,
        accounts: takenAccounts
      });

      deliveredAccounts.push({
        productName: product.name,
        accounts: takenAccounts
      });
    }
  });
  saveProducts(products);

  const order = {
    id: generateOrderId(),
    buyer: { name, email, phone, address },
    items: orderItems,
    total: total,
    method: selectedPaymentMethod,
    status: 'paid',
    date: new Date().toISOString()
  };

  const orders = getOrders();
  orders.unshift(order);
  saveOrders(orders);
  saveCart([]);

  const methodNames = {
    qris: 'QRIS',
    bca: 'BCA', bni: 'BNI', mandiri: 'Mandiri', bri: 'BRI',
    gopay: 'GoPay', ovo: 'OVO', dana: 'DANA', shopeepay: 'ShopeePay'
  };

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

  content.innerHTML = `
    <div class="modal-icon" style="color: var(--success);">✅</div>
    <h3>Pembayaran Berhasil!</h3>
    <p>Pembayaran melalui <strong>${methodNames[selectedPaymentMethod]}</strong> telah dikonfirmasi.</p>
    <div style="background:var(--bg-glass);border:1px solid var(--border-glass);border-radius:var(--radius-sm);padding:16px;margin:16px 0;text-align:left;">
      <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
        <span style="color:var(--text-muted);font-size:0.82rem;">ID Pesanan</span>
        <span style="font-weight:700;font-size:0.88rem;">${order.id}</span>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
        <span style="color:var(--text-muted);font-size:0.82rem;">Total Bayar</span>
        <span style="font-weight:800;background:var(--accent-gradient);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">${formatRupiah(total)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;">
        <span style="color:var(--text-muted);font-size:0.82rem;">Status</span>
        <span class="status-badge paid">Lunas</span>
      </div>
    </div>

    <div style="background:rgba(0,230,118,0.06);border:1px solid rgba(0,230,118,0.15);border-radius:var(--radius-sm);padding:16px;margin:16px 0;">
      <h4 style="font-size:0.95rem;margin-bottom:4px;">🎉 Data Akun Anda</h4>
      <p style="font-size:0.78rem;color:var(--text-muted);margin-bottom:8px;">Simpan data akun di bawah ini dengan baik!</p>
      ${accountsHTML}
    </div>

    <p style="font-size:0.82rem;color:var(--text-muted);margin-bottom:16px;">Detail juga dikirim ke <strong>${email}</strong></p>
    <div style="display:flex;gap:10px;justify-content:center;">
      <a href="index.html" class="btn btn-primary" style="width:auto;">🛒 Lanjut Belanja</a>
    </div>
  `;
}
