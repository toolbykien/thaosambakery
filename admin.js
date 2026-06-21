// ==========================================================================
// STATE MANAGEMENT
// ==========================================================================
let gitToken = "";
let gitRepo = "";
let gitBranch = "main";
let originalSha = null;

let CATEGORIES = [];
let PRODUCTS = [];

let editingProductId = null;
let editingCategoryId = null;
let tempSizes = []; // Temporary sizes for the category editor form
let imageContent = ""; // Stores base64 data URI if uploaded locally
let activeFilterTab = "all";
let activeAdminTab = "products";

// Element Selector helper
const $ = (id) => document.getElementById(id);

// ==========================================================================
// AUTOLOAD SAVED CREDENTIALS ON MOUNT
// ==========================================================================
document.addEventListener("DOMContentLoaded", () => {
  loadCredentials();

  if (gitToken && gitRepo) {
    connectGitHub(true); // Attempt silent connection on startup
  }
});

// Load GitHub credentials from LocalStorage
function loadCredentials() {
  gitToken = localStorage.getItem("__thaosam_git_token") || "";
  gitRepo = localStorage.getItem("__thaosam_git_repo") || "";
  gitBranch = localStorage.getItem("__thaosam_git_branch") || "main";

  $("gitToken").value = gitToken;
  $("gitRepo").value = gitRepo;
  $("gitBranch").value = gitBranch;
}

// Save GitHub credentials to LocalStorage
function saveCredentials() {
  gitToken = $("gitToken").value.trim();
  gitRepo = $("gitRepo").value.trim();
  gitBranch = $("gitBranch").value.trim() || "main";

  localStorage.setItem("__thaosam_git_token", gitToken);
  localStorage.setItem("__thaosam_git_repo", gitRepo);
  localStorage.setItem("__thaosam_git_branch", gitBranch);
}

// ==========================================================================
// GITHUB API CLIENT
// ==========================================================================
async function connectGitHub(silent = false) {
  saveCredentials();

  if (!gitToken || !gitRepo) {
    if (!silent) showToast("Vui lòng điền đầy đủ Token và Repository!");
    return;
  }

  if (!silent) showToast("Đang tải dữ liệu từ GitHub...");

  try {
    const response = await fetch(`https://api.github.com/repos/${gitRepo}/contents/products.js?ref=${gitBranch}`, {
      headers: {
        "Authorization": `token ${gitToken}`,
        "Accept": "application/vnd.github.v3+json"
      }
    });

    if (!response.ok) {
      throw new Error(`GitHub trả về mã lỗi: ${response.status}`);
    }

    const data = await response.json();
    originalSha = data.sha;

    // Decode base64 contents safely supporting UTF-8
    const fileContent = decodeBase64Utf8(data.content);

    // Dynamically load the JS module in client's browser
    const blob = new Blob([fileContent], { type: 'application/javascript' });
    const blobUrl = URL.createObjectURL(blob);

    const module = await import(blobUrl);

    // Populate variables
    CATEGORIES = [...(module.CATEGORIES || [])];
    PRODUCTS = [...(module.PRODUCTS || [])];

    URL.revokeObjectURL(blobUrl);

    // Update connection state
    $("connectionStatus").className = "sb-info connected";
    $("connectionStatus").querySelector(".status-text").textContent = "Đã kết nối GitHub";
    $("connectAlert").style.display = "none";
    $("editorSection").style.display = "block";
    $("btnReload").disabled = false;
    $("btnSave").disabled = false;

    // Auto-collapse sidebar configuration on mobile devices after connection
    const sidebar = document.querySelector(".sidebar");
    if (sidebar && window.innerWidth <= 768) {
      sidebar.classList.add("collapsed");
    }

    showToast("Kết nối thành công! Đã tải danh sách sản phẩm.");

    // Initial renders
    renderCategorySelectOptions();
    renderFilterTabs();
    handleCategoryChange();
    renderProductsList();
    renderCategoriesList();
  } catch (error) {
    console.error(error);
    $("connectionStatus").className = "sb-info";
    $("connectionStatus").querySelector(".status-text").textContent = "Lỗi kết nối";
    if (!silent) showToast("Lỗi: Không thể kết nối hoặc tải file từ GitHub!");
  }
}

// Reload products list from server
function reloadProducts() {
  connectGitHub(false);
}

// Save Changes back to GitHub repository
async function saveChanges() {
  if (!gitToken || !gitRepo || !originalSha) {
    showToast("Chưa kết nối hoặc thiếu thông tin GitHub!");
    return;
  }

  showToast("Đang đồng bộ dữ liệu lên GitHub...");

  try {
    // 1. Fetch latest SHA to avoid merge conflict
    const fetchLatest = await fetch(`https://api.github.com/repos/${gitRepo}/contents/products.js?ref=${gitBranch}`, {
      headers: {
        "Authorization": `token ${gitToken}`,
        "Accept": "application/vnd.github.v3+json"
      }
    });

    if (fetchLatest.ok) {
      const latestData = await fetchLatest.json();
      originalSha = latestData.sha;
    }

    // 2. Compile updated products.js file content
    const compiledCode = `export const CATEGORIES = ${JSON.stringify(CATEGORIES, null, 2)};

export const PRODUCTS = ${JSON.stringify(PRODUCTS, null, 2)};
`;

    const base64Content = encodeBase64Utf8(compiledCode);

    // 3. Make PUT request to update file on GitHub
    const updateResponse = await fetch(`https://api.github.com/repos/${gitRepo}/contents/products.js`, {
      method: "PUT",
      headers: {
        "Authorization": `token ${gitToken}`,
        "Accept": "application/vnd.github.v3+json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: "admin: cập nhật danh sách thực đơn sản phẩm & danh mục",
        content: base64Content,
        sha: originalSha,
        branch: gitBranch
      })
    });

    if (!updateResponse.ok) {
      throw new Error(`Không thể đẩy thay đổi lên GitHub: ${updateResponse.status}`);
    }

    const resData = await updateResponse.json();
    originalSha = resData.content.sha; // Update SHA for subsequent saves

    showToast("Chúc mừng! Đã lưu thành công và cập nhật lên GitHub.");
  } catch (error) {
    console.error(error);
    showToast("Lỗi đồng bộ: " + error.message);
  }
}

// Safe UTF-8 base64 helpers
function decodeBase64Utf8(str) {
  str = str.replace(/\s/g, '');
  const binaryString = atob(str);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return new TextDecoder("utf-8").decode(bytes);
}

// Safe base64 encoding supporting Vietnamese characters
function encodeBase64Utf8(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// ==========================================================================
// FILE/IMAGE HANDLING
// ==========================================================================
function handleImageFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    imageContent = e.target.result;
    $("prodImgUrl").value = "";

    $("imgPreview").src = imageContent;
    $("imgPreview").style.display = "block";
    $("imgPlaceholder").style.display = "none";
  };
  reader.readAsDataURL(file);
}

function handleImageUrlInput() {
  const url = $("prodImgUrl").value.trim();
  if (url) {
    imageContent = url;
    $("imageFile").value = "";

    $("imgPreview").src = url;
    $("imgPreview").style.display = "block";
    $("imgPlaceholder").style.display = "none";
  } else {
    resetImagePreview();
  }
}

function resetImagePreview() {
  imageContent = "";
  $("imgPreview").src = "";
  $("imgPreview").style.display = "none";
  $("imgPlaceholder").style.display = "block";
}

// ==========================================================================
// ADMIN TABS SWITCHER
// ==========================================================================
function switchAdminTab(tabName) {
  activeAdminTab = tabName;

  const tabBtnProducts = $("tabBtnProducts");
  const tabBtnCategories = $("tabBtnCategories");
  const productsContent = $("productsTabContent");
  const categoriesContent = $("categoriesTabContent");

  if (tabName === "products") {
    tabBtnProducts.classList.add("active");
    tabBtnCategories.classList.remove("active");
    productsContent.style.display = "grid";
    categoriesContent.style.display = "none";
    renderProductsList();
  } else {
    tabBtnProducts.classList.remove("active");
    tabBtnCategories.classList.add("active");
    productsContent.style.display = "none";
    categoriesContent.style.display = "grid";
    renderCategoriesList();
  }
}

// Render dynamic dropdown options in Product Form
function renderCategorySelectOptions() {
  const select = $("prodCat");
  if (!select) return;
  select.innerHTML = CATEGORIES.map(cat => `
    <option value="${cat.id}">${cat.name}</option>
  `).join("");
}

// ==========================================================================
// FORM PRODUCTS CRUD HANDLERS
// ==========================================================================
function handleCategoryChange() {
  const catId = $("prodCat").value;
  const list = $("sizesPreviewList");
  if (!list) return;

  const catObj = CATEGORIES.find(c => c.id === catId);
  const sizes = catObj ? (catObj.sizes || []) : [];

  if (sizes.length === 0) {
    list.innerHTML = `<div style="font-size:12px;color:var(--text-muted);">Không có kích cỡ nào được cấu hình cho danh mục này.</div>`;
    return;
  }

  list.innerHTML = sizes.map(sz => `
    <div class="size-preview-item">
      <span>Cỡ: <strong>${sz.label}</strong></span>
      <span>Giá: <strong>${formatPrice(sz.price)}</strong></span>
    </div>
  `).join("");
}

function handleFormSubmit(event) {
  event.preventDefault();

  const name = $("prodName").value.trim();
  const cat = $("prodCat").value;
  const desc = $("prodDesc").value.trim();

  if (!name) {
    showToast("Vui lòng nhập tên sản phẩm!");
    return;
  }

  if (!imageContent) {
    showToast("Vui lòng tải lên hoặc chọn URL hình ảnh!");
    return;
  }

  if (editingProductId) {
    const prod = PRODUCTS.find(p => p.id === editingProductId);
    if (prod) {
      prod.name = name;
      prod.cat = cat;
      prod.desc = desc;
      prod.img = imageContent;
      showToast(`Đã cập nhật: ${name}`);
    }
  } else {
    const newId = generateProductId();
    PRODUCTS.push({
      id: newId,
      cat: cat,
      name: name,
      desc: desc,
      img: imageContent
    });
    showToast(`Đã thêm món mới: ${name}`);
  }

  resetForm();
  renderProductsList();
}

function generateProductId() {
  if (PRODUCTS.length === 0) return "C001";
  const ids = PRODUCTS.map(p => {
    const num = parseInt(p.id.replace(/[A-Za-z]/g, ""));
    return isNaN(num) ? 0 : num;
  });
  const maxId = Math.max(...ids);
  return "C" + (maxId + 1).toString().padStart(3, "0");
}

function resetForm() {
  editingProductId = null;
  imageContent = "";

  $("prodId").value = "";
  $("prodName").value = "";
  $("prodDesc").value = "";
  $("prodImgUrl").value = "";
  $("imageFile").value = "";
  if ($("prodCat").options.length > 0) {
    $("prodCat").selectedIndex = 0;
  }

  $("formTitle").textContent = "Thêm sản phẩm mới";
  $("btnSubmitForm").textContent = "Thêm sản phẩm";
  $("btnCancelEdit").style.display = "none";

  resetImagePreview();
  handleCategoryChange();
}

function editProduct(id) {
  const prod = PRODUCTS.find(p => p.id === id);
  if (!prod) return;

  editingProductId = id;

  $("prodId").value = prod.id;
  $("prodName").value = prod.name;
  $("prodDesc").value = prod.desc || "";
  $("prodCat").value = prod.cat;

  imageContent = prod.img;
  if (prod.img.startsWith("data:")) {
    $("prodImgUrl").value = "";
    $("imgPreview").src = prod.img;
  } else {
    $("prodImgUrl").value = prod.img;
    $("imgPreview").src = prod.img;
  }
  $("imgPreview").style.display = "block";
  $("imgPlaceholder").style.display = "none";

  $("formTitle").textContent = `Chỉnh sửa: ${prod.name}`;
  $("btnSubmitForm").textContent = "Cập nhật sản phẩm";
  $("btnCancelEdit").style.display = "inline-flex";

  handleCategoryChange();
  $("productForm").scrollIntoView({ behavior: "smooth" });
}

function deleteProduct(id) {
  const prod = PRODUCTS.find(p => p.id === id);
  if (!prod) return;

  if (confirm(`Bạn chắc chắn muốn xóa món: ${prod.name}? (Nhấn Lưu sau đó để đẩy lên GitHub)`)) {
    PRODUCTS = PRODUCTS.filter(p => p.id !== id);
    showToast(`Đã xóa món: ${prod.name}`);
    if (editingProductId === id) {
      resetForm();
    }
    renderProductsList();
  }
}

// ==========================================================================
// CATEGORIES & SIZES CRUD HANDLERS
// ==========================================================================
function renderTempSizes() {
  const container = $("tempSizesList");
  if (!container) return;

  if (tempSizes.length === 0) {
    container.innerHTML = `<div style="font-size:12px;color:var(--text-muted);padding:8px 0;">Chưa thêm kích cỡ nào.</div>`;
    return;
  }

  container.innerHTML = tempSizes.map((sz, index) => `
    <div class="temp-size-badge">
      <span>${sz.label} (${formatPrice(sz.price)})</span>
      <button type="button" class="btn-remove-size" onclick="removeSizeFromTempList(${index})">&times;</button>
    </div>
  `).join("");
}

function addSizeToTempList() {
  const labelInput = $("newSizeLabel");
  const priceInput = $("newSizePrice");

  const label = labelInput.value.trim();
  const priceVal = priceInput.value.trim();

  if (!label || !priceVal) {
    showToast("Vui lòng điền nhãn và giá cho kích cỡ!");
    return;
  }

  const price = parseInt(priceVal);
  if (isNaN(price) || price < 0) {
    showToast("Giá không hợp lệ!");
    return;
  }

  if (tempSizes.some(s => s.label.toLowerCase() === label.toLowerCase())) {
    showToast("Cỡ này đã được thêm!");
    return;
  }

  tempSizes.push({ label, price });
  labelInput.value = "";
  priceInput.value = "";
  renderTempSizes();
}

function removeSizeFromTempList(index) {
  tempSizes.splice(index, 1);
  renderTempSizes();
}

function renderCategoriesList() {
  const tbody = $("categoriesTableBody");
  if (!tbody) return;

  if (CATEGORIES.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" style="text-align: center; color: var(--text-muted); padding: 30px 0;">
          Chưa có danh mục nào.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = CATEGORIES.map(cat => {
    const sizesStr = cat.sizes && cat.sizes.length > 0
      ? cat.sizes.map(sz => `${sz.label}: <strong>${formatPrice(sz.price)}</strong>`).join(", ")
      : "<em style='color:var(--text-muted)'>Chưa có cỡ</em>";

    return `
      <tr>
        <td>
          <small style="color: var(--text-muted); font-family: 'Outfit'; font-weight: 600;">${cat.id}</small>
        </td>
        <td>
          <span class="t-name">${cat.name}</span>
        </td>
        <td>
          <span style="font-size: 13px;">${sizesStr}</span>
        </td>
        <td>
          <div class="table-actions">
            <button class="btn-icon btn-edit-icon" onclick="editCategory('${cat.id}')" title="Chỉnh sửa">
              ✏️
            </button>
            <button class="btn-icon btn-delete-icon" onclick="deleteCategory('${cat.id}')" title="Xóa">
              🗑️
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

function handleCategoryFormSubmit(event) {
  event.preventDefault();

  const name = $("catName").value.trim();
  if (!name) {
    showToast("Vui lòng nhập tên danh mục!");
    return;
  }

  if (tempSizes.length === 0) {
    showToast("Danh mục phải có ít nhất 1 kích cỡ!");
    return;
  }

  if (editingCategoryId) {
    const cat = CATEGORIES.find(c => c.id === editingCategoryId);
    if (cat) {
      cat.name = name;
      cat.sizes = [...tempSizes];
      showToast(`Đã cập nhật danh mục: ${name}`);
    }
  } else {
    const newId = generateCategoryId();
    CATEGORIES.push({
      id: newId,
      name: name,
      sizes: [...tempSizes]
    });
    showToast(`Đã thêm danh mục mới: ${name}`);
  }

  resetCategoryForm();
  renderCategorySelectOptions();
  renderFilterTabs();
  renderCategoriesList();
}

function generateCategoryId() {
  if (CATEGORIES.length === 0) return "cake1";
  const ids = CATEGORIES.map(c => {
    const num = parseInt(c.id.replace("cake", ""));
    return isNaN(num) ? 0 : num;
  });
  const maxId = Math.max(...ids);
  return "cake" + (maxId + 1);
}

function resetCategoryForm() {
  editingCategoryId = null;
  tempSizes = [];

  $("catId").value = "";
  $("catName").value = "";
  $("newSizeLabel").value = "";
  $("newSizePrice").value = "";

  $("catFormTitle").textContent = "Thêm danh mục mới";
  $("btnSubmitCatForm").textContent = "Thêm danh mục";
  $("btnCancelCatEdit").style.display = "none";

  renderTempSizes();
}

function editCategory(id) {
  const cat = CATEGORIES.find(c => c.id === id);
  if (!cat) return;

  editingCategoryId = id;
  tempSizes = [...(cat.sizes || [])];

  $("catId").value = cat.id;
  $("catName").value = cat.name;

  $("catFormTitle").textContent = `Chỉnh sửa: ${cat.name}`;
  $("btnSubmitCatForm").textContent = "Cập nhật danh mục";
  $("btnCancelCatEdit").style.display = "inline-flex";

  renderTempSizes();
  $("categoryForm").scrollIntoView({ behavior: "smooth" });
}

function deleteCategory(id) {
  const cat = CATEGORIES.find(c => c.id === id);
  if (!cat) return;

  const countProducts = PRODUCTS.filter(p => p.cat === id).length;
  const message = countProducts > 0
    ? `Cảnh báo: Danh mục "${cat.name}" đang có ${countProducts} sản phẩm. Xóa danh mục này sẽ xóa tất cả sản phẩm thuộc về nó. Bạn chắc chắn chứ?`
    : `Bạn chắc chắn muốn xóa danh mục: ${cat.name}?`;

  if (confirm(message)) {
    CATEGORIES = CATEGORIES.filter(c => c.id !== id);
    PRODUCTS = PRODUCTS.filter(p => p.cat !== id);

    showToast(`Đã xóa danh mục: ${cat.name}`);

    if (editingCategoryId === id) {
      resetCategoryForm();
    }
    if (activeFilterTab === id) {
      activeFilterTab = "all";
    }

    renderCategorySelectOptions();
    renderFilterTabs();
    renderProductsList();
    renderCategoriesList();
  }
}

// ==========================================================================
// RENDERERS FOR PRODUCTS
// ==========================================================================
function renderFilterTabs() {
  const container = $("tabFilters");
  if (!container) return;

  const tabs = [
    { id: "all", name: "Tất cả" },
    ...CATEGORIES.map(cat => ({ id: cat.id, name: cat.name }))
  ];

  container.innerHTML = tabs.map(cat => `
    <button class="tab-filter-btn ${cat.id === activeFilterTab ? 'active' : ''}" 
            onclick="setFilterTab('${cat.id}')">
      ${cat.name}
    </button>
  `).join("");
}

function setFilterTab(tabId) {
  activeFilterTab = tabId;
  renderFilterTabs();
  renderProductsList();
}

function renderProductsList() {
  const tbody = $("productsTableBody");
  if (!tbody) return;

  const filteredProds = PRODUCTS.filter(p => {
    return activeFilterTab === "all" || p.cat === activeFilterTab;
  });

  if (filteredProds.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 30px 0;">
          Chưa có sản phẩm nào thuộc danh mục này.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filteredProds.map(p => {
    const catObj = CATEGORIES.find(c => c.id === p.cat);
    const catLabel = catObj ? catObj.name.split(" ").slice(1).join(" ") || "Món" : "Món";

    return `
      <tr>
        <td>
          <div class="t-img-box">
            <img src="${p.img}" alt="${p.name}">
          </div>
        </td>
        <td>
          <span class="t-name">${p.name}</span><br>
          <small style="color: var(--text-muted); font-family: 'Outfit';">${p.id}</small>
        </td>
        <td>
          <span class="t-badge">${catLabel}</span>
        </td>
        <td>
          <div class="t-desc" title="${p.desc || ""}">${p.desc || "Không có mô tả"}</div>
        </td>
        <td>
          <div class="table-actions">
            <button class="btn-icon btn-edit-icon" onclick="editProduct('${p.id}')" title="Chỉnh sửa">
              ✏️
            </button>
            <button class="btn-icon btn-delete-icon" onclick="deleteProduct('${p.id}')" title="Xóa">
              🗑️
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

// Utility to format currency values
function formatPrice(num) {
  return num.toLocaleString("vi-VN") + "đ";
}

// ==========================================================================
// TOAST NOTIFIER
// ==========================================================================
let toastTimer;
function showToast(msg) {
  const t = $("toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    t.classList.remove("show");
  }, 3500);
}

// Toggle sidebar config panel visibility on mobile
function toggleSidebarConfig() {
  const sidebar = document.querySelector(".sidebar");
  if (sidebar) {
    sidebar.classList.toggle("collapsed");
  }
}

// ==========================================================================
// EXPOSE FUNCTIONS TO GLOBAL WINDOW SCOPE (REQUIRED FOR MODULE SCRIPTS)
// ==========================================================================
window.connectGitHub = connectGitHub;
window.reloadProducts = reloadProducts;
window.saveChanges = saveChanges;
window.handleImageFile = handleImageFile;
window.handleImageUrlInput = handleImageUrlInput;
window.handleCategoryChange = handleCategoryChange;
window.handleFormSubmit = handleFormSubmit;
window.resetForm = resetForm;
window.editProduct = editProduct;
window.deleteProduct = deleteProduct;
window.setFilterTab = setFilterTab;
window.toggleSidebarConfig = toggleSidebarConfig;

window.switchAdminTab = switchAdminTab;
window.addSizeToTempList = addSizeToTempList;
window.removeSizeFromTempList = removeSizeFromTempList;
window.handleCategoryFormSubmit = handleCategoryFormSubmit;
window.resetCategoryForm = resetCategoryForm;
window.editCategory = editCategory;
window.deleteCategory = deleteCategory;
