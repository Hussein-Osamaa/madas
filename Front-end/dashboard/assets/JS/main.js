import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";

const firebaseConfig = {
  apiKey: "AIzaSyC-ls1TrvSkrw71KqmB_kHYgPoj9H55oa8",
  authDomain: "madas-store.firebaseapp.com",
  projectId: "madas-store",
  storageBucket: "madas-store.appspot.com",
  messagingSenderId: "527071300010",
  appId: "1:527071300010:web:70470e2204065b4590583d3",
  measurementId: "G-NQVR1F4N3Q",
};

const app = initializeApp(firebaseConfig);

import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

const db = getFirestore(app);
const storage = getStorage(app);

let editingId = null;

window.openModal = function (product = null) {
  document.getElementById("addProductModal").classList.remove("hidden");

  const skuField = document.getElementById("sku");
  const barcodeField = document.getElementById("barcode");

  if (product) {
    editingId = product.id;
    document.getElementById("productName").value = product.name;
    document.getElementById("brand").value = product.brand;
    document.getElementById("price").value = product.price;
    document.getElementById("stock").value = product.stock;
    skuField.value = product?.sku || `MAD-${String(Date.now()).slice(-4)}`;
    barcodeField.value =
      product?.barcode || (100000000000 + Date.now()).toString();

    document.querySelectorAll('input[name="sizes"]').forEach((cb) => {
      cb.checked = product.sizes?.includes(cb.value) || false;
    });
  } else {
    editingId = null;
    skuField.value = `MAD-${String(Date.now()).slice(-4)}`;
    barcodeField.value = (100000000000 + Date.now()).toString();
    document.getElementById("productForm").reset();
    document.getElementById("imageFile").value = "";
  }
};

async function loadProducts() {
  console.log("Loading products...");
  const tbody = document.querySelector("tbody");
  tbody.innerHTML = ""; // clear old content

  try {
    const querySnapshot = await getDocs(collection(db, "products"));
    querySnapshot.forEach((doc) => {
      const data = doc.data();

      const row = `
        <tr class="border-b" data-id="${doc.id}">
          <td class="p-3">${data.sku}</td>
          <td class="p-3">${data.barcode}</td>
          <td class="p-3">${data.name}</td>
          <td class="p-3">${data.brand}</td>
          <td class="p-3">$${data.price}</td>
          <td class="p-3">${data.stock}</td>
          <td class="p-3">${data.sizes?.join(", ") || ""}</td>
          <td class="p-3 space-x-2">
            <button class="edit-btn text-sm bg-yellow-400 px-3 py-1 rounded text-black">Edit</button>
            <button class="delete-btn text-sm bg-red-500 px-3 py-1 rounded text-white">Delete</button>
          </td>
        </tr>
      `;

      tbody.insertAdjacentHTML("beforeend", row);
    });
  } catch (error) {
    console.error("Failed to load products:", error);
  }
}

loadProducts();

const form = document.getElementById("productForm");

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const name = document.getElementById("productName").value;
  const brand = document.getElementById("brand").value;
  const price = parseFloat(document.getElementById("price").value);
  const stock = parseInt(document.getElementById("stock").value);
  const sku = document.getElementById("sku").value;
  const barcode = document.getElementById("barcode").value;

  const imageFile = document.getElementById("imageFile").files[0];
  let imageUrl = "";

  if (imageFile) {
    const imgRef = storageRef(
      storage,
      `product-images/${Date.now()}_${imageFile.name}`
    );
    const snapshot = await uploadBytes(imgRef, imageFile);
    imageUrl = await getDownloadURL(snapshot.ref);
  }

  const sizes = [
    ...document.querySelectorAll('input[name="sizes"]:checked'),
  ].map((cb) => cb.value);

  const productData = {
    name,
    brand,
    price,
    stock,
    sku,
    barcode,
    sizes,
    imageUrl,
  };

  try {
    if (editingId) {
      const productRef = doc(db, "products", editingId);
      await updateDoc(productRef, productData);
    } else {
      await addDoc(collection(db, "products"), productData);
    }

    form.reset();
    closeModal();
    loadProducts();
  } catch (error) {
    console.error("Failed to save product:", error);
  }
});

document.querySelector("tbody").addEventListener("click", async (e) => {
  const row = e.target.closest("tr");
  const id = row?.dataset?.id;

  if (e.target.classList.contains("delete-btn")) {
    if (confirm("Are you sure you want to delete this product?")) {
      try {
        await deleteDoc(doc(db, "products", id));
        loadProducts();
      } catch (err) {
        console.error("Failed to delete:", err);
      }
    }
  }

  if (e.target.classList.contains("edit-btn")) {
    const row = e.target.closest("tr");
    const id = row.dataset.id;
    const cells = row.querySelectorAll("td");

    const product = {
      id,
      sku: cells[0].textContent,
      barcode: cells[1].textContent,
      name: cells[2].textContent,
      brand: cells[3].textContent,
      price: cells[4].textContent.replace("$", ""),
      stock: cells[5].textContent,
      sizes: cells[6].textContent.split(",").map((s) => s.trim()),
    };

    openModal(product);
  }
});
