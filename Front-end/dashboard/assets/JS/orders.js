// Firebase Initialization
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  increment,
  connectFirestoreEmulator,
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "<YOUR_REAL_API_KEY>",
  authDomain: "madas-store.firebaseapp.com",
  projectId: "madas-store",
  storageBucket: "madas-store.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef123456",
};
console.log("Firebase Config:", firebaseConfig);

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
// If using emulator:
// connectFirestoreEmulator(db, 'localhost', 8080);

// State
let sampleOrders = [];
let currentPage = 1;
let rowsPerPage = 10;
let sortField = null;
let sortDir = 1; // 1 = asc, -1 = desc
let currentMode = ""; // "scan" or "return"

document.addEventListener("DOMContentLoaded", () => {
  console.log("Orders.js loaded, binding listeners...");

  // DOM references
  const tableBody = document.getElementById("ordersTableBody");
  const pagination = document.getElementById("pagination");
  const searchInput = document.getElementById("searchInput");
  const statusFilter = document.getElementById("statusFilter");
  const selectAllCB = document.getElementById("selectAll");
  const downloadBtn = document.getElementById("downloadBtn");
  const scanBtn = document.getElementById("scanBtn");
  const returnBtn = document.getElementById("returnBtn");
  const modal = document.getElementById("returnModal");
  const modalTitle = document.getElementById("modalTitle");
  const barcodeInput = document.getElementById("barcodeInput");
  const cancelBtn = document.getElementById("cancelBtn");
  const actionBtn = document.getElementById("actionBtn");
  const scannerCtr = document.getElementById("scanner-container");
  const scanResult = document.getElementById("scanResult");
  const scannedInfo = document.getElementById("scannedProduct");
  const confirmBtn = document.getElementById("confirmBtn");

  // Render rows helper
  function renderRows(rows) {
    tableBody.innerHTML = "";
    if (!rows.length) {
      tableBody.innerHTML = `<tr><td colspan="9" class="text-center p-4">No orders found</td></tr>`;
      return;
    }
    rows.forEach((o) => {
      const tr = document.createElement("tr");
      tr.className = "hover:bg-gray-50";
      tr.innerHTML = `
        <td class="px-4 py-2"><input type="checkbox" class="order-checkbox" data-id="${
          o.id
        }" /></td>
        <td class="px-4 py-2">${o.id}</td>
        <td class="px-4 py-2">${o.name}</td>
        <td class="px-4 py-2">${o.phone}</td>
        <td class="px-4 py-2">${o.email}</td>
        <td class="px-4 py-2">${o.products}</td>
        <td class="px-4 py-2">${o.total}</td>
        <td class="px-4 py-2">${o.date}</td>
        <td class="px-4 py-2"><span class="status ${o.status.toLowerCase()}">${
        o.status
      }</span></td>
      `;
      tableBody.appendChild(tr);
    });
  }

  // Main render: filter, sort, paginate
  function renderPage() {
    let data = sampleOrders.filter((o) => {
      const term = searchInput.value.toLowerCase();
      const st = statusFilter.value.toLowerCase();
      return (
        (o.id.toLowerCase().includes(term) ||
          o.name.toLowerCase().includes(term) ||
          o.phone.includes(term) ||
          o.email.toLowerCase().includes(term)) &&
        (!st || o.status.toLowerCase() === st)
      );
    });
    if (sortField) {
      data.sort((a, b) => {
        let aV = sortField === "date" ? new Date(a.date) : a[sortField];
        let bV = sortField === "date" ? new Date(b.date) : b[sortField];
        if (aV < bV) return -sortDir;
        if (aV > bV) return sortDir;
        return 0;
      });
    }
    const totalPages = Math.max(1, Math.ceil(data.length / rowsPerPage));
    if (currentPage > totalPages) currentPage = totalPages;
    const start = (currentPage - 1) * rowsPerPage;
    renderRows(data.slice(start, start + rowsPerPage));
    renderPagination(totalPages);
  }

  // Pagination UI
  function renderPagination(total) {
    pagination.innerHTML = "";
    const prev = document.createElement("button");
    prev.textContent = "Prev";
    prev.disabled = currentPage === 1;
    prev.onclick = () => {
      currentPage--;
      renderPage();
    };
    pagination.appendChild(prev);
    for (let i = 1; i <= total; i++) {
      const btn = document.createElement("button");
      btn.textContent = i;
      btn.className = i === currentPage ? "active" : "";
      btn.onclick = () => {
        currentPage = i;
        renderPage();
      };
      pagination.appendChild(btn);
    }
    const next = document.createElement("button");
    next.textContent = "Next";
    next.disabled = currentPage === total;
    next.onclick = () => {
      currentPage++;
      renderPage();
    };
    pagination.appendChild(next);
  }

  // Show modal & start scanner
  function showModal(mode) {
    // Reset and hide previous scan result & confirm button
    scanResult.classList.add("hidden");
    confirmBtn.classList.add("hidden");
    console.log("showModal:", mode);
    currentMode = mode;
    modalTitle.textContent =
      mode === "return" ? "Return Product" : "Scan & Order";
    actionBtn.textContent = mode === "return" ? "Return" : "Order";
    actionBtn.className =
      mode === "return"
        ? "btn-return px-4 py-2 rounded"
        : "btn-scan px-4 py-2 rounded";
    barcodeInput.value = "";
    modal.classList.remove("hidden");
    scannerCtr.classList.remove("hidden");
    Quagga.init(
      {
        inputStream: {
          type: "LiveStream",
          target: document.querySelector("#interactive"),
          constraints: { facingMode: "environment" },
        },
        decoder: {
          readers: [
            "code_128_reader",
            "ean_reader",
            "ean_8_reader",
            "upc_reader",
          ],
        },
      },
      (err) => {
        if (err) console.error(err);
        else Quagga.start();
      }
    );
    Quagga.onDetected((d) => {
      Quagga.stop();
      const code = d.codeResult.code;
      barcodeInput.value = code;
      // Show scan result and confirm button
      scannedInfo.textContent = `${
        currentMode === "return" ? "Return" : "Order"
      } code: ${code}`;
      scanResult.classList.remove("hidden");
      confirmBtn.classList.remove("hidden");
    });
  }

  // Hide modal & stop scanner
  function hideModal() {
    modal.classList.add("hidden");
    scannerCtr.classList.add("hidden");
    Quagga.stop();
    barcodeInput.value = "";
    scanResult.classList.add("hidden");
    confirmBtn.classList.add("hidden");
  }

  // Handle scan/order or return
  async function handleAction() {
    const code = barcodeInput.value.trim();
    if (!code) {
      alert("Please enter or scan a barcode.");
      return;
    }
    const delta = currentMode === "return" ? 1 : -1;
    const productsQ = query(
      collection(db, "products"),
      where("barcode", "==", code)
    );
    const snap = await getDocs(productsQ);
    if (snap.empty) {
      alert("Product not found with that barcode.");
    } else {
      const docSnap = snap.docs[0];
      await updateDoc(docSnap.ref, { stock: increment(delta) });
      alert(
        `Stock ${delta < 0 ? "decreased" : "increased"} for ${
          docSnap.data().name
        }`
      );
      renderPage();
    }
    hideModal();
  }

  // Event bindings
  searchInput.oninput = () => {
    currentPage = 1;
    renderPage();
  };
  statusFilter.onchange = () => {
    currentPage = 1;
    renderPage();
  };
  selectAllCB.onchange = (e) =>
    document
      .querySelectorAll(".order-checkbox")
      .forEach((cb) => (cb.checked = e.target.checked));
  downloadBtn.addEventListener("click", () => {
    const sel = Array.from(document.querySelectorAll(".order-checkbox:checked"))
      .map((cb) => cb.dataset.id)
      .map((id) => sampleOrders.find((o) => o.id === id));
    if (!sel.length) return alert("No orders selected.");
    const ws = XLSX.utils.json_to_sheet(sel);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Orders");
    XLSX.writeFile(wb, "orders_export.xlsx");
  });
  scanBtn.addEventListener("click", () => {
    console.log("Scan clicked");
    showModal("scan");
  });
  returnBtn.addEventListener("click", () => {
    console.log("Return clicked");
    showModal("return");
  });
  cancelBtn.addEventListener("click", () => {
    console.log("Cancel clicked");
    hideModal();
  });
  actionBtn.addEventListener("click", async () => {
    console.log("Action:", actionBtn.textContent);
    await handleAction();
  });
  confirmBtn.addEventListener("click", async () => {
    await handleAction();
  });

  document.querySelectorAll("th[data-field]").forEach((th) => {
    th.addEventListener("click", () => {
      const f = th.dataset.field;
      if (sortField === f) sortDir *= -1;
      else {
        sortField = f;
        sortDir = 1;
      }
      currentPage = 1;
      renderPage();
    });
  });

  // Sidebar toggle & highlight
  const sidebarToggle = document.getElementById("sidebarToggle");
  const sidebar = document.getElementById("sidebar");
  if (sidebarToggle && sidebar) {
    sidebarToggle.addEventListener("click", () =>
      sidebar.classList.toggle("hidden")
    );
  }
  if (sidebar) {
    document.querySelectorAll("#sidebar a").forEach((a) => {
      if (a.getAttribute("href") === "orders.html") {
        a.classList.add("bg-[var(--madas-hover-dark)]", "text-white");
      }
    });
  }

  // Load real orders from Firestore
  async function loadOrdersFromFirestore() {
    sampleOrders = [];
    const ordersSnapshot = await getDocs(collection(db, "orders"));
    ordersSnapshot.forEach((docSnap) => {
      sampleOrders.push({ id: docSnap.id, ...docSnap.data() });
    });
    renderPage();
  }

  // Initialize
  loadOrdersFromFirestore();
});
