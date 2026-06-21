import { PRODUCTS, CATEGORIES } from './products.js';

/* ==========================================================================
   CONFIG & WARD DATABASE
   ========================================================================== */
const CONFIG = {
  phone: "0978251639",
  zaloLink: "https://zalo.me/0978251639",
  address: "Cổng VSIP, Bái Dương, Cẩm Giàng, Hải Phòng",
  mapQuery: "Thảo Sâm Bakery, Cổng VSIP, Bái Dương, Cẩm Giàng, Hải Phòng",
  shopName: "Thảo Sâm Bakery",
  telegramToken: "8141649058:AAFr5zv-hEvXclVP7d_24M4e038L1m64qsQ",
  telegramChatId: "-5452133399"
};
/* ==========================================================================
   APP STATE
   ========================================================================== */
let cart = [];
let currentProduct = null;
let selectedSize = null;
let currentQty = 1;
let selectedTable = null;
let fulfillmentType = "table"; // 'table' or 'delivery'
let searchQuery = "";
let activeCategory = "cake1"; // Mặc định hiển thị danh mục đầu tiên

// Element Selector Helper
const $ = (id) => document.getElementById(id);

/* ==========================================================================
   INITIALIZATION & RENDERING
   ========================================================================== */
function init() {
  loadCart();
  renderTabs();
  renderMenu();
  setupEventListeners();
  wireContactLinks();
  updateCartUI();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

// Load cart from sessionStorage / memory
function loadCart() {
  try {
    const saved = window.sessionStorage.getItem("__thaosam_cart");
    if (saved) {
      cart = JSON.parse(saved);
    }
  } catch (e) {
    console.error("Could not load cart data", e);
  }
}

// Save cart to sessionStorage
function saveCart() {
  try {
    window.sessionStorage.setItem("__thaosam_cart", JSON.stringify(cart));
  } catch (e) {
    console.error("Could not save cart data", e);
  }
}

// Render the category navigation tabs
function renderTabs() {
  const container = $("tabsContainer");
  if (!container) return;

  container.innerHTML = CATEGORIES.map((cat, index) => {
    // Đếm số mặt hàng của danh mục này trong danh sách sản phẩm
    const count = PRODUCTS.filter(p => p.cat === cat.id).length;
    return `
      <button class="tab-item ${cat.id === activeCategory ? 'active' : ''}" data-cat="${cat.id}" id="tabBtn_${cat.id}">
        <span>${cat.name}</span>
        <span class="tab-count">${count}</span>
      </button>
    `;
  }).join("");

  // Gắn trình xử lý sự kiện nhấp vào các tab
  document.querySelectorAll(".tab-item").forEach(tab => {
    tab.addEventListener("click", () => {
      const catId = tab.dataset.cat;
      activeCategory = catId;
      renderTabs();
      renderMenu();
      scrollToMenu();
    });
  });
}

// Render the product list grouped by category
function renderMenu() {
  const container = $("menuSections");
  if (!container) return;

  let html = "";

  if (searchQuery === "") {
    // Không tìm kiếm: chỉ hiển thị danh mục đang hoạt động (activeCategory)
    const cat = CATEGORIES.find(c => c.id === activeCategory);
    if (cat) {
      const filtered = PRODUCTS.filter(p => p.cat === cat.id);
      if (filtered.length > 0) {
        html = renderCategorySection(cat, filtered);
      }
    }
  } else {
    // Có tìm kiếm: hiển thị tất cả sản phẩm khớp ở tất cả các danh mục
    CATEGORIES.forEach(cat => {
      const filtered = PRODUCTS.filter(p => {
        const matchCat = p.cat === cat.id;
        const matchSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (p.desc && p.desc.toLowerCase().includes(searchQuery.toLowerCase()));
        return matchCat && matchSearch;
      });

      if (filtered.length > 0) {
        html += renderCategorySection(cat, filtered);
      }
    });
  }

  if (html === "") {
    container.innerHTML = `
      <div class="empty-search">
        <div class="empty-search-icon">🔍</div>
        <h3>Không tìm thấy món phù hợp</h3>
        <p>Thử tìm kiếm với từ khóa khác xem sao bạn nhé!</p>
      </div>
    `;
  } else {
    container.innerHTML = html;
  }
}

// Helper to render a category section
function renderCategorySection(cat, filtered) {
  const cardHtml = filtered.map(p => {
    let sizeText = "";
    let priceNum = 0;

    const catObj = CATEGORIES.find(c => c.id === p.cat);
    if (catObj && catObj.sizes && catObj.sizes.length > 0) {
      const minSz = catObj.sizes[0].label;
      const maxSz = catObj.sizes[catObj.sizes.length - 1].label;
      sizeText = catObj.sizes.length > 1 ? `Cỡ ${minSz} - ${maxSz}` : `Cỡ ${minSz}`;
      priceNum = catObj.sizes[0].price;
    } else {
      sizeText = "Liên hệ";
      priceNum = 0;
    }

    return `
      <div class="card" id="card_${p.id}" onclick="openProductCustomizer('${p.id}')">
        <div class="card-img-box">
          <img src="${p.img}" alt="${p.name}" loading="lazy">
          <span class="card-badge">${cat.name.split(" ")[1] || "Món"}</span>
        </div>
        <div class="card-body">
          <h4 class="card-name">${p.name}</h4>
          <p class="card-desc">${p.desc || ""}</p>
          <div class="card-foot">
            <div class="card-price-info">
              <small>${sizeText}</small>
              <span class="card-price">${formatPrice(priceNum)}</span>
            </div>
            <button class="add-btn" aria-label="Thêm vào giỏ">
              <svg viewBox="0 0 24 24" stroke="currentColor"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join("");

  return `
    <div class="section" id="sec_${cat.id}">
      <div class="section-head">
        <span class="section-decor-dot"></span>
        <h2 class="section-title">${cat.name}</h2>
        <span class="section-count">${filtered.length} món</span>
      </div>
      <div class="products-grid">
        ${cardHtml}
      </div>
    </div>
  `;
}

// Utility to format currency values
function formatPrice(num) {
  return num.toLocaleString("vi-VN") + "đ";
}

/* ==========================================================================
   EVENT LISTENERS & SYSTEM INTERFACES
   ========================================================================== */
function setupEventListeners() {
  // Dịch cuộn chuột dọc thành cuộn ngang cho thanh danh mục trên máy tính
  const tabsContainer = $("tabsContainer");
  if (tabsContainer) {
    tabsContainer.addEventListener("wheel", (e) => {
      if (tabsContainer.scrollWidth > tabsContainer.clientWidth) {
        e.preventDefault();
        tabsContainer.scrollLeft += e.deltaY;
      }
    }, { passive: false });
  }

  // Speed dial toggle
  $("dialToggle").addEventListener("click", (e) => {
    e.stopPropagation();
    $("contactDock").classList.toggle("open");
  });

  // Close speed dial when clicking outside
  document.addEventListener("click", (e) => {
    if (!e.target.closest("#contactDock")) {
      $("contactDock").classList.remove("open");
    }
  });

  // Search input typing
  $("searchInput").addEventListener("input", (e) => {
    searchQuery = e.target.value;
    const clearBtn = $("clearSearchBtn");
    if (searchQuery.trim() !== "") {
      clearBtn.classList.add("show");
    } else {
      clearBtn.classList.remove("show");
    }
    renderMenu();
  });

  // Clear search button
  $("clearSearchBtn").addEventListener("click", () => {
    $("searchInput").value = "";
    searchQuery = "";
    $("clearSearchBtn").classList.remove("show");
    renderMenu();
  });

  // Close modal when clicking overlay
  $("overlay").addEventListener("click", () => {
    closeAllSheets();
  });

  // Escape key closes modals
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeAllSheets();
    }
  });
}

function wireContactLinks() {
  const phoneTel = "tel:" + CONFIG.phone;
  const mapUrl = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(CONFIG.mapQuery);

  // Header details if needed, footer and dock dials
  $("dockCall").href = phoneTel;
  $("footerCall").href = phoneTel;
  $("footerCallTxt").textContent = CONFIG.phone;

  $("dockZalo").href = CONFIG.zaloLink;
  $("footerZalo").href = CONFIG.zaloLink;

  $("dockMap").href = mapUrl;
  $("footerMap").href = mapUrl;
}

/* ==========================================================================
   BOTTOM SHEETS CONTROLLERS (SLIDE-UP SHEETS)
   ========================================================================== */
function openSheet(id) {
  // Hide other sheets
  document.querySelectorAll(".sheet.show").forEach(s => s.classList.remove("show"));

  $("overlay").classList.add("show");
  $(id).classList.add("show");
  document.body.style.overflow = "hidden"; // disable body scroll
  $("cartFab").classList.remove("show"); // hide cart fab while modal is open
}

window.closeAllSheets = function () {
  document.querySelectorAll(".sheet.show").forEach(s => s.classList.remove("show"));
  $("overlay").classList.remove("show");
  document.body.style.overflow = ""; // restore body scroll
  updateCartUI(); // restore cart fab if items exist
};

// Scroll directly to categories menu
window.scrollToMenu = function () {
  const tabs = $("tabsOuter");
  if (tabs) {
    const yOffset = tabs.getBoundingClientRect().top + window.scrollY - 65;
    window.scrollTo({ top: yOffset, behavior: "smooth" });
  }
};

/* ==========================================================================
   PRODUCT CUSTOMIZATION FLOW
   ========================================================================== */
window.openProductCustomizer = function (productId) {
  const product = PRODUCTS.find(p => p.id === productId);
  if (!product) return;

  currentProduct = product;
  currentQty = 1;

  // Xác định bộ tùy chọn kích thước dựa trên danh mục
  const catObj = CATEGORIES.find(c => c.id === product.cat);
  const sizeOptions = catObj ? (catObj.sizes || []) : [];

  // Chọn trước tùy chọn kích thước đầu tiên
  selectedSize = sizeOptions[0];

  // Hiển thị chi tiết sản phẩm bên trong trang tùy chỉnh
  $("psheetImg").src = product.img;
  $("psheetImg").alt = product.name;
  $("psheetName").textContent = product.name;
  $("psheetDesc").textContent = product.desc || "Hương vị thơm ngon, chế biến tươi mới trong ngày.";

  // Bộ chọn tùy chọn kích thước hiển thị
  const sizeGrid = $("sizeGrid");
  sizeGrid.innerHTML = sizeOptions.map((sz, index) => `
    <button class="size-opt ${index === 0 ? 'active' : ''}" onclick="selectCustomizerSize('${sz.label}', ${sz.price}, this)">
      <span class="opt-lbl">${sz.label}</span>
      <span class="opt-price">${formatPrice(sz.price)}</span>
    </button>
  `).join("");

  updateCustomizerPriceAndQuantity();
  openSheet("productSheet");
};

window.selectCustomizerSize = function (label, price, element) {
  selectedSize = { label, price };

  // cập nhật trạng thái hoạt động UI
  document.querySelectorAll(".size-opt").forEach(opt => opt.classList.remove("active"));
  element.classList.add("active");

  updateCustomizerPriceAndQuantity();
};

function updateCustomizerPriceAndQuantity() {
  $("qtyVal").textContent = currentQty;
  const totalPrice = selectedSize.price * currentQty;
  $("customizerAddBtn").innerHTML = `Thêm vào giỏ • ${formatPrice(totalPrice)}`;
}

window.adjustCustomizerQty = function (delta) {
  currentQty += delta;
  if (currentQty < 1) currentQty = 1;
  updateCustomizerPriceAndQuantity();
};

window.addCurrentToCart = function () {
  if (!currentProduct || !selectedSize) return;

  // Kiểm tra xem mặt hàng có cùng ID và kích thước đã có trong giỏ hàng chưa
  const existing = cart.find(item => item.id === currentProduct.id && item.size === selectedSize.label);

  if (existing) {
    existing.qty += currentQty;
  } else {
    cart.push({
      id: currentProduct.id,
      name: currentProduct.name,
      cat: currentProduct.cat,
      img: currentProduct.img,
      size: selectedSize.label,
      price: selectedSize.price,
      qty: currentQty
    });
  }

  saveCart();
  closeAllSheets();
  showToast(`Đã thêm ${currentQty}x ${currentProduct.name} vào giỏ hàng`);
};

/* ==========================================================================
  QUẢN LÝ GIỎ HÀNG
   ========================================================================== */
function getCartTotal() {
  return cart.reduce((total, item) => total + (item.price * item.qty), 0);
}

function getCartCount() {
  return cart.reduce((total, item) => total + item.qty, 0);
}

function updateCartUI() {
  const count = getCartCount();
  const total = getCartTotal();

  // Topbar Cart Badge
  const tbBadge = $("tbBadge");
  if (count > 0) {
    tbBadge.textContent = count;
    tbBadge.classList.add("show");
  } else {
    tbBadge.classList.remove("show");
  }

  // Nút hành động giỏ hàng nổi
  const cartFab = $("cartFab");
  // Chỉ hiển thị nếu giỏ hàng không trống và không có trang nào mở
  if (count > 0 && !document.querySelector(".sheet.show")) {
    $("cfCount").textContent = count;
    $("cfTotal").textContent = formatPrice(total);
    cartFab.classList.add("show");
  } else {
    cartFab.classList.remove("show");
  }
}

window.openCart = function () {
  renderCartItems();
  openSheet("cartSheet");
};

function renderCartItems() {
  const body = $("cartBody");
  const count = getCartCount();
  const total = getCartTotal();

  if (count === 0) {
    body.innerHTML = `
      <div class="cart-empty-box">
        <div class="cart-empty-icon">🛒</div>
        <h3>Giỏ hàng đang trống</h3>
        <p>Rất nhiều bánh kem ngon và thức uống hấp dẫn đang chờ bạn.</p>
        <button class="btn-primary" style="margin-top:20px;" onclick="closeAllSheets(); scrollToMenu();">Xem menu ngay</button>
      </div>
    `;
    $("cartSheetFoot").style.display = "none";
  } else {
    $("cartSheetFoot").style.display = "block";
    $("cartTotalVal").textContent = formatPrice(total);

    body.innerHTML = cart.map(item => `
      <div class="cart-item">
        <img class="ci-img" src="${item.img}" alt="${item.name}">
        <div class="ci-mid">
          <h4 class="ci-name">${item.name}</h4>
          <div class="ci-size">Cỡ: ${item.size}</div>
          <div class="ci-price">${formatPrice(item.price)}</div>
        </div>
        <div class="ci-right">
          <button class="ci-remove" onclick="removeCartItem('${item.id}', '${item.size}')">Xóa</button>
          <div class="mini-qty-ctrl">
            <button onclick="adjustCartItemQty('${item.id}', '${item.size}', -1)">-</button>
            <span class="qv">${item.qty}</span>
            <button onclick="adjustCartItemQty('${item.id}', '${item.size}', 1)">+</button>
          </div>
        </div>
      </div>
    `).join("");
  }
}

window.adjustCartItemQty = function (id, size, delta) {
  const item = cart.find(c => c.id === id && c.size === size);
  if (!item) return;

  item.qty += delta;
  if (item.qty <= 0) {
    cart = cart.filter(c => !(c.id === id && c.size === size));
  }

  saveCart();
  renderCartItems();
  updateCartUI();
};

window.removeCartItem = function (id, size) {
  cart = cart.filter(c => !(c.id === id && c.size === size));
  saveCart();
  renderCartItems();
  updateCartUI();
  showToast("Đã xóa sản phẩm khỏi giỏ hàng");
};

/* ==========================================================================
   CHECKOUT FLOW
   ========================================================================== */
window.openCheckout = function () {
  if (cart.length === 0) return;
  fulfillmentType = "table";
  renderCheckoutForm();
  openSheet("checkoutSheet");
};

function renderCheckoutForm() {
  const container = $("checkoutBody");

  container.innerHTML = `
    <div class="segmented-control">
      <button class="segment-item ${fulfillmentType === 'table' ? 'active' : ''}" onclick="toggleFulfillment('table')">
        <svg viewBox="0 0 24 24"><path d="M3 11h18M5 11V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v4M6 11v8M18 11v8"/></svg>
        <div class="seg-title">Tại quán</div>
        <div class="seg-subtitle">Nhận tại cửa hàng</div>
      </button>
      <button class="segment-item ${fulfillmentType === 'delivery' ? 'active' : ''}" onclick="toggleFulfillment('delivery')">
        <svg viewBox="0 0 24 24"><path d="M1 3h13v13H1zM14 8h5l3 3v5h-8M5.5 19a2 2 0 1 0 0 .01M17.5 19a2 2 0 1 0 0 .01"/></svg>
        <div class="seg-title">Giao tận nơi</div>
        <div class="seg-subtitle">Giao nhanh</div>
      </button>
    </div>
    <div id="checkoutFields"></div>
  `;

  renderFulfillmentFields();
}

window.toggleFulfillment = function (type) {
  fulfillmentType = type;
  renderCheckoutForm();
};

function renderFulfillmentFields() {
  const fieldsContainer = $("checkoutFields");
  let html = "";

  if (fulfillmentType === "table") {
    html = `
      <div class="form-field" id="field_customer_name_t">
        <label>Họ tên <span class="required">*</span></label>
        <input id="coCustomerName" type="text" placeholder="Ví dụ: Nguyễn Văn A">
      </div>
      <div class="form-field" id="field_phone_t">
        <label>Số điện thoại liên hệ <span class="required">*</span></label>
        <input id="coPhoneT" type="tel" inputmode="numeric" placeholder="Ví dụ: 0912345678">
      </div>
      <div class="form-field">
        <label>Ghi chú đơn hàng</label>
        <textarea id="coNoteT" placeholder="Ví dụ: Ghi 'Chúc mừng sinh nhật Long', lấy bánh lúc 18h,..."></textarea>
      </div>
    `;
  } else {
    html = `
      <div class="form-field" id="field_name">
        <label>Họ tên người nhận <span class="required">*</span></label>
        <input id="coName" type="text" placeholder="Ví dụ: Nguyễn Văn A">
      </div>
      <div class="form-field" id="field_phone">
        <label>Số điện thoại <span class="required">*</span></label>
        <input id="coPhone" type="tel" inputmode="numeric" placeholder="Ví dụ: 0912345678">
      </div>
      <div class="form-field" id="field_addr">
        <label>Địa chỉ nhận hàng <span class="required">*</span></label>
        <input id="coAddr" type="text" placeholder="Thôn, xã, số nhà, tên đường...">
      </div>
      <div class="form-field">
        <label>Ghi chú giao hàng</label>
        <textarea id="coNote" placeholder="Ví dụ: giao giờ hành chính, gọi điện trước khi đến..."></textarea>
      </div>
    `;
  }

  fieldsContainer.innerHTML = html;
}



/* ==========================================================================
   ORDER SUBMISSION & REDIRECTION FLOW
   ========================================================================== */
function setErrorState(id, state) {
  const el = $(id);
  if (el) el.classList.toggle("error", state);
}

function isValidPhone(value) {
  return /^0\d{8,10}$/.test(value.replace(/\s+/g, ""));
}

window.submitOrderForm = function () {
  let isValid = true;

  if (fulfillmentType === "table") {
    const name = ($("coCustomerName")?.value || "").trim();
    if (!name) {
      setErrorState("field_customer_name_t", true);
      isValid = false;
    } else {
      setErrorState("field_customer_name_t", false);
    }

    const phone = ($("coPhoneT")?.value || "").trim();
    if (!isValidPhone(phone)) {
      setErrorState("field_phone_t", true);
      isValid = false;
    } else {
      setErrorState("field_phone_t", false);
    }
  } else {
    const name = ($("coName")?.value || "").trim();
    if (!name) {
      setErrorState("field_name", true);
      isValid = false;
    } else {
      setErrorState("field_name", false);
    }

    const phone = ($("coPhone")?.value || "").trim();
    if (!isValidPhone(phone)) {
      setErrorState("field_phone", true);
      isValid = false;
    } else {
      setErrorState("field_phone", false);
    }



    const addr = ($("coAddr")?.value || "").trim();
    if (!addr) {
      setErrorState("field_addr", true);
      isValid = false;
    } else {
      setErrorState("field_addr", false);
    }
  }

  if (!isValid) {
    showToast("Vui lòng điền đủ thông tin bắt buộc");
    return;
  }

  // Proceed with order processing
  const orderText = generateOrderText();

  // Optional Telegram Integration
  if (CONFIG.telegramToken && CONFIG.telegramChatId) {
    fetch(`https://api.telegram.org/bot${CONFIG.telegramToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: CONFIG.telegramChatId, text: orderText })
    }).catch(() => { });
  }

  showOrderSuccess(orderText);
};

function generateOrderText() {
  const itemsText = cart.map(c => `• ${c.name} (${c.size}) x${c.qty} = ${formatPrice(c.price * c.qty)}`);
  let fulfillmentDetails = "";

  if (fulfillmentType === "table") {
    const name = ($("coCustomerName")?.value || "").trim();
    fulfillmentDetails = `🏪 NHẬN TẠI QUÁN` +
      `\n👤 Khách hàng: ${name}` +
      `\n📞 Điện thoại: ${($("coPhoneT")?.value || "").trim()}`;
    const note = ($("coNoteT")?.value || "").trim();
    if (note) fulfillmentDetails += `\n📝 Ghi chú: ${note}`;
  } else {
    fulfillmentDetails = `🚚 ĐƠN GIAO TẬN NƠI\n👤 Người nhận: ${($("coName")?.value || "").trim()}` +
      `\n📞 Điện thoại: ${($("coPhone")?.value || "").trim()}` +
      `\n📍 Địa chỉ: ${($("coAddr")?.value || "").trim()}`;
    const note = ($("coNote")?.value || "").trim();
    if (note) fulfillmentDetails += `\n📝 Ghi chú: ${note}`;
  }

  return `🎂 ĐƠN HÀNG THẢO SÂM BAKERY\n\n${itemsText.join("\n")}\n\n💰 TỔNG CỘNG: ${formatPrice(getCartTotal())}\n\n${fulfillmentDetails}`;
}

function showOrderSuccess(orderText) {
  const summaryList = cart.map(c => `
    <div class="od-item-line">
      <span>${c.name} (Cỡ ${c.size}) ×${c.qty}</span>
      <span>${formatPrice(c.price * c.qty)}</span>
    </div>
  `).join("");

  let destination = "";
  if (fulfillmentType === "table") {
    destination = `
      <div class="od-line"><span class="od-label">Hình thức</span><span class="od-value">Nhận tại quán</span></div>
      <div class="od-line"><span class="od-label">Khách hàng</span><span class="od-value">${($("coCustomerName")?.value || "").trim()}</span></div>
      <div class="od-line"><span class="od-label">Điện thoại</span><span class="od-value">${($("coPhoneT")?.value || "").trim()}</span></div>
    `;
  } else {
    destination = `
      <div class="od-line"><span class="od-label">Hình thức</span><span class="od-value">Giao tận nơi</span></div>
      <div class="od-line"><span class="od-label">Người nhận</span><span class="od-value">${($("coName")?.value || "").trim()}</span></div>
      <div class="od-line"><span class="od-label">Điện thoại</span><span class="od-value">${($("coPhone")?.value || "").trim()}</span></div>
      <div class="od-line"><span class="od-label">Địa chỉ</span><span class="od-value">${($("coAddr")?.value || "").trim()}</span></div>
    `;
  }

  $("successSheetBody").innerHTML = `
    <div class="success-box">
      <div class="success-badge">
        <svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>
      </div>
      <h3>Đặt hàng thành công!</h3>
      <p class="success-note">Cảm ơn bạn đã đặt bánh tại Thảo Sâm Bakery.<br>Dữ liệu đơn hàng sẽ được tự động sao chép.<br>Bấm nút bên dưới và gửi đơn qua Zalo để xác nhận đơn hàng.</p>
      <div class="order-details-card">
        ${destination}
        <hr>
        ${summaryList}
        <div class="od-item-line" style="font-weight:700; margin-top:8px;">
          <span>Tổng cộng</span>
          <span style="color:var(--red-cta)">${formatPrice(getCartTotal())}</span>
        </div>
      </div>
    </div>
  `;

  // Attach dynamic Zalo Clipboard copier + redirect
  $("zaloSendBtn").onclick = function () {
    const handleRedirect = () => {
      showToast("Đã sao chép đơn — dán vào Zalo gửi tiệm nhé!", 2500);
      setTimeout(() => {
        window.open(CONFIG.zaloLink, "_blank");
      }, 2500);
    };

    if (navigator.clipboard) {
      navigator.clipboard.writeText(orderText)
        .then(handleRedirect)
        .catch(() => {
          window.open(CONFIG.zaloLink, "_blank");
        });
    } else {
      try {
        const textarea = document.createElement("textarea");
        textarea.value = orderText;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      } catch (err) {
        console.error("Fallback copy failed", err);
      }
      handleRedirect();
    }
  };

  openSheet("successSheet");
}

window.startNewOrderCycle = function () {
  cart = [];
  fulfillmentType = "table";
  saveCart();
  updateCartUI();
  closeAllSheets();
  window.scrollTo({ top: 0, behavior: "smooth" });
};

/* ==========================================================================
   TOASTS NOTIFIER
   ========================================================================== */
let toastTimer;
function showToast(msg, duration = 2500) {
  const t = $("toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    t.classList.remove("show");
  }, duration);
}

// Cuộn trang tự động bị tắt do hiển thị tab riêng lẻ
