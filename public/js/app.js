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
    next: '<svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5M11 8v6M8 11h6"/></svg>',
    check: '<svg viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
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

  function requestCardHTML(i) {
    return '<a class="card card--request reveal" href="#request" style="--d:' + (Math.min(i, 7) * 0.06).toFixed(2) + 's">' +
      '<span class="card--request__icon" aria-hidden="true">' + ICONS.search + "</span>" +
      '<span class="card--request__text"><span class="card--request__title">Не нашли нужное?</span>' +
      '<span class="card--request__sub">Найдём под заказ: опишите вещь, и мы ответим в Telegram.</span></span>' +
      '<span class="btn btn--ghost card--request__btn">Оставить заявку' + ICONS.next + "</span></a>";
  }

  function renderGrid() {
    var list = visibleProducts();
    grid.innerHTML = list.map(cardHTML).join("") + (list.length ? requestCardHTML(list.length) : "");
    $("[data-empty]").hidden = list.length > 0;
    $("[data-empty-query]").textContent = state.query.trim() || "вещь";
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

  // одна и та же карточка может быть и на Главной, и в Каталоге
  function updateCardAction(id) {
    $$('.card[data-id="' + cssEscape(id) + '"]').forEach(function (card) {
      $(".card__action", card).innerHTML = actionHTML(byId[id]);
    });
  }

  /* ---------- Главная: хиты и новинки ---------- */
  var featuredEl = $("[data-featured]");

  function renderFeatured() {
    var picks = products.filter(function (p) { return !p.soldOut && p.badge; })
      .concat(products.filter(function (p) { return !p.soldOut && !p.badge; }))
      .slice(0, 4);
    featuredEl.innerHTML = picks.map(cardHTML).join("");
    $$("img", featuredEl).forEach(attachImgFallback);
    $$(".reveal", featuredEl).forEach(observe);
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
  var modal = $("[data-modal]");
  var success = $("[data-success]");
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
    $$("[data-cart-count]").forEach(function (el) {
      el.textContent = count;
      el.classList.toggle("is-empty", count === 0);
    });
    var ids = Object.keys(cart);
    $("[data-cart-empty]").hidden = ids.length > 0;
    $("[data-cart-foot]").hidden = ids.length === 0;
    $("[data-cart-items]").hidden = ids.length === 0;
    $("[data-cart-total]").textContent = money(cartTotal());
    $("[data-cart-summary]").textContent = count ? plural(count, "товар", "товара", "товаров") : "";

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

  function plural(n, one, few, many) {
    var m10 = n % 10, m100 = n % 100;
    var word = m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? few : many;
    return n + " " + word;
  }

  function isShown(el) { return !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden"; }

  // куда «летит» товар: значок корзины во вкладках (телефон) или кнопка в шапке
  function cartTarget() {
    var tab = $('.tabbar [data-tab="cart"] .tabbar__icon');
    return isShown(tab) ? tab : $(".cart-btn");
  }

  function bumpCart() {
    var btn = cartTarget();
    if (!btn) return;
    btn.classList.remove("is-bump");
    void btn.offsetWidth;
    btn.classList.add("is-bump");
  }

  function flyToCart(fromEl) {
    if (reduceMotion || !fromEl || !fromEl.animate || !cartTarget()) { bumpCart(); return; }
    var from = fromEl.getBoundingClientRect();
    var to = cartTarget().getBoundingClientRect();
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
    haptic("light");
    toast("«" + byId[id].name + "» в корзине");
  }

  function anyLayerOpen() {
    return modal.classList.contains("is-open") || success.classList.contains("is-open");
  }

  function openLayer(el) {
    lastFocus = document.activeElement;
    el.classList.add("is-open");
    el.setAttribute("aria-hidden", "false");
    document.body.classList.add("is-locked");
    var focusTarget = $("[data-close], [data-success-close]", el);
    if (focusTarget) setTimeout(function () { focusTarget.focus({ preventScroll: true }); }, 60);
    syncBackButton();
  }

  function closeLayer(el) {
    el.classList.remove("is-open");
    el.setAttribute("aria-hidden", "true");
    if (!anyLayerOpen()) document.body.classList.remove("is-locked");
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
    syncBackButton();
  }

  function openCart() {
    if (modal.classList.contains("is-open")) closeLayer(modal);
    go("cart");
  }

  /* ---------- Экраны (вкладки) ----------
     Главная · Каталог · Заявка · Корзина · Контакты.
     На сайте экран хранится в адресе (#catalog и т. д.), поэтому работает кнопка «Назад»
     браузера. В Telegram адрес не трогаем: там в нём параметры запуска мини-аппа. */
  var SCREENS = ["home", "catalog", "request", "cart", "contacts"];
  var ALIASES = { "": "home", top: "home", how: "home", featured: "home" };
  var screenEls = {};
  $$("[data-screen]").forEach(function (el) { screenEls[el.getAttribute("data-screen")] = el; });
  var tabbar = $("[data-tabbar]");
  var currentScreen = null;
  var scrollMemo = {};
  var useHash = !window.__PYEXDG_TG;

  function screenOf(target) {
    var name = Object.prototype.hasOwnProperty.call(ALIASES, target) ? ALIASES[target] : target;
    return SCREENS.indexOf(name) === -1 ? "home" : name;
  }

  function screenFromHash() { return screenOf(location.hash.replace(/^#/, "")); }

  function scrollToY(y, smooth) {
    window.scrollTo({ top: y, behavior: smooth && !reduceMotion ? "smooth" : "auto" });
  }

  function showScreen(name, opts) {
    opts = opts || {};
    name = screenOf(name);
    if (name === currentScreen && !opts.force) {
      // повторное нажатие на текущую вкладку: наверх или к нужному блоку
      if (opts.anchor) $("#" + opts.anchor).scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
      else scrollToY(0, true);
      return;
    }
    if (currentScreen) scrollMemo[currentScreen] = window.scrollY;
    SCREENS.forEach(function (key) {
      var el = screenEls[key];
      if (!el) return;
      var on = key === name;
      el.hidden = !on;
      el.classList.toggle("is-active", on);
    });
    currentScreen = name;
    document.documentElement.setAttribute("data-active-screen", name);
    $$("[data-tab]").forEach(function (a) {
      var on = a.getAttribute("data-tab") === name;
      a.classList.toggle("is-active", on);
      if (on) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    if (tabbar) tabbar.style.setProperty("--tab-index", SCREENS.indexOf(name));
    if (opts.anchor) $("#" + opts.anchor).scrollIntoView({ behavior: "auto" });
    else scrollToY(opts.restore ? scrollMemo[name] || 0 : 0, false);
    syncBackButton();
  }

  function go(target) {
    var name = screenOf(target);
    var anchor = target === "how" || target === "featured" ? target : null;
    if (useHash && name !== currentScreen) {
      history.pushState({ screen: name }, "", name === "home" ? location.pathname + location.search : "#" + name);
    }
    showScreen(name, { anchor: anchor, restore: !anchor });
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

  /* ---------- Заявка «Под заказ» ---------- */
  var REQUEST_KEY = "pyexdg-request";
  var FIELDS = ["item", "brand", "size", "color", "budget", "name", "link", "details"];
  var form = $("[data-request-form]");

  // namedItem, а не elements[name]: у коллекции есть свой метод item()
  function field(name) { return form.elements.namedItem(name); }

  function renderRequestExamples() {
    var words = (Array.isArray(SHOP.requestExamples) ? SHOP.requestExamples : []).concat(["Другое"]);
    $("[data-request-examples]").innerHTML = words.map(function (w) {
      return '<button class="chip chip--sm" type="button" data-example="' + esc(w) + '">' + esc(w) + "</button>";
    }).join("");
    syncExampleChips();
  }

  function syncExampleChips() {
    var v = field("item").value.trim().toLowerCase();
    $$("[data-example]", form).forEach(function (chip) {
      chip.classList.toggle("is-active", chip.getAttribute("data-example").toLowerCase() === v);
    });
  }

  function requestData() {
    var d = {};
    FIELDS.forEach(function (k) { d[k] = String(field(k).value || "").replace(/\s+$/g, "").replace(/^\s+/g, ""); });
    d.budget = d.budget.replace(/\D/g, "");
    return d;
  }

  function requestText() {
    var d = requestData();
    var lines = ["Здравствуйте! Хочу заказать вещь в магазине " + shopName + ".", ""];
    function add(label, value) { if (value) lines.push(label + ": " + value); }
    add("Что нужно", d.item);
    add("Бренд / модель", d.brand);
    add("Размер", d.size);
    add("Цвет", d.color);
    if (d.budget) lines.push("Бюджет: до " + money(d.budget));
    add("Пример", d.link);
    add("Подробности", d.details);
    add("Имя", d.name);
    return lines.join("\n");
  }

  function saveDraft() {
    try {
      var raw = {};
      FIELDS.forEach(function (k) { raw[k] = field(k).value; });
      localStorage.setItem(REQUEST_KEY, JSON.stringify(raw));
    } catch (e) { /* без черновика тоже работает */ }
  }

  function loadDraft() {
    try {
      var raw = JSON.parse(localStorage.getItem(REQUEST_KEY) || "{}");
      FIELDS.forEach(function (k) { if (typeof raw[k] === "string") field(k).value = raw[k]; });
    } catch (e) { /* пусто */ }
  }

  function setItemError(show) {
    var input = field("item");
    input.closest(".field").classList.toggle("is-invalid", show);
    input.setAttribute("aria-invalid", show ? "true" : "false");
    $('[data-error-for="item"]', form).hidden = !show;
  }

  function validateRequest() {
    var ok = field("item").value.trim().length >= 2;
    setItemError(!ok);
    if (!ok) {
      form.classList.remove("is-shaking");
      void form.offsetWidth;
      form.classList.add("is-shaking");
      field("item").focus();
    }
    return ok;
  }

  function openExternal(url) {
    var a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  var sentTimer;
  function showSent() {
    var btn = $("[data-request-submit]");
    var label = $("span", btn);
    btn.classList.add("is-sent");
    label.textContent = "Открываем Telegram";
    clearTimeout(sentTimer);
    sentTimer = setTimeout(function () {
      btn.classList.remove("is-sent");
      label.textContent = requestLabel();
    }, 2200);
  }

  function requestLabel() { return getTg() ? "Отправить заявку" : "Отправить заявку в Telegram"; }

  function clearRequestForm() {
    FIELDS.forEach(function (k) { if (k !== "name") field(k).value = ""; });
    syncExampleChips();
    saveDraft();
  }

  function sendRequest() {
    if (!validateRequest()) return;
    if (getTg()) { sendRequestViaBot(); return; }
    var text = requestText();
    var user = telegramUsername(contacts.telegram);
    if (!user) {
      copy(text).then(
        function () { toast("Заявка скопирована. Telegram для заказов скоро появится"); },
        function () { toast("Telegram для заказов скоро появится"); }
      );
      return;
    }
    openExternal("https://t.me/" + encodeURIComponent(user) + "?text=" + encodeURIComponent(text));
    showSent();
    toast("Заявка готова: отправьте её в Telegram");
  }

  function requestFromSearch() {
    field("item").value = state.query.trim();
    setItemError(false);
    syncExampleChips();
    saveDraft();
    go("request");
    setTimeout(function () { field("brand").focus({ preventScroll: true }); }, 350);
  }

  function bindRequest() {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      sendRequest();
    });
    form.addEventListener("input", function (e) {
      if (e.target === field("budget")) {
        var digits = e.target.value.replace(/\D/g, "");
        if (digits !== e.target.value) e.target.value = digits;
      }
      if (e.target === field("item")) {
        if (e.target.value.trim().length >= 2) setItemError(false);
        syncExampleChips();
      }
      saveDraft();
    });
    form.addEventListener("animationend", function (e) { if (e.target === form) form.classList.remove("is-shaking"); });
  }

  /* ---------- Telegram Mini App ----------
     Внутри Telegram заказ и заявка уходят прямо боту (/api/order), а бот
     присылает уведомление владельцу и подтверждение покупателю.
     Если функции бота недоступны, открывается чат с готовым текстом, как на сайте. */
  function getTg() {
    var w = window.Telegram && window.Telegram.WebApp;
    return w && w.initData ? w : null;
  }

  function tgCall(fn) {
    var t = getTg();
    if (!t) return;
    try { return fn(t); } catch (e) { /* старая версия Telegram */ }
  }

  function tgAtLeast(t, v) {
    try { return t.isVersionAtLeast(v); } catch (e) { return false; }
  }

  function haptic(kind) {
    tgCall(function (t) {
      if (!t.HapticFeedback || !tgAtLeast(t, "6.1")) return;
      if (kind === "success" || kind === "error") t.HapticFeedback.notificationOccurred(kind);
      else t.HapticFeedback.impactOccurred(kind || "light");
    });
  }

  function syncBackButton() {
    tgCall(function (t) {
      if (!tgAtLeast(t, "6.1")) return;
      if (anyLayerOpen() || (currentScreen && currentScreen !== "home")) t.BackButton.show(); else t.BackButton.hide();
    });
  }

  function onTgBack() {
    if (success.classList.contains("is-open")) closeLayer(success);
    else if (modal.classList.contains("is-open")) closeLayer(modal);
    else go("home");
  }

  function openTelegram(url) {
    var t = getTg();
    if (t && /^https:\/\/t\.me\//i.test(url)) { try { t.openTelegramLink(url); return; } catch (e) { /* ниже */ } }
    if (t && /^https?:\/\//i.test(url)) { try { t.openLink(url); return; } catch (e) { /* ниже */ } }
    openExternal(url);
  }

  // Если бот не ответил: отправить текст обычным сообщением
  function fallbackToChat(text) {
    var user = telegramUsername(contacts.telegram);
    if (user) {
      openTelegram("https://t.me/" + encodeURIComponent(user) + "?text=" + encodeURIComponent(text));
      toast("Не получилось отправить через бота. Открываем чат, отправьте сообщение");
    } else {
      copy(text).then(function () { toast("Не получилось отправить. Текст скопирован"); }, function () { toast("Не получилось отправить"); });
    }
  }

  function askWriteAccess() {
    return new Promise(function (resolve) {
      var t = getTg();
      var data = t && t.initDataUnsafe;
      var u = data && data.user;
      // спрашиваем, только если мини-апп открыт по прямой ссылке и бот ещё не может писать покупателю
      if (!u || u.allows_write_to_pm || !data.chat_type || !tgAtLeast(t, "6.9")) return resolve();
      try { t.requestWriteAccess(function () { resolve(); }); } catch (e) { resolve(); }
    });
  }

  function postToBot(payload) {
    var t = getTg();
    return fetch("/api/order", {
      method: "POST",
      headers: { "content-type": "application/json", "x-telegram-init-data": t.initData },
      body: JSON.stringify(payload),
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (!r.ok || !d.ok) throw new Error(d.error || "HTTP " + r.status);
        return d;
      });
    });
  }

  function setBusy(btn, busy) {
    if (!btn) return;
    btn.classList.toggle("is-loading", busy);
    if (busy) btn.setAttribute("aria-busy", "true"); else btn.removeAttribute("aria-busy");
  }

  function showSuccess(title, text) {
    $("[data-success-title]").textContent = title;
    $("[data-success-text]").textContent = text;
    openLayer(success);
  }

  var sending = false;

  function submitOrderViaBot(btn) {
    var ids = Object.keys(cart);
    if (sending || !ids.length) return;
    sending = true;
    setBusy(btn, true);
    var text = orderText();
    askWriteAccess()
      .then(function () {
        return postToBot({ type: "order", items: ids.map(function (id) { return { id: id, qty: cart[id] }; }) });
      })
      .then(function (res) {
        cart = {};
        saveCart();
        updateCartUI();
        ids.forEach(updateCardAction);
        haptic("success");
        showSuccess("Заказ отправлен!", res.buyerNotified
          ? "Мы получили заказ и прислали подтверждение в чат с ботом. Скоро напишем, чтобы уточнить детали."
          : "Мы получили заказ и скоро напишем вам в Telegram.");
      })
      .catch(function (err) {
        if (window.console) console.warn("Заказ через бота не отправлен:", err);
        haptic("error");
        fallbackToChat(text);
      })
      .then(function () {
        sending = false;
        setBusy(btn, false);
      });
  }

  function sendRequestViaBot() {
    if (sending) return;
    sending = true;
    var btn = $("[data-request-submit]");
    setBusy(btn, true);
    var text = requestText();
    askWriteAccess()
      .then(function () { return postToBot({ type: "request", fields: requestData() }); })
      .then(function (res) {
        clearRequestForm();
        haptic("success");
        showSuccess("Заявка отправлена!", res.buyerNotified
          ? "Мы подберём вещь, посчитаем цену и напишем вам в чат с ботом."
          : "Мы подберём вещь, посчитаем цену и напишем вам в Telegram.");
      })
      .catch(function (err) {
        if (window.console) console.warn("Заявка через бота не отправлена:", err);
        haptic("error");
        fallbackToChat(text);
      })
      .then(function () {
        sending = false;
        setBusy(btn, false);
      });
  }

  var tgReady = false;
  function initTelegram() {
    var t = getTg();
    if (!t || tgReady) return;
    tgReady = true;
    document.documentElement.classList.add("is-tg");
    try { t.ready(); t.expand(); } catch (e) { /* пусто */ }
    tgCall(function (w) { if (tgAtLeast(w, "6.1")) { w.setHeaderColor("#0b0a14"); w.setBackgroundColor("#0b0a14"); } });
    tgCall(function (w) { if (tgAtLeast(w, "7.10")) w.setBottomBarColor("#0b0a14"); });
    tgCall(function (w) { if (tgAtLeast(w, "7.7")) w.disableVerticalSwipes(); });
    tgCall(function (w) { if (tgAtLeast(w, "6.1")) w.BackButton.onClick(onTgBack); });

    $("[data-checkout-label]").textContent = "Оформить заказ";
    $(".cart-note").textContent = "Заказ сразу придёт нам, ответим в этом чате.";
    $("[data-request-submit] span").textContent = requestLabel();
    $(".form__note").textContent = "Заявка сразу придёт нам, ответим в чате с ботом. Фото можно прислать боту следом.";

    var u = t.initDataUnsafe && t.initDataUnsafe.user;
    if (u && u.first_name && !field("name").value) field("name").value = u.first_name;
    syncBackButton();
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
    [grid, featuredEl].forEach(bindTilt);
  }

  function bindTilt(container) {
    container.addEventListener("pointermove", function (e) {
      var card = e.target.closest(".card");
      if (!card) return;
      var r = card.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width;
      var y = (e.clientY - r.top) / r.height;
      if (!card.classList.contains("card--request")) { // широкую карточку не наклоняем
        card.style.setProperty("--ry", ((x - 0.5) * 8).toFixed(2) + "deg");
        card.style.setProperty("--rx", ((0.5 - y) * 8).toFixed(2) + "deg");
      }
      card.style.setProperty("--mx", (x * 100).toFixed(1) + "%");
      card.style.setProperty("--my", (y * 100).toFixed(1) + "%");
    });
    container.addEventListener("pointerout", function (e) {
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
      // В Telegram: заказ уходит боту, а ссылки открываются средствами Telegram
      if (getTg()) {
        var checkoutBtn = e.target.closest("[data-checkout]");
        if (checkoutBtn) { e.preventDefault(); submitOrderViaBot(checkoutBtn); return; }
        var link = e.target.closest("a[href]");
        var href = link ? link.getAttribute("href") : "";
        if (/^https?:\/\//i.test(href)) { e.preventDefault(); openTelegram(href); return; }
      }

      // Внутренние ссылки (#catalog, #cart…) переключают экран
      var inner = e.target.closest('a[href^="#"]');
      if (inner && !inner.hasAttribute("data-checkout") && inner.getAttribute("href").length > 1) {
        e.preventDefault();
        if (modal.classList.contains("is-open")) closeLayer(modal);
        go(inner.getAttribute("href").slice(1));
        return;
      }

      var t = e.target.closest("[data-add],[data-inc],[data-dec],[data-remove],[data-open],[data-cat],[data-open-cart],[data-close],[data-modal-add],[data-copy-order],[data-checkout],[data-example],[data-request-from-search],[data-copy-request],[data-success-close]");
      if (!t) {
        if (e.target === modal) closeLayer(modal);
        else if (e.target === success) closeLayer(success);
        return;
      }

      if (t.hasAttribute("data-success-close")) {
        closeLayer(success);
        go("catalog");
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
      else if (t.hasAttribute("data-close")) closeLayer(modal);
      else if (t.hasAttribute("data-modal-add")) {
        if (modalId) addToCart(modalId, t);
      }
      else if (t.hasAttribute("data-copy-order")) {
        copy(orderText()).then(function () { toast("Заказ скопирован"); }, function () { toast("Не получилось скопировать"); });
      }
      else if (t.hasAttribute("data-example")) {
        var word = t.getAttribute("data-example");
        var input = field("item");
        input.value = word === "Другое" ? "" : word;
        if (word !== "Другое") setItemError(false);
        syncExampleChips();
        saveDraft();
        input.focus({ preventScroll: true });
        if (word === "Другое") t.classList.add("is-active");
      }
      else if (t.hasAttribute("data-request-from-search")) requestFromSearch();
      else if (t.hasAttribute("data-copy-request")) {
        if (validateRequest()) {
          copy(requestText()).then(function () { toast("Текст заявки скопирован"); }, function () { toast("Не получилось скопировать"); });
        }
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
      if (success.classList.contains("is-open")) closeLayer(success);
      else if (modal.classList.contains("is-open")) closeLayer(modal);
    });

    // кнопки «Назад» / «Вперёд» браузера переключают экраны
    window.addEventListener("popstate", function () {
      if (!useHash) return;
      if (modal.classList.contains("is-open")) closeLayer(modal);
      showScreen(screenFromHash(), { restore: true });
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
      renderFeatured();
    });
  }

  /* ---------- Запуск ---------- */
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  fillTexts();
  renderHeroCards();
  renderFeatured();
  renderFilters();
  renderGrid();
  renderContacts();
  loadDraft();
  renderRequestExamples();
  bindRequest();
  updateCartUI();
  bindEvents();
  setupTilt();
  $$("body > main .reveal, .hero .reveal").forEach(observe);
  showScreen(useHash ? screenFromHash() : "home", { force: true });
  initTelegram(); // если SDK Telegram уже загрузился
  window.addEventListener("tg-sdk-ready", initTelegram);
})();
