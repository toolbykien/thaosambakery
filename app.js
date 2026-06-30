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
let activeCategory = "all"; // Mặc định hiển thị danh mục "Tất cả"
let storefrontCurrentPage = 1;
const storefrontPageSize = 24;

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

  // Prepend the "All" tab
  const allTabHtml = `
    <button class="tab-item ${activeCategory === 'all' ? 'active' : ''}" data-cat="all" id="tabBtn_all">
      <span>🌟 Tất cả</span>
      <span class="tab-count">${PRODUCTS.length}</span>
    </button>
  `;

  const categoriesHtml = CATEGORIES.map((cat, index) => {
    // Đếm số mặt hàng của danh mục này trong danh sách sản phẩm
    const count = PRODUCTS.filter(p => p.cat === cat.id).length;
    return `
      <button class="tab-item ${cat.id === activeCategory ? 'active' : ''}" data-cat="${cat.id}" id="tabBtn_${cat.id}">
        <span>${cat.name}</span>
        <span class="tab-count">${count}</span>
      </button>
    `;
  }).join("");

  container.innerHTML = allTabHtml + categoriesHtml;

  // Gắn trình xử lý sự kiện nhấp vào các tab
  document.querySelectorAll(".tab-item").forEach(tab => {
    tab.addEventListener("click", () => {
      const catId = tab.dataset.cat;
      activeCategory = catId;
      storefrontCurrentPage = 1;
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
  const pagContainer = $("storefrontPagination");

  if (searchQuery === "") {
    if (activeCategory === "all") {
      // 1. "Tất cả" tab preview mode (no pagination, displays categories sequentially)
      CATEGORIES.forEach(cat => {
        let catProds = PRODUCTS.filter(p => p.cat === cat.id);

        // Sort products inside this category stably by ID
        catProds.sort((a, b) => a.id.localeCompare(b.id));

        if (catProds.length > 0) {
          const previewProds = catProds.slice(0, 4);
          html += renderCategorySection(cat, previewProds, true, catProds.length);
        }
      });

      if (pagContainer) {
        pagContainer.style.display = "none";
        pagContainer.innerHTML = "";
      }
    } else {
      // 2. Single Category tab (paginated, sorted by ID/Code)
      const cat = CATEGORIES.find(c => c.id === activeCategory);
      if (cat) {
        let catProds = PRODUCTS.filter(p => p.cat === cat.id);

        // Sort by ID to ensure stable sort independent of insertion order
        catProds.sort((a, b) => a.id.localeCompare(b.id));

        if (catProds.length === 0) {
          container.innerHTML = `
            <div class="empty-search">
              <div class="empty-search-icon">🎂</div>
              <h3>Danh mục đang trống</h3>
              <p>Các mẫu mới sẽ sớm được cập nhật!</p>
            </div>
          `;
          if (pagContainer) {
            pagContainer.style.display = "none";
            pagContainer.innerHTML = "";
          }
          return;
        }

        // Calculate pages
        const totalPages = Math.ceil(catProds.length / storefrontPageSize) || 1;
        if (storefrontCurrentPage > totalPages) {
          storefrontCurrentPage = totalPages;
        }
        if (storefrontCurrentPage < 1) {
          storefrontCurrentPage = 1;
        }

        const startIndex = (storefrontCurrentPage - 1) * storefrontPageSize;
        const endIndex = startIndex + storefrontPageSize;
        const pageProds = catProds.slice(startIndex, endIndex);

        html = renderCategorySection(cat, pageProds, false, catProds.length);

        renderStorefrontPaginationBar(catProds.length, totalPages, startIndex, endIndex);
      }
    }
  } else {
    // 3. Search Mode (paginated, sorted by category index then ID)
    let filtered = PRODUCTS.filter(p => {
      return p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.code && p.code.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (p.desc && p.desc.toLowerCase().includes(searchQuery.toLowerCase()));
    });

    // Sort by category index, then by ID
    const getCatIndex = (p) => CATEGORIES.findIndex(c => c.id === p.cat);
    filtered.sort((a, b) => {
      const idxA = getCatIndex(a);
      const idxB = getCatIndex(b);
      if (idxA !== idxB) {
        return idxA - idxB;
      }
      return a.id.localeCompare(b.id);
    });

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="empty-search">
          <div class="empty-search-icon">🔍</div>
          <h3>Không tìm thấy mẫu phù hợp</h3>
          <p>Thử tìm kiếm với từ khóa khác xem sao bạn nhé!</p>
        </div>
      `;
      if (pagContainer) {
        pagContainer.style.display = "none";
        pagContainer.innerHTML = "";
      }
      return;
    }

    // Calculate pages
    const totalPages = Math.ceil(filtered.length / storefrontPageSize) || 1;
    if (storefrontCurrentPage > totalPages) {
      storefrontCurrentPage = totalPages;
    }
    if (storefrontCurrentPage < 1) {
      storefrontCurrentPage = 1;
    }

    const startIndex = (storefrontCurrentPage - 1) * storefrontPageSize;
    const endIndex = startIndex + storefrontPageSize;
    const pageProds = filtered.slice(startIndex, endIndex);

    CATEGORIES.forEach(cat => {
      const catProds = pageProds.filter(p => p.cat === cat.id);
      if (catProds.length > 0) {
        html += renderCategorySection(cat, catProds, false, catProds.length);
      }
    });

    renderStorefrontPaginationBar(filtered.length, totalPages, startIndex, endIndex);
  }

  container.innerHTML = html;
}

function renderStorefrontPaginationBar(totalCount, totalPages, startIndex, endIndex) {
  const pagContainer = $("storefrontPagination");
  if (!pagContainer) return;

  if (totalCount <= storefrontPageSize) {
    pagContainer.style.display = "none";
    pagContainer.innerHTML = "";
  } else {
    pagContainer.style.display = "flex";
    pagContainer.innerHTML = `
      <div class="sf-pagination-buttons">
        <button type="button" class="sf-pagination-btn" onclick="changeStorefrontPage(-1)" ${storefrontCurrentPage === 1 ? 'disabled' : ''}>
          Trước
        </button>
        <span class="sf-pagination-page-num">
          Trang ${storefrontCurrentPage} / ${totalPages}
        </span>
        <button type="button" class="sf-pagination-btn" onclick="changeStorefrontPage(1)" ${storefrontCurrentPage === totalPages ? 'disabled' : ''}>
          Sau
        </button>
      </div>
    `;
  }
}

// Helper to render a category section
function renderCategorySection(cat, filtered, isPreview = false, totalCount = filtered.length) {
  const cardHtml = filtered.map(p => {
    return `
      <div class="card" id="card_${p.id}" onclick="openProductCustomizer('${p.id}')">
        <div class="card-img-box">
          <img src="${p.img}" alt="${p.name}" loading="lazy">
        </div>
        <div class="card-body">
          <h4 class="card-name">${p.name} - ${p.code || p.id}</h4>
          <p class="card-desc">${p.desc || ""}</p>
        </div>
      </div>
    `;
  }).join("");

  const viewAllButtonHtml = (isPreview && totalCount > 4) ? `
    <div class="view-all-wrapper">
      <button type="button" class="sf-view-all-btn" onclick="selectStorefrontCategory('${cat.id}')">
        Xem tất cả ${cat.name.split(" ").slice(1).join(" ")} (${totalCount} mẫu) →
      </button>
    </div>
  ` : "";

  return `
    <div class="section" id="sec_${cat.id}">
      <div class="section-head">
        <span class="section-decor-dot"></span>
        <h2 class="section-title">${cat.name}</h2>
        <span class="section-count">${totalCount} mẫu</span>
      </div>
      <div class="products-grid">
        ${cardHtml}
      </div>
      ${viewAllButtonHtml}
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
    storefrontCurrentPage = 1;
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
    storefrontCurrentPage = 1;
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

  // Hiển thị chi tiết sản phẩm bên trong trang tùy chỉnh
  $("psheetImg").src = product.img;
  $("psheetImg").alt = `${product.name} - ${product.code || product.id}`;
  $("psheetName").textContent = `${product.name} - ${product.code || product.id}`;
  $("psheetDesc").textContent = product.desc || "Hương vị thơm ngon, chế biến tươi mới trong ngày.";

  updateCustomizerPriceAndQuantity();
  openSheet("productSheet");
};

function updateCustomizerPriceAndQuantity() {
  const qtyVal = $("qtyVal");
  if (qtyVal) qtyVal.textContent = currentQty;
  $("customizerAddBtn").innerHTML = `Thêm vào giỏ`;
}

window.adjustCustomizerQty = function (delta) {
  currentQty += delta;
  if (currentQty < 1) currentQty = 1;
  updateCustomizerPriceAndQuantity();
};

window.addCurrentToCart = function () {
  if (!currentProduct) return;

  const cartItemId = Date.now() + "_" + Math.random().toString(36).substr(2, 9);
  cart.push({
    cartItemId: cartItemId,
    id: currentProduct.id,
    name: `${currentProduct.name} - ${currentProduct.code || currentProduct.id}`,
    cat: currentProduct.cat,
    img: currentProduct.img,
    qty: 1
  });

  saveCart();
  closeAllSheets();
  showToast(`Đã thêm ${currentProduct.name} - ${currentProduct.code || currentProduct.id} vào giỏ hàng`);
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

  if (count === 0) {
    body.innerHTML = `
      <div class="cart-empty-box">
        <div class="cart-empty-icon">🛒</div>
        <h3>Giỏ hàng đang trống</h3>
        <p>Rất nhiều bánh kem ngon hấp dẫn đang chờ bạn.</p>
        <button class="btn-primary" style="margin-top:20px;" onclick="closeAllSheets(); scrollToMenu();">Xem menu ngay</button>
      </div>
    `;
    $("cartSheetFoot").style.display = "none";
  } else {
    $("cartSheetFoot").style.display = "block";

    body.innerHTML = cart.map(item => `
      <div class="cart-item" style="cursor: pointer;" onclick="openProductCustomizer('${item.id}')">
        <img class="ci-img" src="${item.img}" alt="${item.name}">
        <div class="ci-mid">
          <h4 class="ci-name">${item.name}</h4>
        </div>
        <div class="ci-right">
          <button class="ci-remove" onclick="removeCartItem('${item.cartItemId || item.id}'); event.stopPropagation();">Xóa</button>
        </div>
      </div>
    `).join("");
  }
}

window.removeCartItem = function (cartItemId) {
  cart = cart.filter(c => (c.cartItemId || c.id) !== cartItemId);
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
        <textarea id="coNoteT" placeholder="Ví dụ: Ghi 'Happy Birthday', lấy bánh lúc 19h,..."></textarea>
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
        <label>Ghi chú đơn hàng</label>
        <textarea id="coNote" placeholder="Ví dụ: Ghi 'Chúc mừng sinh nhật', giao hàng lúc 7h tối,..."></textarea>
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
  const itemsText = cart.map(c => `• ${c.name} x${c.qty}`);
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

  return `🎂 ĐƠN HÀNG THẢO SÂM BAKERY\n\n${itemsText.join("\n")}\n\n${fulfillmentDetails}`;
}

function showOrderSuccess(orderText) {
  const summaryList = cart.map(c => `
    <div class="od-item-line">
      <span>${c.name} ×${c.qty}</span>
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

window.changeStorefrontPage = function (delta) {
  storefrontCurrentPage += delta;
  renderMenu();
  scrollToMenu();
};

window.selectStorefrontCategory = function (catId) {
  activeCategory = catId;
  storefrontCurrentPage = 1;
  renderTabs();
  renderMenu();
  scrollToMenu();
};
