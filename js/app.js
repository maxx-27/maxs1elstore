// ============================================
// TokoKu - App Premium Store Logic
// ============================================

// === DEFAULT APP PREMIUM PRODUCTS ===
const DEFAULT_PRODUCTS = [
    {
        id: 1,
        name: 'Spotify Premium',
        price: 15000,
        stock: 0,
        desc: 'Akun Spotify Premium 1 bulan, bisa dengar musik tanpa iklan dan offline.',
        image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/84/Spotify_icon.svg/512px-Spotify_icon.svg.png',
        duration: '1 Bulan',
        accounts: []
    },
    {
        id: 2,
        name: 'Netflix Premium',
        price: 25000,
        stock: 0,
        desc: 'Akun Netflix Premium UHD 4K, 1 profil private, nonton sepuasnya.',
        image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/08/Netflix_2015_logo.svg/512px-Netflix_2015_logo.svg.png',
        duration: '1 Bulan',
        accounts: []
    },
    {
        id: 3,
        name: 'YouTube Premium',
        price: 12000,
        stock: 0,
        desc: 'YouTube Premium tanpa iklan, bisa putar di background dan download.',
        image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/09/YouTube_full-color_icon_%282017%29.svg/512px-YouTube_full-color_icon_%282017%29.svg.png',
        duration: '1 Bulan',
        accounts: []
    },
    {
        id: 4,
        name: 'Disney+ Hotstar',
        price: 18000,
        stock: 0,
        desc: 'Akun Disney+ Hotstar Premium, nonton film Marvel, Star Wars, dll.',
        image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Disney%2B_logo.svg/512px-Disney%2B_logo.svg.png',
        duration: '1 Bulan',
        accounts: []
    },
    {
        id: 5,
        name: 'Canva Pro',
        price: 20000,
        stock: 0,
        desc: 'Akun Canva Pro 1 bulan, akses semua template dan fitur premium.',
        image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bb/Canva_Logo.svg/512px-Canva_Logo.svg.png',
        duration: '1 Bulan',
        accounts: []
    },
    {
        id: 6,
        name: 'ChatGPT Plus',
        price: 35000,
        stock: 0,
        desc: 'Akun ChatGPT Plus dengan akses GPT-4, respons lebih cepat.',
        image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/04/ChatGPT_logo.svg/512px-ChatGPT_logo.svg.png',
        duration: '1 Bulan',
        accounts: []
    },
    {
        id: 7,
        name: 'VPN Premium',
        price: 10000,
        stock: 0,
        desc: 'VPN Premium unlimited bandwidth, 50+ server, akses cepat dan aman.',
        image: 'https://images.unsplash.com/photo-1614064641938-3bbee52942c7?w=400&h=300&fit=crop',
        duration: '1 Bulan',
        accounts: []
    },
    {
        id: 8,
        name: 'Zoom Pro',
        price: 22000,
        stock: 0,
        desc: 'Akun Zoom Pro meeting tanpa batas waktu, hingga 100 peserta.',
        image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/11/Zoom_Logo_2022.svg/512px-Zoom_Logo_2022.svg.png',
        duration: '1 Bulan',
        accounts: []
    }
];

// === INIT DATA ===
function initProducts() {
    const existing = localStorage.getItem('products');
    if (!existing) {
        localStorage.setItem('products', JSON.stringify(DEFAULT_PRODUCTS));
    } else {
        // Migrate old products: ensure they have accounts array & duration
        let products = JSON.parse(existing);
        let needsUpdate = false;
        products.forEach(p => {
            if (!Array.isArray(p.accounts)) {
                p.accounts = [];
                p.stock = 0;
                needsUpdate = true;
            }
            if (!p.duration) {
                p.duration = '1 Bulan';
                needsUpdate = true;
            }
        });
        if (needsUpdate) saveProducts(products);
    }
}

function getProducts() {
    initProducts();
    return JSON.parse(localStorage.getItem('products')) || [];
}

function saveProducts(products) {
    localStorage.setItem('products', JSON.stringify(products));
}

function getCart() {
    return JSON.parse(localStorage.getItem('cart')) || [];
}

function saveCart(cart) {
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartBadge();
}

function getOrders() {
    return JSON.parse(localStorage.getItem('orders')) || [];
}

function saveOrders(orders) {
    localStorage.setItem('orders', JSON.stringify(orders));
}

function getApiSettings() {
    return JSON.parse(localStorage.getItem('apiSettings')) || {
        apiKey: '',
        apiSecret: '',
        webhookUrl: '',
        paymentMode: 'sandbox',
        autoConfirm: true,
        notifEmail: '',
        notifTelegram: '',
        telegramBotToken: '',
        telegramChatId: ''
    };
}

function saveApiSettings(settings) {
    localStorage.setItem('apiSettings', JSON.stringify(settings));
}

// === FORMAT CURRENCY ===
function formatRupiah(amount) {
    return 'Rp ' + amount.toLocaleString('id-ID');
}

// === GENERATE ORDER ID ===
function generateOrderId() {
    const now = new Date();
    const y = now.getFullYear().toString().slice(-2);
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const rand = Math.floor(Math.random() * 9000) + 1000;
    return `ORD-${y}${m}${d}-${rand}`;
}

// === TOAST NOTIFICATION ===
function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const icons = { success: '✅', error: '❌', info: 'ℹ️' };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${icons[type] || '✅'}</span><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => { toast.remove(); }, 3000);
}

// === RENDER PRODUCTS (Landing Page) ===
function renderProducts() {
    const grid = document.getElementById('productsGrid');
    if (!grid) return;

    const products = getProducts();
    if (products.length === 0) {
        grid.innerHTML = '<p style="text-align:center;color:var(--text-muted);grid-column:1/-1;padding:48px 0;">Belum ada produk. Admin silakan tambah produk melalui dashboard.</p>';
        return;
    }

    grid.innerHTML = products.map(p => `
    <div class="product-card">
      <div class="product-img-wrap">
        <img src="${p.image || 'https://via.placeholder.com/400x300/1e293b/64748b?text=App'}" 
             alt="${p.name}" class="product-img" onerror="this.src='https://via.placeholder.com/400x300/1e293b/64748b?text=App'">
        <span class="product-duration-badge">${p.duration || '1 Bulan'}</span>
      </div>
      <div class="product-info">
        <h3 class="product-name">${p.name}</h3>
        <p class="product-desc">${p.desc}</p>
        <div class="product-meta">
          <span class="product-price">${formatRupiah(p.price)}</span>
          <span class="product-stock ${p.stock <= 0 ? 'out' : ''}">
            ${p.stock > 0 ? `Stok: ${p.stock} akun` : 'Stok Habis'}
          </span>
        </div>
        <button class="btn btn-primary" onclick="addToCart(${p.id})" ${p.stock <= 0 ? 'disabled' : ''}>
          ${p.stock > 0 ? '🛒 Beli Sekarang' : '😔 Stok Habis'}
        </button>
      </div>
    </div>
  `).join('');
}

// === CART FUNCTIONS ===
function addToCart(productId) {
    const products = getProducts();
    const product = products.find(p => p.id === productId);
    if (!product || product.stock <= 0) return;

    let cart = getCart();
    const existing = cart.find(c => c.id === productId);

    if (existing) {
        if (existing.qty >= product.stock) {
            showToast('Stok akun tidak mencukupi!', 'error');
            return;
        }
        existing.qty++;
    } else {
        cart.push({ id: productId, qty: 1 });
    }

    saveCart(cart);
    showToast(`${product.name} ditambahkan ke keranjang!`);
    renderCartItems();
}

function removeFromCart(productId) {
    let cart = getCart().filter(c => c.id !== productId);
    saveCart(cart);
    renderCartItems();
    showToast('Produk dihapus dari keranjang', 'info');
}

function updateCartQty(productId, delta) {
    let cart = getCart();
    const products = getProducts();
    const item = cart.find(c => c.id === productId);
    const product = products.find(p => p.id === productId);

    if (!item) return;
    item.qty += delta;

    if (item.qty <= 0) {
        cart = cart.filter(c => c.id !== productId);
    } else if (product && item.qty > product.stock) {
        showToast('Stok akun tidak mencukupi!', 'error');
        return;
    }

    saveCart(cart);
    renderCartItems();
}

function renderCartItems() {
    const container = document.getElementById('cartItems');
    const totalEl = document.getElementById('cartTotal');
    const checkoutBtn = document.getElementById('checkoutBtn');
    if (!container) return;

    const cart = getCart();
    const products = getProducts();

    if (cart.length === 0) {
        container.innerHTML = `
      <div class="cart-empty">
        <div class="empty-icon">🛒</div>
        <p>Keranjang masih kosong</p>
        <p style="font-size:0.8rem;margin-top:4px;">Yuk beli app premium!</p>
      </div>`;
        if (totalEl) totalEl.textContent = 'Rp 0';
        if (checkoutBtn) checkoutBtn.style.opacity = '0.5';
        return;
    }

    if (checkoutBtn) checkoutBtn.style.opacity = '1';

    let total = 0;
    container.innerHTML = cart.map(item => {
        const product = products.find(p => p.id === item.id);
        if (!product) return '';
        const subtotal = product.price * item.qty;
        total += subtotal;
        return `
      <div class="cart-item">
        <img src="${product.image || 'https://via.placeholder.com/64/1e293b/64748b?text=App'}" 
             alt="${product.name}" class="cart-item-img" onerror="this.src='https://via.placeholder.com/64/1e293b/64748b?text=App'"
             style="object-fit:contain;background:var(--bg-glass);padding:6px;">
        <div class="cart-item-info">
          <div class="cart-item-name">${product.name}</div>
          <div class="cart-item-price">${formatRupiah(subtotal)}</div>
          <div class="cart-item-qty">
            <button class="qty-btn" onclick="updateCartQty(${product.id}, -1)">−</button>
            <span>${item.qty}</span>
            <button class="qty-btn" onclick="updateCartQty(${product.id}, 1)">+</button>
          </div>
          <button class="cart-item-remove" onclick="removeFromCart(${product.id})">Hapus</button>
        </div>
      </div>`;
    }).join('');

    if (totalEl) totalEl.textContent = formatRupiah(total);
}

function updateCartBadge() {
    const badge = document.getElementById('cartBadge');
    if (!badge) return;
    const cart = getCart();
    const totalItems = cart.reduce((sum, item) => sum + item.qty, 0);
    badge.textContent = totalItems;
    badge.style.display = totalItems > 0 ? 'flex' : 'none';
}

function openCart() {
    document.getElementById('cartOverlay')?.classList.add('open');
    document.getElementById('cartSidebar')?.classList.add('open');
    renderCartItems();
}

function closeCart() {
    document.getElementById('cartOverlay')?.classList.remove('open');
    document.getElementById('cartSidebar')?.classList.remove('open');
}

function canCheckout() {
    const cart = getCart();
    if (cart.length === 0) {
        showToast('Keranjang masih kosong!', 'error');
        return false;
    }
    return true;
}

// === MOBILE MENU ===
function toggleMenu() {
    document.getElementById('navLinks')?.classList.toggle('open');
}

// === RESET PRODUCTS (for migration) ===
function resetToAppPremium() {
    localStorage.setItem('products', JSON.stringify(DEFAULT_PRODUCTS));
    location.reload();
}

// === INIT ===
document.addEventListener('DOMContentLoaded', () => {
    initProducts();
    renderProducts();
    renderCartItems();
    updateCartBadge();
});
