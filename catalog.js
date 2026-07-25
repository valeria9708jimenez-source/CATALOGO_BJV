(() => {
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

  function waLink(p) {
    const text = encodeURIComponent(`Hola BJV, quiero pedir el producto ${p.ref} - ${p.name}.`);
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${text}`;
  }

  const loadingState = document.getElementById("loading-state");
  const errorState = document.getElementById("error-state");
  const grid = document.getElementById("product-grid");
  const noResults = document.getElementById("no-results");
  const searchInput = document.getElementById("search-input");
  const productCountEl = document.getElementById("product-count");

  let decorated = [];

  function buildCard(p) {
    const inStock = isInStock(p);
    const card = document.createElement("button");
    card.type = "button";
    card.className = "card" + (inStock ? "" : " card--out-of-stock");
    card.dataset.ref = p.ref;

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

  grid.addEventListener("click", (e) => {
    const card = e.target.closest(".card");
    if (!card) return;
    const product = decorated.find((p) => p.ref === card.dataset.ref);
    if (product) openModal(product);
  });

  searchInput.addEventListener("input", (e) => render(e.target.value));

  // — modal —
  const backdrop = document.getElementById("modal-backdrop");
  const dialog = document.getElementById("modal-dialog");
  const modalImage = document.getElementById("modal-image");
  const modalBadge = document.getElementById("modal-badge");
  const modalRef = document.getElementById("modal-ref");
  const modalName = document.getElementById("modal-name");
  const modalPrice = document.getElementById("modal-price");
  const modalBulto = document.getElementById("modal-bulto");
  const modalMedidas = document.getElementById("modal-medidas");
  const modalWhatsapp = document.getElementById("modal-whatsapp");

  function openModal(p) {
    modalImage.src = p.image_url;
    modalImage.alt = p.name;
    modalBadge.hidden = !isInStock(p);
    modalRef.textContent = `Ref. ${p.ref}`;
    modalName.textContent = p.name;
    modalPrice.textContent = formatCOP(p.price);
    modalBulto.textContent = `📦 Presentación: BTO: ${p.bto}`;
    modalMedidas.textContent = p.medidas ? `📐 Medidas: ${p.medidas}` : "";
    modalWhatsapp.href = waLink(p);
    backdrop.hidden = false;
  }

  function closeModal() { backdrop.hidden = true; }

  document.getElementById("modal-close").addEventListener("click", closeModal);
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) closeModal(); });
  dialog.addEventListener("click", (e) => e.stopPropagation());
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !backdrop.hidden) closeModal(); });

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
    render(searchInput.value);
  }

  loadProducts();
})();
