/* ============================================================
   Pyexdg — логика магазина.
   Товары, цены и ссылки меняются в js/config.js, здесь трогать ничего не нужно.
   ============================================================ */
(function () {
  "use strict";

  var SHOP = window.SHOP || {};
  var products = Array.isArray(SHOP.products) ? SHOP.products : [];
  var contacts = SHOP.contacts || {};
  var shopName = SHOP.name || "Pyexdg";
  var currency = SHOP.currency || "₽";
  var CART_KEY = "pyexdg-cart";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  var byId = {};
  products.forEach(function (p) { byId[p.id] = p; });

  /* ---------- Помощники ---------- */
  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  var nf = new Intl.NumberFormat("ru-RU");
  function money(n) { return nf.format(Number(n) || 0) + " " + currency; }

  function discount(p) {
    if (!p.oldPrice || p.oldPrice <= p.price) return 0;
    return Math.round((1 - p.price / p.oldPrice) * 100);
  }

  function telegramUsername(value) {
    var v = String(value || "").trim();
    if (!v) return "";
    v = v.replace(/^https?:\/\//i, "").replace(/^(www\.)?(t\.me|telegram\.me)\//i, "").replace(/^@/, "");
    return v.split(/[/?#]/)[0];
  }

  function asUrl(value) {
    var v = String(value || "").trim();
    if (!v) return "";
    if (/^https?:\/\//i.test(v)) return v;
    return "https://" + v.replace(/^\/+/, "");
  }

  function handleFromUrl(url) {
    return url.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/$/, "");
  }

  var ICONS = {
    plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
    minus: '<svg viewBox="0 0 24 24"><path d="M5 12h14"/></svg>',
    arrow: '<svg viewBox="0 0 24 24"><path d="M7 17 17 7M8 7h9v9"/></svg>',
    telegram: '<svg viewBox="0 0 24 24"><path d="M21 4 3 11l6 2.5L11.5 20 21 4Z"/><path d="m9 13.5 4-3.5"/></svg>',
    channel: '<svg viewBox="0 0 24 24"><path d="M4 10v4a1 1 0 0 0 1 1h3l6 4V5L8 9H5a1 1 0 0 0-1 1Z"/><path d="M18 9a4 4 0 0 1 0 6"/></svg>',
    email: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7 8 6 8-6"/></svg>',
    avito: '<svg viewBox="0 0 24 24"><path d="M3 12.5V4a1 1 0 0 1 1-1h8.5l8.8 8.8a1 1 0 0 1 0 1.4l-7.9 7.9a1 1 0 0 1-1.4 0L3 12.5Z"/><circle cx="8" cy="8" r="1.6"/></svg>',
    tiktok: '<svg viewBox="0 0 24 24"><path d="M14 4v10.5a3.5 3.5 0 1 1-3.5-3.5"/><path d="M14 4c.4 2.6 2.2 4.3 5 4.5"/></svg>',
    youtube: '<svg viewBox="0 0 24 24"><rect x="2.5" y="5.5" width="19" height="13" rx="4"/><path d="m10 9.5 5 2.5-5 2.5v-5Z"/></svg>',
  };

  /* ---------- Тексты из настроек ---------- */
  function fillTexts() {
    document.title = shopName + " — магазин";
    $$("[data-shop-name]").forEach(function (el) { el.textContent = shopName; });
    $$(".logo__mark span").forEach(function (el) { el.textContent = shopName.charAt(0).toUpperCase(); });
    $("[data-tagline]").textContent = SHOP.tagline || "";
    $("[data-subtitle]").textContent = SHOP.subtitle || "";
    $("[data-year]").textContent = new Date().getFullYear();

    var title = $("[data-hero-title]");
    title.setAttribute("aria-label", shopName);
    title.innerHTML = Array.from(shopName).map(function (ch, i) {
      return '<span class="ch" aria-hidden="true" style="--i:' + i + '">' + (ch === " " ? "&nbsp;" : esc(ch)) + "</span>";
    }).join("");

    var words = (SHOP.marquee && SHOP.marquee.length ? SHOP.marquee : [shopName]);
    var colors = ["var(--c-orange)", "var(--c-yellow)", "var(--c-green)", "var(--c-teal)", "var(--c-blue)", "var(--c-violet)", "var(--c-magenta)", "var(--c-coral)"];
    var chunk = "";
    for (var r = 0; r < 3; r++) {
      words.forEach(function (w, i) {
        chunk += '<span class="marquee__item">' + esc(w) + '<span class="marquee__star" style="--c:' + colors[(i + r * 3) % colors.length] + '">✦</span></span>';
      });
    }
    $("[data-marquee]").innerHTML = chunk + chunk; // два одинаковых куска для бесшовной прокрутки
  }

  /* ---------- Главный экран: летающие карточки ---------- */
  function renderHeroCards() {
    var picks = products.filter(function (p) { return !p.soldOut; }).slice(0, 3);
    $("[data-hero-cards]").innerHTML = picks.map(function (p) {
      return '<div class="float-card"><img src="' + esc(p.image) + '" alt="" loading="eager" decoding="async">' +
        '<p class="float-card__name">' + esc(p.name) + '</p><p class="float-card__price">' + money(p.price) + "</p></div>";
    }).join("");
  }

  /* ---------- Корзина: хранение ---------- */
  var cart = loadCart();

  function loadCart() {
    try {
      var raw = JSON.parse(localStorage.getItem(CART_KEY) || "{}");
      var clean = {};
      Object.keys(raw).forEach(function (id) {
        var q = parseInt(raw[id], 10);
        if (byId[id] && !byId[id].soldOut && q > 0) clean[id] = Math.min(q, 99);
      });
      return clean;
    } catch (e) {
      return {};
    }
  }

  function saveCart() {
    try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch (e) { /* без сохранения тоже работает */ }
  }

  function qty(id) { return cart[id] || 0; }
  function cartCount() { return Object.keys(cart).reduce(function (s, id) { return s + cart[id]; }, 0); }
  function cartTotal() { return Object.keys(cart).reduce(function (s, id) { return s + cart[id] * byId[id].price; }, 0); }

  function setQty(id, n) {
    var p = byId[id];
    if (!p || p.soldOut) return;
    n = Math.max(0, Math.min(99, n));
    if (n === 0) delete cart[id]; else cart[id] = n;
    saveCart();
    updateCartUI();
    updateCardAction(id);
  }

  /* ---------- Каталог ---------- */
  var state = { category: "Все", query: "" };
  var grid = $("[data-grid]");

  function categories() {
    var list = [];
    products.forEach(function (p) { if (p.category && list.indexOf(p.category) === -1) list.push(p.category); });
    return list;
  }

  function renderFilters() {
    var cats = ["Все"].concat(categories());
    $("[data-filters]").innerHTML = cats.map(function (c) {
      var count = c === "Все" ? products.length : products.filter(function (p) { return p.category === c; }).length;
      var active = c === state.category;
      return '<button class="chip' + (active ? " is-active" : "") + '" type="button" role="tab" aria-selected="' + active + '" data-cat="' + esc(c) + '">' +
        esc(c) + '<span class="chip__count">' + count + "</span></button>";
    }).join("");
  }

  function visibleProducts() {
    var q = state.query.trim().toLowerCase();
    return products.filter(function (p) {
      if (state.category !== "Все" && p.category !== state.category) return false;
      if (!q) return true;
      return (p.name + " " + (p.category || "") + " " + (p.description || "")).toLowerCase().indexOf(q) !== -1;
    });
  }

  function actionHTML(p) {
    if (p.soldOut) return '<button class="add-btn" type="button" disabled>Нет в наличии</button>';
    var q = qty(p.id);
    if (q > 0) {
      return '<div class="stepper" role="group" aria-label="Количество ' + esc(p.name) + '">' +
        '<button type="button" data-dec="' + esc(p.id) + '" aria-label="Убрать одну">' + ICONS.minus + "</button>" +
        "<span>" + q + " шт.</span>" +
        '<button type="button" data-inc="' + esc(p.id) + '" aria-label="Добавить ещё">' + ICONS.plus + "</button></div>";
    }
    return '<button class="add-btn" type="button" data-add="' + esc(p.id) + '">' + ICONS.plus + "В корзину</button>";
  }

  function cardHTML(p, i) {
    var off = discount(p);
    var badges = "";
    if (p.soldOut) badges += '<span class="badge badge--out">Нет в наличии</span>';
    if (p.badge) badges += '<span class="badge">' + esc(p.badge) + "</span>";
    if (off) badges += '<span class="badge badge--sale">−' + off + "%</span>";

    return '<article class="card reveal' + (p.soldOut ? " is-sold-out" : "") + '" data-id="' + esc(p.id) + '" style="--d:' + (Math.min(i, 7) * 0.06).toFixed(2) + 's">' +
      '<button class="card__media" type="button" data-open="' + esc(p.id) + '" aria-label="Подробнее: ' + esc(p.name) + '">' +
        (badges ? '<span class="badges">' + badges + "</span>" : "") +
        '<img src="' + esc(p.image) + '" alt="' + esc(p.name) + '" loading="lazy" decoding="async">' +
      "</button>" +
      '<div class="card__body">' +
        (p.category ? '<p class="card__cat">' + esc(p.category) + "</p>" : "") +
        '<h3 class="card__title"><button type="button" data-open="' + esc(p.id) + '">' + esc(p.name) + "</button></h3>" +
        '<div class="card__foot">' +
          '<div class="price"><strong>' + money(p.price) + "</strong>" + (off ? "<s>" + money(p.oldPrice) + "</s>" : "") + "</div>" +
          '<div class="card__action">' + actionHTML(p) + "</div>" +
        "</div>" +
      "</div>" +
    "</article>";
  }

  function renderGrid() {
    var list = visibleProducts();
    grid.innerHTML = list.map(cardHTML).join("");
    $("[data-empty]").hidden = list.length > 0;
    $$("img", grid).forEach(attachImgFallback);
    $$(".reveal", grid).forEach(observe);
  }

  var switchTimer;
  function rerenderGrid() {
    if (reduceMotion) { renderGrid(); return; }
    clearTimeout(switchTimer);
    grid.classList.add("is-switching");
    switchTimer = setTimeout(function () {
      renderGrid();
      grid.classList.remove("is-switching");
    }, 220);
  }

  function updateCardAction(id) {
    var card = grid.querySelector('.card[data-id="' + cssEscape(id) + '"]');
    if (card) $(".card__action", card).innerHTML = actionHTML(byId[id]);
  }

  function cssEscape(s) {
    return window.CSS && CSS.escape ? CSS.escape(s) : String(s).replace(/["\\]/g, "\\$&");
  }

  function attachImgFallback(img) {
    img.addEventListener("error", function () {
      img.style.opacity = "0"; // если фото не нашлось, остаётся аккуратный фон
    }, { once: true });
  }

  /* ---------- Корзина: интерфейс ---------- */
  var drawer = $("[data-drawer]");
  var overlay = $("[data-overlay]");
  var modal = $("[data-modal]");
  var lastFocus = null;

  function orderText() {
    var lines = Object.keys(cart).map(function (id, i) {
      var p = byId[id];
      return (i + 1) + ". " + p.name + " — " + cart[id] + " шт. × " + money(p.price) + " = " + money(cart[id] * p.price);
    });
    return "Здравствуйте! Хочу оформить заказ в магазине " + shopName + ":\n\n" + lines.join("\n") + "\n\nИтого: " + money(cartTotal());
  }

  function updateCartUI() {
    var count = cartCount();
    $("[data-cart-count]").textContent = count;
    var ids = Object.keys(cart);
    $("[data-cart-empty]").hidden = ids.length > 0;
    $("[data-cart-foot]").hidden = ids.length === 0;
    $("[data-cart-items]").hidden = ids.length === 0;
    $("[data-cart-total]").textContent = money(cartTotal());

    $("[data-cart-items]").innerHTML = ids.map(function (id) {
      var p = byId[id];
      return '<div class="line" data-line="' + esc(id) + '">' +
        '<img src="' + esc(p.image) + '" alt="">' +
        '<div class="line__info"><p class="line__name">' + esc(p.name) + '</p><p class="line__price">' + money(p.price) + " за шт.</p>" +
          '<div class="stepper stepper--sm" role="group" aria-label="Количество">' +
            '<button type="button" data-dec="' + esc(id) + '" aria-label="Убрать одну">' + ICONS.minus + "</button>" +
            "<span>" + cart[id] + "</span>" +
            '<button type="button" data-inc="' + esc(id) + '" aria-label="Добавить ещё">' + ICONS.plus + "</button>" +
          "</div></div>" +
        '<div class="line__side"><span class="line__sum">' + money(cart[id] * p.price) + "</span>" +
          '<button class="line__remove" type="button" data-remove="' + esc(id) + '">Удалить</button></div>' +
      "</div>";
    }).join("");

    var checkout = $("[data-checkout]");
    var user = telegramUsername(contacts.telegram);
    if (user) {
      checkout.href = "https://t.me/" + encodeURIComponent(user) + "?text=" + encodeURIComponent(orderText());
      checkout.removeAttribute("data-no-tg");
    } else {
      checkout.href = "#";
      checkout.setAttribute("data-no-tg", "");
    }

    // модалка: обновить кнопку
    if (modal.classList.contains("is-open")) syncModalButton();
  }

  function bumpCart() {
    var btn = $(".cart-btn");
    btn.classList.remove("is-bump");
    void btn.offsetWidth;
    btn.classList.add("is-bump");
  }

  function flyToCart(fromEl) {
    if (reduceMotion || !fromEl || !fromEl.animate) { bumpCart(); return; }
    var from = fromEl.getBoundingClientRect();
    var to = $(".cart-btn__count").getBoundingClientRect();
    var dot = document.createElement("span");
    dot.className = "fly";
    dot.style.left = from.left + from.width / 2 + "px";
    dot.style.top = from.top + from.height / 2 + "px";
    document.body.appendChild(dot);
    var dx = to.left + to.width / 2 - (from.left + from.width / 2);
    var dy = to.top + to.height / 2 - (from.top + from.height / 2);
    var anim = dot.animate([
      { transform: "translate(0,0) scale(1)", opacity: 1 },
      { transform: "translate(" + dx * 0.5 + "px," + (dy * 0.5 - 80) + "px) scale(1.3)", opacity: 1, offset: 0.55 },
      { transform: "translate(" + dx + "px," + dy + "px) scale(0.4)", opacity: 0.6 },
    ], { duration: 700, easing: "cubic-bezier(.5,0,.5,1)" });
    anim.onfinish = function () { dot.remove(); bumpCart(); };
  }

  function addToCart(id, sourceEl) {
    setQty(id, qty(id) + 1);
    flyToCart(sourceEl);
    toast("«" + byId[id].name + "» в корзине");
  }

  function openLayer(el) {
    lastFocus = document.activeElement;
    el.classList.add("is-open");
    el.setAttribute("aria-hidden", "false");
    document.body.classList.add("is-locked");
    var focusTarget = $("[data-close]", el);
    if (focusTarget) setTimeout(function () { focusTarget.focus({ preventScroll: true }); }, 60);
  }

  function closeLayer(el) {
    el.classList.remove("is-open");
    el.setAttribute("aria-hidden", "true");
    if (!drawer.classList.contains("is-open") && !modal.classList.contains("is-open")) {
      document.body.classList.remove("is-locked");
    }
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }

  function openCart() {
    if (modal.classList.contains("is-open")) closeLayer(modal);
    overlay.classList.add("is-open");
    openLayer(drawer);
  }

  function closeCart() {
    overlay.classList.remove("is-open");
    closeLayer(drawer);
  }

  /* ---------- Окно товара ---------- */
  var modalId = null;

  function openModal(id) {
    var p = byId[id];
    if (!p) return;
    modalId = id;
    var off = discount(p);
    var img = $("[data-modal-img]");
    img.style.opacity = "";
    img.src = p.image;
    img.alt = p.name;
    $("[data-modal-cat]").textContent = p.category || "";
    $("[data-modal-title]").textContent = p.name;
    $("[data-modal-desc]").textContent = p.description || "";
    $("[data-modal-price]").innerHTML = "<strong>" + money(p.price) + "</strong>" + (off ? "<s>" + money(p.oldPrice) + "</s>" : "");
    syncModalButton();
    openLayer(modal);
  }

  function syncModalButton() {
    var p = byId[modalId];
    var btn = $("[data-modal-add]");
    if (!p) return;
    btn.disabled = !!p.soldOut;
    if (p.soldOut) btn.textContent = "Нет в наличии";
    else if (qty(p.id) > 0) btn.textContent = "В корзине: " + qty(p.id) + " шт. · добавить ещё";
    else btn.textContent = "В корзину";
  }

  /* ---------- Контакты ---------- */
  function renderContacts() {
    var tgUser = telegramUsername(contacts.telegram);
    var channelUrl = asUrl(contacts.channel);
    var email = String(contacts.email || "").trim().replace(/^mailto:/i, "");
    var avito = asUrl(contacts.avito);
    var tiktok = asUrl(contacts.tiktok);
    var youtube = asUrl(contacts.youtube);

    var items = [
      { key: "telegram", title: "Telegram", about: "Написать нам", sub: tgUser ? "@" + tgUser : "", href: tgUser ? "https://t.me/" + tgUser : "", c: "var(--c-teal)" },
      { key: "channel", title: "Telegram-канал", about: "Новинки и дропы", sub: channelUrl ? handleFromUrl(channelUrl) : "", href: channelUrl, c: "var(--c-blue)" },
      { key: "email", title: "Почта", about: "Для вопросов", sub: email, href: email ? "mailto:" + email : "", c: "var(--c-orange)" },
      { key: "avito", title: "Авито", about: "Наш профиль", sub: avito ? "Профиль и отзывы" : "", href: avito, c: "var(--c-green)" },
      { key: "tiktok", title: "TikTok", about: "Видео и обзоры", sub: tiktok ? handleFromUrl(tiktok) : "", href: tiktok, c: "var(--c-pink)" },
      { key: "youtube", title: "YouTube", about: "Обзоры товаров", sub: youtube ? handleFromUrl(youtube) : "", href: youtube, c: "var(--c-coral)" },
    ];

    $("[data-contacts]").innerHTML = items.map(function (it, i) {
      var inner = '<span class="contact__icon">' + ICONS[it.key] + "</span>" +
        '<span class="contact__text"><span class="contact__title">' + esc(it.title) + "</span>" +
        '<span class="contact__sub">' + esc(it.sub || it.about) + "</span></span>";
      var style = 'style="--c:' + it.c + "; --d:" + (i * 0.06).toFixed(2) + 's"';
      if (it.href) {
        var ext = it.key === "email" ? "" : ' target="_blank" rel="noopener"';
        return '<a class="contact reveal" href="' + esc(it.href) + '"' + ext + " " + style + ">" + inner + '<span class="contact__arrow">' + ICONS.arrow + "</span></a>";
      }
      return '<div class="contact reveal is-soon" ' + style + ">" + inner + '<span class="soon">скоро</span></div>';
    }).join("");

    $("[data-footer-social]").innerHTML = items.filter(function (it) { return it.href; }).map(function (it) {
      var ext = it.key === "email" ? "" : ' target="_blank" rel="noopener"';
      return '<a href="' + esc(it.href) + '"' + ext + ' aria-label="' + esc(it.title) + '" style="--c:' + it.c + '">' + ICONS[it.key] + "</a>";
    }).join("");

    $$(".reveal", $("[data-contacts]")).forEach(observe);
  }

  /* ---------- Уведомление ---------- */
  var toastTimer;
  function toast(text) {
    var el = $("[data-toast]");
    el.textContent = text;
    el.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove("is-visible"); }, 2200);
  }

  function copy(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy") ? resolve() : reject(); } catch (e) { reject(e); }
      ta.remove();
    });
  }

  /* ---------- Появление при прокрутке ---------- */
  var io = "IntersectionObserver" in window && !reduceMotion
    ? new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            e.target.classList.add("is-visible");
            io.unobserve(e.target);
          }
        });
      }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" })
    : null;

  function observe(el) {
    if (io) io.observe(el); else el.classList.add("is-visible");
  }

  /* ---------- Наклон карточек за курсором ---------- */
  function setupTilt() {
    if (!finePointer || reduceMotion) return;
    grid.addEventListener("pointermove", function (e) {
      var card = e.target.closest(".card");
      if (!card) return;
      var r = card.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width;
      var y = (e.clientY - r.top) / r.height;
      card.style.setProperty("--ry", ((x - 0.5) * 8).toFixed(2) + "deg");
      card.style.setProperty("--rx", ((0.5 - y) * 8).toFixed(2) + "deg");
      card.style.setProperty("--mx", (x * 100).toFixed(1) + "%");
      card.style.setProperty("--my", (y * 100).toFixed(1) + "%");
    });
    grid.addEventListener("pointerout", function (e) {
      var card = e.target.closest(".card");
      if (card && !card.contains(e.relatedTarget)) {
        card.style.setProperty("--rx", "0deg");
        card.style.setProperty("--ry", "0deg");
      }
    });
  }

  /* ---------- События ---------- */
  function bindEvents() {
    document.addEventListener("click", function (e) {
      var t = e.target.closest("[data-add],[data-inc],[data-dec],[data-remove],[data-open],[data-cat],[data-open-cart],[data-close],[data-overlay],[data-modal-add],[data-copy-order],[data-checkout]");
      if (!t) {
        if (e.target === modal) closeLayer(modal);
        return;
      }

      if (t.hasAttribute("data-add")) addToCart(t.getAttribute("data-add"), t);
      else if (t.hasAttribute("data-inc")) { var id1 = t.getAttribute("data-inc"); setQty(id1, qty(id1) + 1); }
      else if (t.hasAttribute("data-dec")) { var id2 = t.getAttribute("data-dec"); setQty(id2, qty(id2) - 1); }
      else if (t.hasAttribute("data-remove")) {
        var id3 = t.getAttribute("data-remove");
        var line = t.closest(".line");
        if (line && !reduceMotion) {
          line.classList.add("is-removing");
          setTimeout(function () { setQty(id3, 0); }, 260);
        } else setQty(id3, 0);
      }
      else if (t.hasAttribute("data-open")) openModal(t.getAttribute("data-open"));
      else if (t.hasAttribute("data-cat")) {
        state.category = t.getAttribute("data-cat");
        renderFilters();
        rerenderGrid();
      }
      else if (t.hasAttribute("data-open-cart")) openCart();
      else if (t.hasAttribute("data-overlay")) closeCart();
      else if (t.hasAttribute("data-close")) {
        if (t.closest("[data-drawer]")) closeCart(); else closeLayer(modal);
      }
      else if (t.hasAttribute("data-modal-add")) {
        if (modalId) addToCart(modalId, t);
      }
      else if (t.hasAttribute("data-copy-order")) {
        copy(orderText()).then(function () { toast("Заказ скопирован"); }, function () { toast("Не получилось скопировать"); });
      }
      else if (t.hasAttribute("data-checkout") && t.hasAttribute("data-no-tg")) {
        e.preventDefault();
        copy(orderText()).then(
          function () { toast("Заказ скопирован. Telegram для заказов скоро появится"); },
          function () { toast("Telegram для заказов скоро появится"); }
        );
      }
    });

    var searchTimer;
    $("[data-search]").addEventListener("input", function (e) {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(function () {
        state.query = e.target.value;
        renderGrid();
      }, 120);
    });

    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      if (modal.classList.contains("is-open")) closeLayer(modal);
      else if (drawer.classList.contains("is-open")) closeCart();
    });

    var header = $(".header");
    var onScroll = function () { header.classList.toggle("is-scrolled", window.scrollY > 8); };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    // корзина в другой вкладке
    window.addEventListener("storage", function (e) {
      if (e.key !== CART_KEY) return;
      cart = loadCart();
      updateCartUI();
      renderGrid();
    });
  }

  /* ---------- Запуск ---------- */
  fillTexts();
  renderHeroCards();
  renderFilters();
  renderGrid();
  renderContacts();
  updateCartUI();
  bindEvents();
  setupTilt();
  $$("body > main .reveal, .hero .reveal").forEach(observe);
})();
