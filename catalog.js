(() => {
  const CART_STORAGE_KEY = "bjv-cart";

  const FALLBACK_STRIPS = ["#ffe1d0", "#e1eecc", "#dcebfa", "#e9e1f7"];

  const CATEGORY_RULES = [
    { test: /princesa|muñeca/, strip: "#F6B8C4" },
    { test: /tocador|maquillaje|accesorio|bisuteria|bisutería|pulsera|trenza|jewelry/, strip: "#C7B8ED" },
    { test: /dibujo/, strip: "#F0CE85" },
    { test: /policia|policía|carro|pista|excavadora|control remoto/, strip: "#A8CBEE" },
    { test: /pistola|rifle/, strip: "#F4B784" },
    { test: /bebe|bebé/, strip: "#A9D3EC" },
    { test: /cocina/, strip: "#8ED9C9" },
    { test: /dinosaurio/, strip: "#B3C182" },
    { test: /instrumento|guitarra|musical/, strip: "#B0A6DD" },
  ];

  function categoryStyle(name, index) {
    const n = name.toLowerCase();
    const rule = CATEGORY_RULES.find((r) => r.test.test(n));
    return {
      strip: rule ? rule.strip : FALLBACK_STRIPS[index % FALLBACK_STRIPS.length],
    };
  }

  function formatCOP(n) {
    if (n == null) return "Precio por confirmar";
    return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);
  }

  function isInStock(p) { return p.in_stock !== false; }

  const loadingState = document.getElementById("loading-state");
  const errorState = document.getElementById("error-state");
  const grid = document.getElementById("product-grid");
  const noResults = document.getElementById("no-results");
  const searchInput = document.getElementById("search-input");
  const productCountEl = document.getElementById("product-count");

  let decorated = [];

  // — carrito —
  // Estado: [{ ref, qty }]. Los datos del producto (nombre/precio/foto) siempre
  // se leen en vivo desde `decorated` — el carrito solo guarda referencia + cantidad,
  // así nunca queda desincronizado si un precio cambia en Supabase.
  let cart = [];
  try {
    const stored = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || "[]");
    if (Array.isArray(stored)) cart = stored.filter((it) => it && typeof it.ref === "string" && it.qty > 0);
  } catch { /* localStorage no disponible o corrupto — arranca con carrito vacío */ }

  function saveCart() {
    try { localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart)); } catch { /* modo privado, etc. */ }
  }

  function findProduct(ref) { return decorated.find((p) => p.ref === ref); }

  function addToCart(ref, qty) {
    const line = cart.find((it) => it.ref === ref);
    if (line) line.qty += qty;
    else cart.push({ ref, qty });
    saveCart();
    renderCartBadge();
  }

  function setQty(ref, qty) {
    if (qty <= 0) {
      cart = cart.filter((it) => it.ref !== ref);
    } else {
      const line = cart.find((it) => it.ref === ref);
      if (line) line.qty = qty;
    }
    saveCart();
    renderCartBadge();
    renderCartItems();
  }

  function cartCount() { return cart.reduce((sum, it) => sum + it.qty, 0); }
  function cartLines() {
    return cart
      .map((it) => ({ item: it, product: findProduct(it.ref) }))
      .filter((l) => l.product);
  }
  function cartTotal() {
    return cartLines().reduce((sum, l) => sum + (l.product.price || 0) * l.item.qty, 0);
  }

  const cartCountEl = document.getElementById("cart-count");
  function renderCartBadge() {
    const n = cartCount();
    cartCountEl.textContent = String(n);
    cartCountEl.hidden = n === 0;
  }

  function buildCard(p) {
    const inStock = isInStock(p);
    const card = document.createElement("div");
    card.className = "card" + (inStock ? "" : " card--out-of-stock");
    card.dataset.ref = p.ref;
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", `Ver detalle de ${p.name}`);

    const strip = document.createElement("div");
    strip.className = "card__strip";
    strip.style.background = p.strip;
    card.appendChild(strip);

    const watermark = document.createElement("img");
    watermark.className = "card__watermark";
    watermark.src = LOGO_URL;
    watermark.alt = "";
    card.appendChild(watermark);

    const content = document.createElement("div");
    content.className = "card__content";

    const media = document.createElement("div");
    media.className = "card__media";
    const img = document.createElement("img");
    img.className = "card__image";
    img.src = p.image_url;
    img.alt = p.name;
    img.loading = "lazy";
    media.appendChild(img);

    const badge = document.createElement("span");
    badge.className = inStock ? "badge badge--stock" : "badge badge--out";
    badge.textContent = inStock ? "Disponible" : "Agotado";
    media.appendChild(badge);
    content.appendChild(media);

    const ref = document.createElement("span");
    ref.className = "tag tag--outline";
    ref.textContent = `Ref. ${p.ref}`;
    content.appendChild(ref);

    const title = document.createElement("div");
    title.className = "card__title";
    title.textContent = p.name;
    content.appendChild(title);

    const price = document.createElement("div");
    price.className = "card__price";
    price.textContent = formatCOP(p.price);
    content.appendChild(price);

    const meta = document.createElement("div");
    meta.className = "card__meta";
    const bto = document.createElement("span");
    bto.textContent = `📦 BTO: ${p.bto}`;
    meta.appendChild(bto);
    if (p.medidas) {
      const medidas = document.createElement("span");
      medidas.textContent = `📐 ${p.medidas}`;
      meta.appendChild(medidas);
    }
    content.appendChild(meta);

    if (inStock) {
      const addBtn = document.createElement("button");
      addBtn.type = "button";
      addBtn.className = "btn btn--primary btn--block card__add-btn";
      addBtn.textContent = "Agregar al carrito";
      content.appendChild(addBtn);
    }

    card.appendChild(content);
    return card;
  }

  function render(query) {
    const q = query.trim().toLowerCase();
    const visible = q
      ? decorated.filter((p) => p.name.toLowerCase().includes(q) || p.ref.toLowerCase().includes(q))
      : decorated;
    grid.replaceChildren(...visible.map(buildCard));
    grid.hidden = visible.length === 0;
    noResults.hidden = visible.length !== 0;
  }

  // Un solo listener delegado: el botón "Agregar al carrito" vive DENTRO de la
  // tarjeta, que ya no es un <button> (no se puede anidar un <button> dentro de
  // otro) sino un div con role="button" — este listener decide cuál de los dos
  // disparó el click antes de actuar.
  grid.addEventListener("click", (e) => {
    const card = e.target.closest(".card");
    if (!card) return;
    const product = findProduct(card.dataset.ref);
    if (!product) return;
    const addBtn = e.target.closest(".card__add-btn");
    if (addBtn) {
      addToCart(product.ref, 1);
      flashAdded(addBtn);
      return;
    }
    openModal(product);
  });
  grid.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    if (e.target.closest(".card__add-btn")) return;
    const card = e.target.closest(".card");
    if (!card || e.target !== card) return;
    e.preventDefault();
    const product = findProduct(card.dataset.ref);
    if (product) openModal(product);
  });

  function flashAdded(btn) {
    const original = btn.textContent;
    btn.textContent = "✓ Agregado";
    btn.classList.add("card__add-btn--added");
    setTimeout(() => {
      btn.textContent = original;
      btn.classList.remove("card__add-btn--added");
    }, 1100);
  }

  searchInput.addEventListener("input", (e) => render(e.target.value));

  // — modal de producto —
  const backdrop = document.getElementById("modal-backdrop");
  const dialog = document.getElementById("modal-dialog");
  const modalStrip = document.getElementById("modal-strip");
  const modalImage = document.getElementById("modal-image");
  const modalBadge = document.getElementById("modal-badge");
  const modalRef = document.getElementById("modal-ref");
  const modalName = document.getElementById("modal-name");
  const modalPrice = document.getElementById("modal-price");
  const modalBulto = document.getElementById("modal-bulto");
  const modalMedidas = document.getElementById("modal-medidas");
  const modalQtyValue = document.getElementById("modal-qty-value");
  const modalQtyMinus = document.getElementById("modal-qty-minus");
  const modalQtyPlus = document.getElementById("modal-qty-plus");
  const modalAddCart = document.getElementById("modal-add-cart");

  let modalProduct = null;
  let modalQty = 1;

  function openModal(p) {
    modalProduct = p;
    modalQty = 1;
    modalQtyValue.textContent = "1";
    modalStrip.style.background = p.strip;
    modalImage.src = p.image_url;
    modalImage.alt = p.name;
    modalBadge.hidden = !isInStock(p);
    modalRef.textContent = `Ref. ${p.ref}`;
    modalName.textContent = p.name;
    modalPrice.textContent = formatCOP(p.price);
    modalBulto.textContent = `📦 Presentación: BTO: ${p.bto}`;
    modalMedidas.textContent = p.medidas ? `📐 Medidas: ${p.medidas}` : "";
    modalAddCart.disabled = !isInStock(p);
    modalAddCart.textContent = isInStock(p) ? "Agregar al carrito" : "Agotado";
    backdrop.hidden = false;
  }
  function closeModal() { backdrop.hidden = true; modalProduct = null; }

  modalQtyMinus.addEventListener("click", () => {
    modalQty = Math.max(1, modalQty - 1);
    modalQtyValue.textContent = String(modalQty);
  });
  modalQtyPlus.addEventListener("click", () => {
    modalQty = Math.min(999, modalQty + 1);
    modalQtyValue.textContent = String(modalQty);
  });
  modalAddCart.addEventListener("click", () => {
    if (!modalProduct) return;
    addToCart(modalProduct.ref, modalQty);
    flashAdded(modalAddCart);
    setTimeout(() => { if (!backdrop.hidden) closeModal(); }, 650);
  });

  document.getElementById("modal-close").addEventListener("click", closeModal);
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) closeModal(); });
  dialog.addEventListener("click", (e) => e.stopPropagation());
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!checkoutBackdrop.hidden) closeCheckout();
    else if (!cartBackdrop.hidden) closeCart();
    else if (!backdrop.hidden) closeModal();
  });

  // — carrito (drawer) —
  const cartButton = document.getElementById("cart-button");
  const cartBackdrop = document.getElementById("cart-backdrop");
  const cartDialog = document.getElementById("cart-dialog");
  const cartItemsEl = document.getElementById("cart-items");
  const cartEmptyEl = document.getElementById("cart-empty");
  const cartTotalRow = document.getElementById("cart-total-row");
  const cartTotalEl = document.getElementById("cart-total");
  const cartCheckoutBtn = document.getElementById("cart-checkout-btn");

  function buildCartItemRow(line) {
    const { item, product } = line;
    const row = document.createElement("div");
    row.className = "cart-item";

    const media = document.createElement("div");
    media.className = "cart-item__media";
    const img = document.createElement("img");
    img.src = product.image_url;
    img.alt = product.name;
    media.appendChild(img);
    row.appendChild(media);

    const info = document.createElement("div");
    info.className = "cart-item__info";
    const name = document.createElement("div");
    name.className = "cart-item__name";
    name.textContent = product.name;
    info.appendChild(name);
    const ref = document.createElement("div");
    ref.className = "cart-item__ref";
    ref.textContent = `Ref. ${product.ref}`;
    info.appendChild(ref);
    const price = document.createElement("div");
    price.className = "cart-item__price";
    price.textContent = formatCOP((product.price || 0) * item.qty);
    info.appendChild(price);
    row.appendChild(info);

    const controls = document.createElement("div");
    controls.className = "cart-item__controls";
    const minus = document.createElement("button");
    minus.type = "button";
    minus.className = "btn btn--ghost btn--icon";
    minus.textContent = "−";
    minus.setAttribute("aria-label", "Restar unidad");
    minus.addEventListener("click", () => setQty(product.ref, item.qty - 1));
    controls.appendChild(minus);
    const qtyLabel = document.createElement("span");
    qtyLabel.className = "qty-stepper__value";
    qtyLabel.textContent = String(item.qty);
    controls.appendChild(qtyLabel);
    const plus = document.createElement("button");
    plus.type = "button";
    plus.className = "btn btn--ghost btn--icon";
    plus.textContent = "+";
    plus.setAttribute("aria-label", "Sumar unidad");
    plus.addEventListener("click", () => setQty(product.ref, item.qty + 1));
    controls.appendChild(plus);
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "btn btn--ghost btn--icon cart-item__remove";
    remove.setAttribute("aria-label", "Quitar del carrito");
    remove.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round"><path d="M3 6h18"></path><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path></svg>';
    remove.addEventListener("click", () => setQty(product.ref, 0));
    controls.appendChild(remove);
    row.appendChild(controls);

    return row;
  }

  function renderCartItems() {
    const lines = cartLines();
    cartItemsEl.replaceChildren(...lines.map(buildCartItemRow));
    const empty = lines.length === 0;
    cartEmptyEl.hidden = !empty;
    cartItemsEl.hidden = empty;
    cartTotalRow.hidden = empty;
    cartCheckoutBtn.disabled = empty;
    if (!empty) cartTotalEl.textContent = formatCOP(cartTotal());
  }

  function openCart() { renderCartItems(); cartBackdrop.hidden = false; }
  function closeCart() { cartBackdrop.hidden = true; }

  cartButton.addEventListener("click", openCart);
  document.getElementById("cart-close").addEventListener("click", closeCart);
  cartBackdrop.addEventListener("click", (e) => { if (e.target === cartBackdrop) closeCart(); });
  cartDialog.addEventListener("click", (e) => e.stopPropagation());

  // — checkout —
  const checkoutBackdrop = document.getElementById("checkout-backdrop");
  const checkoutDialog = document.getElementById("checkout-dialog");
  const checkoutForm = document.getElementById("checkout-form");
  const checkoutName = document.getElementById("checkout-name");
  const checkoutCedula = document.getElementById("checkout-cedula");
  const checkoutAddress = document.getElementById("checkout-address");
  const checkoutCity = document.getElementById("checkout-city");

  function openCheckout() { closeCart(); checkoutBackdrop.hidden = false; checkoutName.focus(); }
  function closeCheckout() { checkoutBackdrop.hidden = true; }

  cartCheckoutBtn.addEventListener("click", () => { if (cart.length) openCheckout(); });
  document.getElementById("checkout-close").addEventListener("click", closeCheckout);
  checkoutBackdrop.addEventListener("click", (e) => { if (e.target === checkoutBackdrop) closeCheckout(); });
  checkoutDialog.addEventListener("click", (e) => e.stopPropagation());

  function buildOrderMessage(contact) {
    const lines = cartLines();
    const itemLines = lines.map(({ item, product }) => {
      const subtotal = product.price != null ? formatCOP(product.price * item.qty) : "por confirmar";
      return `- ${product.ref} ${product.name} x${item.qty} — ${subtotal}`;
    });
    return [
      "Hola BJV, quiero confirmar este pedido:",
      "",
      `*Cliente:* ${contact.name}`,
      `*Cédula:* ${contact.cedula}`,
      `*Dirección:* ${contact.address}, ${contact.city}`,
      "",
      "*Pedido:*",
      ...itemLines,
      "",
      `*Total: ${formatCOP(cartTotal())}*`,
    ].join("\n");
  }

  checkoutForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const contact = {
      name: checkoutName.value.trim(),
      cedula: checkoutCedula.value.trim(),
      address: checkoutAddress.value.trim(),
      city: checkoutCity.value.trim(),
    };
    if (!contact.name || !contact.cedula || !contact.address || !contact.city || cart.length === 0) return;

    const message = buildOrderMessage(contact);
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank", "noopener");

    cart = [];
    saveCart();
    renderCartBadge();
    checkoutForm.reset();
    closeCheckout();
  });

  // — carga en vivo desde Supabase —
  const LOGO_URL = `${SUPABASE_URL}/storage/v1/object/public/products/logo-bjv.png`;
  document.querySelectorAll(".site-header__logo").forEach((img) => { img.src = LOGO_URL; });

  async function loadProducts() {
    const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
    const { data, error } = await client
      .from("products")
      .select("*")
      .order("sort_order", { ascending: true });

    loadingState.hidden = true;
    if (error || !data) {
      errorState.hidden = false;
      console.error("[catalogo] no se pudieron cargar los productos:", error);
      return;
    }

    decorated = data.map((p, i) => ({ ...p, ...categoryStyle(p.name, i) }));
    productCountEl.textContent = String(decorated.length);
    cart = cart.filter((it) => findProduct(it.ref));
    saveCart();
    renderCartBadge();
    render(searchInput.value);
  }

  loadProducts();
})();
