(() => {
  const NOISE_TEXTURE =
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E" +
    "%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E" +
    "%3CfeColorMatrix type='matrix' values='0 0 0 0 0.13  0 0 0 0 0.12  0 0 0 0 0.11  0 0 0 0.05 0'/%3E%3C/filter%3E" +
    "%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

  const FALLBACK_GRADIENTS = [
    "linear-gradient(160deg, #D9F0E4 0%, #FFFFFF 62%)",
    "linear-gradient(160deg, #FCE1E6 0%, #FFFFFF 62%)",
    "linear-gradient(160deg, #DCEBFA 0%, #FFFFFF 62%)",
    "linear-gradient(160deg, #E9E1F7 0%, #FFFFFF 62%)",
  ];
  const FALLBACK_BORDERS = ["#ffe1d0", "#e1eecc"];

  const CATEGORY_RULES = [
    { test: /princesa|muñeca/, gradient: "linear-gradient(160deg, #FCE1E6 0%, #FFFFFF 62%)", border: "#F6B8C4" },
    { test: /tocador|maquillaje|accesorio|bisuteria|bisutería|pulsera|trenza|jewelry/, gradient: "linear-gradient(160deg, #E9E1F7 0%, #FFFFFF 62%)", border: "#C7B8ED" },
    { test: /dibujo/, gradient: "linear-gradient(160deg, #FDECC8 0%, #FFFFFF 62%)", border: "#F0CE85" },
    { test: /policia|policía|carro|pista|excavadora|control remoto/, gradient: "linear-gradient(160deg, #DCEBFA 0%, #FFFFFF 62%)", border: "#A8CBEE" },
    { test: /pistola|rifle/, gradient: "linear-gradient(160deg, #FDE3CC 0%, #FFFFFF 62%)", border: "#F4B784" },
    { test: /bebe|bebé/, gradient: "linear-gradient(160deg, #DCEFFB 0%, #FFFDF6 62%)", border: "#A9D3EC" },
    { test: /cocina/, gradient: "linear-gradient(160deg, #CDEFE9 0%, #FFFFFF 62%)", border: "#8ED9C9" },
    { test: /dinosaurio/, gradient: "linear-gradient(160deg, #DCE4C2 0%, #FFFFFF 62%)", border: "#B3C182" },
    { test: /instrumento|guitarra|musical/, gradient: "linear-gradient(160deg, #DAD6F2 0%, #FFFFFF 62%)", border: "#B0A6DD" },
  ];

  function categoryStyle(name, index) {
    const n = name.toLowerCase();
    const rule = CATEGORY_RULES.find((r) => r.test.test(n));
    return {
      gradient: rule ? rule.gradient : FALLBACK_GRADIENTS[index % FALLBACK_GRADIENTS.length],
      border: rule ? rule.border : FALLBACK_BORDERS[index % FALLBACK_BORDERS.length],
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

  // Construido vía DOM (no como string de HTML): el degradado de cada
  // tarjeta combina una textura SVG con comillas dobles propias, y al
  // interpolarla dentro de un atributo style="..." con comillas dobles
  // el navegador cortaba el atributo a la mitad — la tarjeta perdía el
  // color de fondo. Asignar el estilo por JS evita el conflicto de comillas.
  function buildCard(p) {
    const inStock = isInStock(p);
    const card = document.createElement("button");
    card.type = "button";
    card.className = "card" + (inStock ? "" : " card--out-of-stock");
    card.dataset.ref = p.ref;
    card.style.borderColor = p.border;
    card.style.backgroundImage = `${NOISE_TEXTURE}, ${p.gradient}`;

    const watermark = document.createElement("img");
    watermark.className = "card__watermark";
    watermark.src = LOGO_URL;
    watermark.alt = "";
    card.appendChild(watermark);

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
    card.appendChild(media);

    const ref = document.createElement("span");
    ref.className = "tag tag--outline";
    ref.textContent = `Ref. ${p.ref}`;
    card.appendChild(ref);

    const title = document.createElement("div");
    title.className = "card__title";
    title.textContent = p.name;
    card.appendChild(title);

    const price = document.createElement("div");
    price.className = "card__price";
    price.textContent = formatCOP(p.price);
    card.appendChild(price);

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
    card.appendChild(meta);

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
