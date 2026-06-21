// ==========================================================================
// STATE MANAGEMENT
// ==========================================================================
let gitToken = "";
let gitRepo = "";
let gitBranch = "main";
let originalSha = null;

let CAKE1_SIZES = [];
let CAKE2_SIZES = [];
let CAKE3_SIZES = [];
let CAKE4_SIZES = [];
let PRODUCTS = [];

let editingProductId = null;
let imageContent = ""; // Stores base64 data URI if uploaded locally
let activeFilterTab = "all";

// Element Selector helper
const $ = (id) => document.getElementById(id);

// ==========================================================================
// AUTOLOAD SAVED CREDENTIALS ON MOUNT
// ==========================================================================
document.addEventListener("DOMContentLoaded", () => {
  loadCredentials();
  renderFilterTabs();
  
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
    CAKE1_SIZES = module.CAKE1_SIZES || [];
    CAKE2_SIZES = module.CAKE2_SIZES || [];
    CAKE3_SIZES = module.CAKE3_SIZES || [];
    CAKE4_SIZES = module.CAKE4_SIZES || [];
    PRODUCTS = [...(module.PRODUCTS || [])];

    URL.revokeObjectURL(blobUrl);

    // Update connection state
    $("connectionStatus").className = "sb-info connected";
    $("connectionStatus").querySelector(".status-text").textContent = "Đã kết nối GitHub";
    $("connectAlert").style.display = "none";
    $("editorSection").style.display = "grid";
    $("btnReload").disabled = false;
    $("btnSave").disabled = false;

    // Auto-collapse sidebar configuration on mobile devices after connection
    const sidebar = document.querySelector(".sidebar");
    if (sidebar && window.innerWidth <= 768) {
      sidebar.classList.add("collapsed");
    }

    showToast("Kết nối thành công! Đã tải danh sách sản phẩm.");
    
    // Initial renders
    handleCategoryChange();
    renderProductsList();
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
    const compiledCode = `export const CAKE1_SIZES = ${JSON.stringify(CAKE1_SIZES, null, 2)};

export const CAKE2_SIZES = ${JSON.stringify(CAKE2_SIZES, null, 2)};

export const CAKE3_SIZES = ${JSON.stringify(CAKE3_SIZES, null, 2)};

export const CAKE4_SIZES = ${JSON.stringify(CAKE4_SIZES, null, 2)};

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
        message: "admin: cập nhật danh sách thực đơn sản phẩm",
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

  // Convert file to base64
  const reader = new FileReader();
  reader.onload = function(e) {
    imageContent = e.target.result; // data url base64
    $("prodImgUrl").value = ""; // Clear direct url field
    
    // Show preview
    $("imgPreview").src = imageContent;
    $("imgPreview").style.display = "block";
    $("imgPlaceholder").style.display = "none";
  };
  reader.readAsDataURL(file);
}

function handleImageUrlInput() {
  const url = $("prodImgUrl").value.trim();
  if (url) {
    imageContent = url; // Use URL directly
    $("imageFile").value = ""; // Clear file selector

    // Show preview
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
// FORM CRUD HANDLERS
// ==========================================================================
function handleCategoryChange() {
  const cat = $("prodCat").value;
  const list = $("sizesPreviewList");
  let sizes = [];

  if (cat === "cake1") sizes = CAKE1_SIZES;
  else if (cat === "cake2") sizes = CAKE2_SIZES;
  else if (cat === "cake3") sizes = CAKE3_SIZES;
  else if (cat === "cake4") sizes = CAKE4_SIZES;

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
    // Edit existing product
    const prod = PRODUCTS.find(p => p.id === editingProductId);
    if (prod) {
      prod.name = name;
      prod.cat = cat;
      prod.desc = desc;
      prod.img = imageContent;
      showToast(`Đã cập nhật: ${name}`);
    }
  } else {
    // Create new product
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
  
  // Extract numbers from IDs (e.g. "C014" -> 14)
  const ids = PRODUCTS.map(p => {
    const num = parseInt(p.id.replace(/[A-Za-z]/g, ""));
    return isNaN(num) ? 0 : num;
  });

  const maxId = Math.max(...ids);
  const nextId = maxId + 1;
  
  // Pad with leading zeros (e.g. C015)
  return "C" + nextId.toString().padStart(3, "0");
}

function resetForm() {
  editingProductId = null;
  imageContent = "";
  
  $("prodId").value = "";
  $("prodName").value = "";
  $("prodDesc").value = "";
  $("prodImgUrl").value = "";
  $("imageFile").value = "";
  $("prodCat").selectedIndex = 0;
  
  $("formTitle").textContent = "Thêm sản phẩm mới";
  $("btnSubmitForm").textContent = "Thêm sản phẩm";
  $("btnCancelEdit").style.display = "none";
  
  resetImagePreview();
  handleCategoryChange();
}

// Start Edit mode
function editProduct(id) {
  const prod = PRODUCTS.find(p => p.id === id);
  if (!prod) return;

  editingProductId = id;
  
  $("prodId").value = prod.id;
  $("prodName").value = prod.name;
  $("prodDesc").value = prod.desc || "";
  $("prodCat").value = prod.cat;
  
  // Populate image
  imageContent = prod.img;
  if (prod.img.startsWith("data:")) {
    // base64
    $("prodImgUrl").value = "";
    $("imgPreview").src = prod.img;
  } else {
    // direct URL
    $("prodImgUrl").value = prod.img;
    $("imgPreview").src = prod.img;
  }
  $("imgPreview").style.display = "block";
  $("imgPlaceholder").style.display = "none";

  $("formTitle").textContent = `Chỉnh sửa: ${prod.name}`;
  $("btnSubmitForm").textContent = "Cập nhật sản phẩm";
  $("btnCancelEdit").style.display = "inline-flex";

  handleCategoryChange();
  
  // Scroll form into view if layout wraps on small screens
  $("productForm").scrollIntoView({ behavior: "smooth" });
}

// Delete product locally
function deleteProduct(id) {
  const prod = PRODUCTS.find(p => p.id === id);
  if (!prod) return;

  if (confirm(`Bạn chắc chắn muốn xóa món: ${prod.name}? (Nhấn Lưu sau đó để đẩy lên GitHub)`)) {
    PRODUCTS = PRODUCTS.filter(p => p.id !== id);
    showToast(`Đã xóa món: ${prod.name}`);
    
    // If deleted the item currently being edited
    if (editingProductId === id) {
      resetForm();
    }
    
    renderProductsList();
  }
}

// ==========================================================================
// RENDERERS
// ==========================================================================
function renderFilterTabs() {
  const container = $("tabFilters");
  if (!container) return;

  const categories = [
    { id: "all", name: "Tất cả" },
    { id: "cake1", name: "Gato Kỷ Niệm" },
    { id: "cake2", name: "Gato Tiệc Cưới" },
    { id: "cake3", name: "Gato Sự Kiện" },
    { id: "cake4", name: "Gato Thường Ngày" }
  ];

  container.innerHTML = categories.map(cat => `
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

  // Filter products by tab
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
    // Get clean category name
    const catObj = $("prodCat").querySelector(`option[value="${p.cat}"]`);
    const catLabel = catObj ? catObj.textContent.split(" ")[1] || "Món" : "Món";

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

