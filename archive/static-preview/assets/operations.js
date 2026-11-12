(() => {
  const db = window.OliveOps;
  const page = document.body.dataset.page;
  const content = document.querySelector("#ops-content");
  const dialog = document.querySelector("#editor");
  const notice = document.querySelector("#ops-notice");
  const menu = document.querySelector(".ops-menu");
  const nav = document.querySelector("#ops-nav");
  const format = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" });
  const number = new Intl.NumberFormat("en-GB");
  let state = db.load();
  let toast;

  const paths = {
    overview: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',
    orders: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2M9 10h6m-6 4h6m-6 4h4"/>',
    warehouse: '<path d="M3 21V9l9-6 9 6v12M7 21V11h10v10M7 15h10m-10 3h10"/>',
    deliveries: '<path d="M2 5h13v13H2zM15 9h4l3 4v5h-7"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="19" r="2"/>',
    traceability: '<path d="M4 4h16v16H4zM8 8v8m4-8v8m4-8v8"/>',
    assets: '<path d="M4 7h16v14H4zM8 7V4h8v3M4 12h16m-10 0v3h4v-3"/>',
    customers: '<circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3m3-17a3 3 0 0 1 0 6m4 11v-3a6 6 0 0 0-4-5"/>',
    reports: '<path d="M3 3v18h18M8 17v-5m5 5V7m5 10V4"/>',
    site: '<path d="M13 3h8v8m0-8L10 14m11 1v6H3V3h6"/>',
  };
  const icon = (name) => `<svg class="ops-icon" viewBox="0 0 24 24" aria-hidden="true">${paths[name]}</svg>`;
  nav.querySelectorAll("[data-icon]").forEach((link) => link.insertAdjacentHTML("afterbegin", icon(link.dataset.icon)));
  menu.addEventListener("click", () => menu.setAttribute("aria-expanded", String(nav.classList.toggle("open"))));
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]);
  const day = (value) => value ? format.format(new Date(value + "T12:00:00")) : "—";
  const num = (value) => number.format(value);
  const find = (records, id) => records.find((item) => item.id === id);
  const product = (sku) => state.products.find((item) => item[0] === sku)?.[1] || sku;
  const asset = (id) => find(state.assets, id);
  const lot = (id) => find(state.lots, id);
  const quantity = (order) => order.lines.reduce((total, line) => total + line.qty, 0);
  const route = (name) => name === "overview" ? "operations.html" : `ops-${name}.html`;
  const detail = (text) => `<small class="ops-cell-detail">${esc(text)}</small>`;
  const pill = (value) => {
    const style = ["On hold", "Delivery exception", "Expired", "Cancelled"].includes(value) ? "bad"
      : ["Ready to dispatch", "Low stock", "In service", "Service due"].includes(value) ? "warn"
      : value === "In use" ? "neutral" : "";
    return `<span class="ops-pill ${style}">${esc(value)}</span>`;
  };
  const button = (action, text, id = "", style = "") =>
    `<button type="button" class="ops-button ${style}" data-action="${action}" data-id="${esc(id)}">${esc(text)}</button>`;
  const link = (href, text) => `<a class="ops-button" href="${href}">${text}</a>`;
  const heading = (tag, title, subtitle, actions = "", hero = false) =>
    `<section class="ops-intro ${hero ? "ops-hero" : ""}"><div><p class="ops-eyebrow">${tag}</p><h1>${title}</h1><p>${subtitle}</p></div><div class="ops-actions">${actions}</div></section>`;
  const panel = (title, body, action = "", subtitle = "") =>
    `<section class="ops-panel"><header class="ops-panel-title"><div><h2>${title}</h2>${subtitle ? `<p>${subtitle}</p>` : ""}</div>${action}</header>${body}</section>`;
  const body = (html) => `<div class="ops-panel-body">${html}</div>`;
  const list = (items, empty) => items.length ? `<ul class="ops-list">${items.map((item) => `<li>${item}</li>`).join("")}</ul>` : `<p>${empty}</p>`;
  const table = (columns, rows, empty = "No records yet.") =>
    `<div class="ops-table-wrap" role="region" aria-label="${esc(columns[0])} records" tabindex="0"><table class="ops-table" role="table"><thead role="rowgroup"><tr role="row">${columns.map((name) => `<th scope="col" role="columnheader">${name}</th>`).join("")}</tr></thead><tbody role="rowgroup">${rows.map(({ cells, search = "", status = "" }) =>
      `<tr role="row" data-search="${esc(search.toLowerCase())}" data-status="${esc(status)}">${cells.map((cell, index) => `<td role="cell"><span class="mobile-label" aria-hidden="true">${columns[index]}</span><div>${cell}</div></td>`).join("")}</tr>`).join("")}<tr class="empty-row" role="row"${rows.length ? " hidden" : ""}><td class="empty-cell" role="cell" colspan="${columns.length}">${esc(rows.length ? "No records match your search." : empty)}</td></tr></tbody></table></div>`;
  const options = (items, selected = "") => items.map(([value, label]) =>
    `<option value="${esc(value)}"${String(value) === String(selected) ? " selected" : ""}>${esc(label)}</option>`).join("");
  const select = (name, items, selected, attrs = "") => `<select name="${name}" ${attrs}>${options(items, selected)}</select>`;
  let fieldNumber = 0;
  const field = (label, control, wide = false) => {
    const id = `ops-field-${++fieldNumber}`;
    return `<div class="editor-field${wide ? " wide" : ""}"><label for="${id}">${label}</label>${control.replace(/^<\w+/, (tag) => `${tag} id="${id}"`)}</div>`;
  };
  const input = (name, value = "", type = "text", attrs = "required maxlength=100") =>
    `<input name="${name}" value="${esc(value)}" type="${type}" ${attrs}>`;
  const search = (label, placeholder, statuses = []) =>
    `<div class="ops-toolbar"><label>${label}<input id="ops-search" type="search" placeholder="${placeholder}"></label>${statuses.length ?
      `<label>Status${select("filter", [["", "All statuses"], ...statuses.map((s) => [s, s])])}</label>` : ""}</div>`;
  const orderStates = ["Ready to dispatch", "Out for delivery", "Delivery exception", "Delivered", "Cancelled"];
  const lotState = (item) => item.hold ? "On hold" : db.blocked(item) ? "Expired" : db.available(state, item) < 50 ? "Low stock" : "Available";
  const active = (order) => ["Out for delivery", "Delivery exception"].includes(order.status);
  const dueAssets = () => state.assets.filter((item) => item.service && item.service <= db.localDay(14));
  const bestSoon = () => state.lots.filter((item) => item.onHand > 0 && !db.blocked(item) && item.best <= db.localDay(30));

  function orderRows(orders, deliveries = false) {
    return orders.map((order) => ({
      search: [order.id, order.recipient.name, order.recipient.postcode, order.reference, asset(order.asset)?.code].join(" "),
      status: order.status,
      cells: [
        esc(order.id) + (deliveries && order.reference ? detail(order.reference) : ""),
        esc(order.recipient.name) + detail(order.recipient.postcode),
        deliveries ? esc(asset(order.asset)?.code || "Unassigned") : num(quantity(order)),
        day(order.expected),
        pill(order.status),
        button("order", "View", order.id, "compact"),
      ],
    }));
  }

  function overview() {
    const recent = state.orders.slice(0, 5);
    const ready = state.orders.filter((item) => item.status === "Ready to dispatch").length;
    const deliveries = state.orders.filter(active).length;
    const alerts = [
      ...state.lots.filter((item) => item.hold && item.onHand).map((item) => [`ops-traceability.html?lot=${encodeURIComponent(item.id)}`, item.code + " on hold", item.holdReason]),
      ...state.lots.filter((item) => item.onHand && !item.hold && db.blocked(item)).map((item) => ["ops-warehouse.html", item.code + " is past best-before", product(item.sku)]),
      ...bestSoon().map((item) => ["ops-warehouse.html", item.code + " nearing best-before", day(item.best)]),
      ...state.lots.filter((item) => lotState(item) === "Low stock").map((item) => ["ops-warehouse.html", product(item.sku) + " low stock", num(db.available(state, item)) + " bottles available"]),
      ...dueAssets().map((item) => ["ops-assets.html", item.code + " service due", day(item.service)]),
      ...state.orders.filter((item) => item.status === "Delivery exception").map((item) => ["ops-deliveries.html", item.id + " delivery exception", item.exception]),
    ];
    const kpis = [
      ["orders", ready, "Orders ready to dispatch"],
      ["deliveries", deliveries, "Active deliveries"],
      ["warehouse", state.lots.reduce((sum, item) => sum + db.available(state, item), 0), "Bottles available"],
      ["customers", state.customers.length, "Customer records"],
    ];
    return heading("Distribution workspace", "Operations overview", "Manage OLIVE orders, stock and deliveries from one place.", button("new-order", "+ New order", "", "primary") + link(route("warehouse"), "View warehouse"), true) +
      `<div class="ops-kpis">${kpis.map(([key, value, label]) => `<a class="ops-kpi" href="${route(key)}">${icon(key)}<strong>${num(value)}</strong><span>${label}</span></a>`).join("")}</div>` +
      '<div class="ops-grid"><div>' +
      panel("Order activity", table(["Order", "Customer", "Bottles", "Scheduled", "Status", "Details"], orderRows(recent)), link(route("orders"), "All orders")) +
      panel("Recent updates", body(list(state.events.slice(0, 5).map((item) => `<a href="${route(item.page)}">${esc(item.text)}</a>${detail(day(item.date))}`), "No updates yet."))) +
      '</div>' + panel("Needs attention", body(list(alerts.map(([href, label, description]) => `<a href="${href}"><strong>${esc(label)}</strong></a>${detail(description)}`), "No exceptions to review.")), "", `${alerts.length} open items`) + '</div>';
  }

  function orders(deliveries = false) {
    const rows = deliveries ? state.orders.filter((order) => order.status !== "Cancelled").sort((a, b) => b.expected.localeCompare(a.expected)) : state.orders;
    return heading(deliveries ? "Dispatch & transport" : "Sales & fulfilment", deliveries ? "Deliveries" : "Orders",
      deliveries ? "Dispatch reserved orders, record exceptions and log proof of delivery." : "Create orders, reserve stock by batch and follow each order to delivery.",
      deliveries ? link(route("orders"), "View orders") : button("new-order", "+ New order", "", "primary")) +
      search("Search orders", "Order number, customer or postcode", orderStates) +
      panel(deliveries ? "Delivery register" : "Order register",
        table(["Order", "Customer", deliveries ? "Vehicle" : "Bottles", "Scheduled", "Status", "Details"], orderRows(rows, deliveries)));
  }

  function warehouse() {
    const rows = state.lots.map((item) => ({
      search: [item.sku, product(item.sku), item.code, item.location, item.supplier].join(" "),
      status: lotState(item),
      cells: [esc(item.code) + detail(item.sku), esc(product(item.sku)), esc(item.location), day(item.best), num(item.onHand),
        num(db.reserved(state, item)), num(db.available(state, item)), pill(lotState(item)), button("stock", "Manage", item.id, "compact")],
    }));
    const moves = state.movements.slice().reverse().slice(0, 10).map((item) => ({
      cells: [esc(lot(item.lot).code), day(item.date), esc(item.kind), esc(item.reference), (item.qty > 0 ? "+" : "") + num(item.qty)],
    }));
    return heading("Inventory control", "Warehouse", "Receive stock, see what’s reserved and record count corrections.", button("receive", "+ Receive stock", "", "primary")) +
      search("Search inventory", "SKU, batch, bay or supplier", ["Available", "Low stock", "On hold", "Expired"]) +
      panel("Batch stock", table(["Batch", "Product", "Bay", "Best before", "On hand", "Reserved", "Available", "Status", "Details"], rows), "", "Bottle counts · Low stock flags batches with fewer than 50 available bottles.") +
      panel("Recent stock movements", table(["Batch", "Date", "Movement", "Reference or reason", "Bottles"], moves));
  }

  function traceability() {
    const current = lot(new URLSearchParams(location.search).get("lot")) || state.lots[0];
    const outbound = state.orders.filter((order) => order.dispatched && order.lines.some((line) => line.lot === current.id));
    const rows = outbound.map((order) => ({
      cells: [esc(order.id), esc(order.recipient.name) + detail(`${order.recipient.address}, ${order.recipient.postcode}`),
        day(order.dispatched), num(order.lines.filter((line) => line.lot === current.id).reduce((sum, line) => sum + line.qty, 0)), pill(order.status)],
    }));
    const choices = state.lots.map((item) => [item.id, `${item.code} · ${product(item.sku)}`]);
    const inbound = state.movements.filter((item) => item.lot === current.id && item.kind === "Receipt").map((item) => ({
      cells: [esc(item.reference), esc(item.supplier || current.supplier) + detail(item.address || current.supplierAddress), day(item.date), num(item.qty)],
    }));
    return heading("Food supply chain", "Batch traceability", "Find the supplier and recipients of a lot, and hold remaining stock when needed.", button("trace-export", "Export batch record", current.id)) +
      `<div class="ops-toolbar"><label>Find a batch${select("trace-lot", choices, current.id)}</label></div>` +
      '<div class="ops-grid">' + panel("Batch record", body(record([
        ["Batch", current.code], ["Product", product(current.sku)], ["SKU", current.sku], ["Warehouse bay", current.location], ["Best before", day(current.best)], ["Bottles on hand", num(current.onHand)],
        ["Supplier", current.supplier], ["Supplier address", current.supplierAddress], ["Received", day(current.received)], ["Goods receipt", current.receipt],
      ])), pill(lotState(current))) +
      panel("Stock hold", body(`<p>${current.hold ? esc(current.holdReason) : "Putting this batch on hold blocks new reservations and dispatch of existing orders."}</p>
        <div class="editor-actions">${button("hold", current.hold ? "Release hold" : "Place on hold", current.id, "primary")}</div>`)) + "</div>" +
      panel("Inbound receipts", table(["Receipt", "Supplier", "Received", "Bottles"], inbound)) +
      panel("Outbound recipients", table(["Order", "Ship-to recipient", "Dispatch date", "Bottles", "Status"], rows, "No stock from this batch has been dispatched."));
  }

  function assets() {
    const rows = state.assets.map((item) => ({
      search: [item.code, item.name, item.type, item.location].join(" "),
      status: item.status,
      cells: [esc(item.code), esc(item.name) + detail(item.type), esc(item.location), day(item.service) +
        (item.service && item.service <= db.localDay(14) ? " " + pill("Service due") : ""), pill(item.status), button("asset", "Edit", item.id, "compact")],
    }));
    return heading("Equipment & fleet", "Assets", "Track vehicles, equipment and returnables by location and service date.", button("asset", "+ Add asset", "", "primary")) +
      search("Search assets", "Asset code, name or location", ["Available", "In use", "In service"]) +
      panel("Asset register", table(["Asset ID", "Asset", "Location", "Service due", "Status", "Details"], rows));
  }

  function customers() {
    const rows = state.customers.map((item) => ({
      search: [item.name, item.type, item.email, item.postcode].join(" "),
      cells: [esc(item.name) + detail(item.email), esc(item.type), esc(item.postcode),
        num(state.orders.filter((order) => order.customer === item.id).length), button("customer", "View", item.id, "compact")],
    }));
    return heading("Customer relationships", "Customers", "Manage trade and retail contacts, delivery addresses and order history.", button("customer", "+ Add customer", "", "primary")) +
      search("Search customers", "Customer, email or postcode") +
      panel("Customer directory", table(["Customer", "Account type", "Postcode", "Orders", "Details"], rows));
  }

  function reports() {
    const cards = [
      ["orders", "Order register", "Order dates, quantities and fulfilment status."],
      ["inventory", "Inventory by batch", "Warehouse bays, stock levels, holds and best-before dates."],
      ["movements", "Stock movements", "Receipts, stock adjustments and dispatches."],
      ["deliveries", "Delivery register", "Run references, dates, assigned vehicles and proof notes."],
      ["assets", "Asset register", "Locations, service dates and equipment status."],
    ];
    return heading("Workspace reporting", "Reports & exports", "Download CSV snapshots of the records in this browser.") +
      `<div class="ops-report-grid">${cards.map(([key, title, description]) =>
        panel(title, body(`<p>${description}</p>`), button("export", "Download CSV", key))).join("")}</div>`;
  }

  const record = (pairs) => `<dl class="ops-detail">${pairs.map(([key, value]) => `<dt>${esc(key)}</dt><dd>${esc(value || "—")}</dd>`).join("")}</dl>`;
  const renderers = { overview, orders: () => orders(), deliveries: () => orders(true), warehouse, traceability, assets, customers, reports };
  const render = () => {
    const query = document.querySelector("#ops-search")?.value || "";
    const filter = document.querySelector('[name="filter"]')?.value || "";
    content.innerHTML = renderers[page]();
    if (document.querySelector("#ops-search")) document.querySelector("#ops-search").value = query;
    if (document.querySelector('[name="filter"]')) document.querySelector('[name="filter"]').value = filter;
    filterRows();
  };
  function filterRows() {
    const searchField = document.querySelector("#ops-search");
    if (!searchField) return;
    const query = searchField.value.trim().toLowerCase();
    const status = document.querySelector('[name="filter"]')?.value;
    const tableBody = content.querySelector("tbody");
    const rows = Array.from(tableBody.querySelectorAll("[data-search]"));
    rows.forEach((row) => { row.hidden = !row.dataset.search.includes(query) || Boolean(status && row.dataset.status !== status); });
    tableBody.querySelector(".empty-row").hidden = rows.some((row) => !row.hidden);
  }

  function tell(message) {
    clearTimeout(toast);
    notice.textContent = message;
    toast = setTimeout(() => { notice.textContent = ""; }, 4200);
  }

  function edit(title, fields, submit, save, more = "") {
    dialog.innerHTML = `<header class="editor-header"><h2 id="editor-title">${title}</h2>${button("close", "Close")}</header>
      <div class="editor-content">${submit ? `<form class="editor-form"><div class="editor-grid">${fields}</div>${more}
        <p class="editor-error" role="alert" hidden></p><div class="ops-actions editor-actions"><button class="ops-button primary" type="submit">${submit}</button>${button("close", "Cancel")}</div>
      </form>` : fields}</div>`;
    if (!dialog.open) dialog.showModal();
    const form = dialog.querySelector("form");
    if (!form) return;
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const error = form.querySelector(".editor-error");
      const saveButton = form.querySelector('[type="submit"]');
      saveButton.disabled = true;
      error.hidden = true;
      try {
        const data = new FormData(form);
        let message;
        state = await db.change((draft) => { message = save(draft, data); });
        dialog.close();
        render();
        tell(message);
      } catch (failure) {
        error.textContent = failure.message || "Could not save the record.";
        error.hidden = false;
      } finally {
        saveButton.disabled = false;
      }
    });
  }

  const requireValue = (test, message) => {
    if (!test) throw new Error(message);
  };
  const value = (data, name) => String(data.get(name) ?? "").trim();
  const needed = (data, name, label = name) => {
    const result = value(data, name);
    requireValue(result, `Enter ${label}.`);
    return result;
  };
  const units = (qty, signed = false) => {
    const result = Number(qty);
    requireValue(Number.isSafeInteger(result) && result !== 0 && (signed || result > 0) && Math.abs(result) <= 1000000, "Enter a whole bottle quantity in the allowed range.");
    return result;
  };
  const id = () => crypto.randomUUID();
  const update = (draft, text, area) => {
    db.event(draft, text, area);
    return text;
  };

  function addOrder() {
    const customers = state.customers.map((item) => [item.id, `${item.name} · ${item.postcode}`]);
    const stock = state.lots.filter((item) => db.available(state, item) > 0).sort((a, b) => a.best.localeCompare(b.best))
      .map((item) => [item.id, `${product(item.sku)} · ${item.code} · ${db.available(state, item)} available`]);
    if (!customers.length || !stock.length) {
      edit("New order", '<p>Add a customer and receive available stock before creating an order.</p>' + link(route("customers"), "Customers") + " " + link(route("warehouse"), "Warehouse"));
      return;
    }
    const line = (removable = false) => `<div class="editor-line">${field("Stock batch", select("lot", [["", "Choose a batch"], ...stock], "", "required"))}
      ${field("Bottles", input("qty", "", "number", "required min=1 max=1000000 step=1"))}${removable ? button("remove-line", "Remove", "", "compact") : ""}</div>`;
    edit("New order", field("Customer", select("customer", [["", "Choose a customer"], ...customers], "", "required")) +
      field("Scheduled delivery", input("expected", db.localDay(1), "date", `required min="${db.localDay()}"`)), "Create and reserve", (draft, data) => {
      const customer = find(draft.customers, value(data, "customer"));
      requireValue(customer, "Choose a customer.");
      const expected = needed(data, "expected", "a delivery date");
      requireValue(expected >= db.localDay(), "Choose today or a later delivery date.");
      const quantities = data.getAll("qty");
      const lines = new Map();
      data.getAll("lot").forEach((item, index) => lines.set(item, (lines.get(item) || 0) + units(quantities[index])));
      for (const [item, qty] of lines) {
        const batch = find(draft.lots, item);
        requireValue(batch && db.available(draft, batch) >= qty, `Insufficient available stock for ${batch?.code || "this batch"}.`);
        requireValue(batch.best >= expected, `Batch ${batch.code} is past best-before on the scheduled delivery date.`);
      }
      const orderId = `OL-${draft.nextOrder++}`;
      draft.orders.unshift({
        id: orderId, customer: customer.id, status: "Ready to dispatch", created: db.localDay(), expected,
        lines: Array.from(lines, ([lot, qty]) => ({ lot, qty })), asset: "", reference: "", dispatched: "", delivered: "", proof: "", exception: "",
        recipient: { name: customer.name, address: customer.address, postcode: customer.postcode },
      });
      return update(draft, `${orderId} created and stock reserved`, "orders");
    }, `<fieldset><legend>Order lines</legend><div id="order-lines">${line()}</div>${button("add-line", "+ Add order line", "", "compact")}</fieldset>`);
    dialog.querySelector('[data-action="add-line"]').addEventListener("click", () => {
      const lines = dialog.querySelector("#order-lines");
      lines.insertAdjacentHTML("beforeend", line(true));
      lines.lastElementChild.querySelector("select").focus();
    });
  }

  function orderDetail(orderId) {
    const order = find(state.orders, orderId);
    const details = record([
      ["Status", order.status], ["Customer", order.recipient.name],
      ["Ship to", `${order.recipient.address}, ${order.recipient.postcode}`],
      ["Created", day(order.created)], ["Scheduled", day(order.expected)], ["Dispatched", day(order.dispatched)],
      ["Delivered", day(order.delivered)], ["Vehicle", asset(order.asset)?.code], ["Run or tracking reference", order.reference],
      ["Proof of delivery", order.proof], ["Latest exception note", order.exception], ["Cancellation reason", order.cancelReason],
    ]);
    const lines = list(order.lines.map((item) => {
      const batch = lot(item.lot);
      return `<a href="ops-traceability.html?lot=${encodeURIComponent(batch.id)}">${esc(batch.code)}</a> · ${esc(product(batch.sku))} · ${num(item.qty)} bottles`;
    }), "");
    const ready = order.status === "Ready to dispatch";
    const actions = ready ? button("dispatch", "Dispatch order", orderId, "primary") + button("cancel", "Cancel order", orderId, "danger")
      : active(order) ? button("delivered", "Record delivery", orderId, "primary") +
        (order.status === "Delivery exception" ? button("retry", "Resume delivery", orderId) : button("exception", "Record exception", orderId)) : "";
    edit(orderId, details + lines + `<div class="ops-actions editor-actions">${actions}</div>`);
  }

  function progress(action, orderId) {
    const order = find(state.orders, orderId);
    const vehicles = state.assets.filter((item) => item.type === "Vehicle" && item.status === "Available").map((item) => [item.id, `${item.code} · ${item.name}`]);
    const configs = {
      dispatch: ["Dispatch order", field("Vehicle", select("vehicle", [["", "Choose a vehicle"], ...vehicles], "", "required")) + field("Run or tracking reference", input("reference")), "Confirm dispatch"],
      cancel: ["Cancel order", field("Reason", input("reason", "", "text", "required maxlength=160"), true), "Cancel and release stock"],
      delivered: ["Record delivery", field("Delivered on", input("delivered", db.localDay(), "date", `required min="${order.dispatched}" max="${db.localDay()}"`)) +
        field("Proof of delivery reference or note", input("proof", "", "text", "required maxlength=160"), true), "Mark delivered"],
      exception: ["Record delivery exception", field("Reason", input("reason", "", "text", "required maxlength=160"), true), "Save exception"],
      retry: ["Resume delivery", field("New scheduled delivery date", input("expected", db.localDay(), "date", `required min="${db.localDay()}"`)) +
        field("Vehicle", select("vehicle", [["", "Choose a vehicle"], ...vehicles], order.asset, "required")) +
        field("Run or tracking reference", input("reference", order.reference), true), "Resume delivery"],
    };
    const [title, fields, submit] = configs[action];
    edit(title, fields, submit, (draft, data) => {
      const saved = find(draft.orders, orderId);
      requireValue(saved.status === order.status, "This order has changed. Reopen it to see its current status.");
      if (action === "cancel") {
        requireValue(saved.status === "Ready to dispatch", "Only orders awaiting dispatch can be cancelled.");
        saved.status = "Cancelled";
        saved.cancelReason = needed(data, "reason", "a cancellation reason");
        return update(draft, `${orderId} cancelled · stock reservation released`, "orders");
      }
      if (action === "dispatch" || action === "retry") {
        const vehicle = find(draft.assets, value(data, "vehicle"));
        requireValue(vehicle?.type === "Vehicle" && vehicle.status === "Available", "Choose an available vehicle.");
        if (action === "dispatch") {
          requireValue(saved.status === "Ready to dispatch", "Only reserved orders can be dispatched.");
          for (const line of saved.lines) {
            const batch = find(draft.lots, line.lot);
            requireValue(!db.blocked(batch) && batch.onHand >= db.reserved(draft, batch), `Batch ${batch.code} is held, expired or short of stock.`);
          }
          for (const line of saved.lines) {
            find(draft.lots, line.lot).onHand -= line.qty;
            draft.movements.push({ lot: line.lot, qty: -line.qty, kind: "Dispatch", reference: orderId, date: db.localDay() });
          }
          saved.dispatched = db.localDay();
        } else {
          requireValue(saved.status === "Delivery exception", "Only an order with an exception can be resumed.");
          saved.expected = needed(data, "expected", "a delivery date");
          requireValue(saved.expected >= db.localDay(), "Choose today or a later delivery date.");
        }
        saved.status = "Out for delivery";
        saved.asset = vehicle.id;
        saved.reference = needed(data, "reference", "a run or tracking reference");
        return update(draft, `${orderId} ${action === "dispatch" ? "dispatched" : "delivery resumed"} · ${saved.reference}`, "deliveries");
      }
      if (action === "exception") {
        requireValue(saved.status === "Out for delivery", "The order must be out for delivery.");
        saved.status = "Delivery exception";
        saved.exception = needed(data, "reason", "an exception reason");
        return update(draft, `${orderId} delivery exception recorded`, "deliveries");
      }
      requireValue(active(saved), "The order must have been dispatched.");
      saved.delivered = needed(data, "delivered", "the delivery date");
      requireValue(saved.delivered >= saved.dispatched && saved.delivered <= db.localDay(), "Use a delivery date from dispatch through today.");
      saved.proof = needed(data, "proof", "proof of delivery");
      saved.status = "Delivered";
      return update(draft, `${orderId} delivered · proof recorded`, "deliveries");
    });
  }

  function receive() {
    edit("Receive stock",
      field("Product", select("sku", [["", "Choose a product"], ...state.products.map(([sku, name]) => [sku, `${sku} · ${name}`])], "", "required")) +
      field("Batch or lot code", input("code", "", "text", "required maxlength=40")) +
      field("Bottles received", input("qty", "", "number", "required min=1 max=1000000 step=1")) +
      field("Warehouse bay", input("location", "", "text", "required maxlength=30")) +
      field("Received on", input("received", db.localDay(), "date", `required max="${db.localDay()}"`)) +
      field("Best before", input("best", "", "date", "required")) +
      field("Supplier name", input("supplier")) + field("Goods receipt reference", input("receipt")) +
      field("Supplier address", input("address", "", "text", "required maxlength=160"), true), "Save receipt", (draft, data) => {
      const sku = needed(data, "sku", "a product");
      const code = needed(data, "code", "a batch code").toUpperCase();
      requireValue(draft.products.some(([key]) => key === sku), "Choose a valid product.");
      requireValue(!draft.lots.some((item) => item.sku === sku && item.code === code), "This product and lot are already registered. Use Manage to adjust or log a repeat receipt.");
      const received = needed(data, "received", "the received date");
      const best = needed(data, "best", "the best-before date");
      requireValue(received <= db.localDay(), "The receipt date cannot be in the future.");
      const item = {
        id: id(), sku, code, onHand: units(value(data, "qty")), received, best, location: needed(data, "location", "a bay"),
        supplier: needed(data, "supplier", "a supplier name"), supplierAddress: needed(data, "address", "a supplier address"),
        receipt: needed(data, "receipt", "a goods receipt reference"), hold: false, holdReason: "",
      };
      draft.lots.unshift(item);
      draft.movements.push({ lot: item.id, qty: item.onHand, kind: "Receipt", reference: item.receipt, date: received, supplier: item.supplier, address: item.supplierAddress });
      return update(draft, `${code} received · ${num(item.onHand)} bottles`, "warehouse");
    });
  }

  function manageStock(batchId) {
    const batch = lot(batchId);
    const actions = link(`ops-traceability.html?lot=${encodeURIComponent(batchId)}`, "Trace batch") +
      button("adjust", "Adjust stock", batchId, "primary") + button("repeat-receipt", "Log another receipt", batchId);
    edit("Manage batch", record([
      ["Batch", batch.code], ["Product", product(batch.sku)], ["Bay", batch.location], ["Best before", day(batch.best)],
      ["On hand", num(batch.onHand)], ["Reserved", num(db.reserved(state, batch))], ["Available", num(db.available(state, batch))],
    ]) + `<div class="ops-actions">${actions}</div>`);
  }

  function adjustStock(batchId, receiving = false) {
    const fields = receiving
      ? field("Bottles received", input("qty", "", "number", "required min=1 max=1000000 step=1")) +
        field("Received on", input("received", db.localDay(), "date", `required max="${db.localDay()}"`)) +
        field("Receipt reference", input("reason"), true)
      : field("Bottle change (negative to remove)", input("qty", "", "number", "required min=-1000000 max=1000000 step=1")) +
        field("Reason", input("reason", "", "text", "required maxlength=160"));
    edit(receiving ? "Log another receipt" : "Adjust stock", fields, receiving ? "Save receipt" : "Save adjustment", (draft, data) => {
      const item = find(draft.lots, batchId);
      const qty = units(value(data, "qty"), !receiving);
      const date = receiving ? needed(data, "received", "a receipt date") : db.localDay();
      requireValue(date <= db.localDay(), "The receipt date cannot be in the future.");
      requireValue(item.onHand + qty >= db.reserved(draft, item), "This change would reduce stock below the reserved quantity.");
      item.onHand += qty;
      draft.movements.push({
        lot: item.id, qty, kind: receiving ? "Receipt" : "Adjustment", reference: needed(data, "reason", receiving ? "a receipt reference" : "an adjustment reason"), date,
        ...(receiving ? { supplier: item.supplier, address: item.supplierAddress } : {}),
      });
      return update(draft, `${item.code} · ${receiving ? "receipt" : "stock adjustment"} recorded`, "warehouse");
    }, receiving ? `<p class="form-note">Use this for the same supplier, bay and best-before date as ${esc(lot(batchId).code)}.</p>` : "");
  }

  function hold(batchId) {
    const current = lot(batchId);
    edit(current.hold ? "Release batch hold" : "Place batch on hold", field("Reason", input("reason", "", "text", "required maxlength=160"), true),
      current.hold ? "Release hold" : "Place on hold", (draft, data) => {
        const item = find(draft.lots, batchId);
        requireValue(item.hold === current.hold, "The hold has already changed. Reopen this batch.");
        item.hold = !item.hold;
        const reason = needed(data, "reason", "a hold reason");
        item.holdReason = item.hold ? reason : "";
        return update(draft, `${item.code} ${item.hold ? "placed on hold" : "hold released"} · ${reason}`, "traceability");
      });
  }

  function editAsset(assetId) {
    const current = asset(assetId) || {};
    const category = ["Vehicle", "Warehouse equipment", "Returnable packaging", "Other"];
    const statuses = ["Available", "In use", "In service"];
    edit(assetId ? "Edit asset" : "Add asset",
      field("Asset ID", input("code", current.code)) + field("Name", input("name", current.name)) +
      field("Asset type", select("type", category.map((item) => [item, item]), current.type)) +
      field("Status", select("status", statuses.map((item) => [item, item]), current.status)) +
      field("Location", input("location", current.location)) +
      field("Next service date (optional)", input("service", current.service, "date", "")) +
      field("Notes (optional)", input("notes", current.notes, "text", "maxlength=160"), true), "Save asset", (draft, data) => {
      const code = needed(data, "code", "an asset ID").toUpperCase();
      requireValue(!draft.assets.some((item) => item.id !== assetId && item.code === code), "That asset ID is already in use.");
      const type = value(data, "type");
      const status = value(data, "status");
      requireValue(type === "Vehicle" || !draft.orders.some((item) => item.asset === assetId && assetId), "This asset has delivery history and must remain a vehicle.");
      requireValue(status !== "In service" || !draft.orders.some((item) => item.asset === assetId && assetId && active(item)), "Resolve the active deliveries before marking this vehicle in service.");
      const record = { id: assetId || id(), code, type, status, name: needed(data, "name", "an asset name"), location: needed(data, "location", "a location"), service: value(data, "service"), notes: value(data, "notes") };
      if (assetId) Object.assign(find(draft.assets, assetId), record);
      else draft.assets.unshift(record);
      return update(draft, `${code} ${assetId ? "updated" : "added"} · ${status}`, "assets");
    });
  }

  function customerDetail(customerId) {
    const customer = find(state.customers, customerId);
    const orders = state.orders.filter((order) => order.customer === customerId);
    edit(esc(customer.name), record([
      ["Account type", customer.type], ["Email", customer.email], ["Address", customer.address], ["Postcode", customer.postcode],
    ]) + '<h3>Order history</h3>' + list(orders.map((order) =>
      `${button("order", order.id, order.id, "compact")} · ${num(quantity(order))} bottles · ${pill(order.status)}`), "This customer has no orders yet.") +
      `<div class="ops-actions editor-actions">${button("edit-customer", "Edit customer", customerId, "primary")}</div>`);
  }

  function editCustomer(customerId) {
    const current = find(state.customers, customerId) || {};
    const types = ["Hospitality", "Retail", "Business", "Household", "Other"];
    edit(customerId ? "Edit customer" : "Add customer",
      field("Customer name", input("name", current.name)) + field("Account type", select("type", types.map((item) => [item, item]), current.type)) +
      field("Email", input("email", current.email, "email", "required maxlength=120")) +
      field("Postcode", input("postcode", current.postcode, "text", "required maxlength=12")) +
      field("Delivery address", input("address", current.address, "text", "required maxlength=160"), true), "Save customer", (draft, data) => {
      const postcode = needed(data, "postcode", "a postcode").toUpperCase();
      requireValue(/^[A-Z0-9]{5,8}$/.test(db.cleanPostcode(postcode)), "Enter a UK-style delivery postcode.");
      const record = {
        id: customerId || id(), name: needed(data, "name", "a customer name"), type: value(data, "type"),
        email: needed(data, "email", "an email address"), address: needed(data, "address", "a delivery address"), postcode,
      };
      if (customerId) Object.assign(find(draft.customers, customerId), record);
      else draft.customers.unshift(record);
      return update(draft, `Customer ${customerId ? "updated" : "added"} · ${record.name}`, "customers");
    });
  }

  function csv(filename, rows) {
    const cell = (item) => {
      let text = String(item ?? "");
      if (typeof item !== "number" && /^\s*[=+@-]/.test(text)) text = "'" + text;
      return '"' + text.replaceAll('"', '""') + '"';
    };
    const file = new Blob(["\uFEFF" + rows.map((row) => row.map(cell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportReport(name) {
    const reports = {
      orders: () => [["Order", "Customer", "Created", "Scheduled", "Bottles", "Status"], ...state.orders.map((item) => [item.id, item.recipient.name, item.created, item.expected, quantity(item), item.status])],
      inventory: () => [["Batch", "SKU", "Bay", "Best before", "On hand", "Reserved", "Available", "Status"], ...state.lots.map((item) => [item.code, item.sku, item.location, item.best, item.onHand, db.reserved(state, item), db.available(state, item), lotState(item)])],
      movements: () => [["Batch", "SKU", "Date", "Movement", "Reference", "Bottles"], ...state.movements.map((item) => [lot(item.lot).code, lot(item.lot).sku, item.date, item.kind, item.reference, item.qty])],
      deliveries: () => [["Order", "Recipient", "Scheduled", "Dispatched", "Delivered", "Vehicle", "Reference", "Status", "Proof", "Latest exception"], ...state.orders.filter((item) => item.status !== "Cancelled").map((item) => [item.id, item.recipient.name, item.expected, item.dispatched, item.delivered, asset(item.asset)?.code, item.reference, item.status, item.proof, item.exception])],
      assets: () => [["Asset ID", "Name", "Type", "Location", "Next service", "Status", "Notes"], ...state.assets.map((item) => [item.code, item.name, item.type, item.location, item.service, item.status, item.notes])],
    };
    csv(`olive-${name}.csv`, reports[name]());
  }

  function exportTrace(batchId) {
    const batch = lot(batchId);
    const inbound = state.movements.filter((move) => move.lot === batch.id && move.kind === "Receipt");
    const outbound = state.orders.filter((order) => order.dispatched).flatMap((order) => order.lines.filter((line) => line.lot === batch.id).map((line) =>
      ["Dispatch", batch.code, batch.sku, order.recipient.name, `${order.recipient.address}, ${order.recipient.postcode}`, order.dispatched, order.id, line.qty, order.status]));
    csv("olive-batch-trace.csv", [["Event", "Batch", "SKU", "Business", "Address", "Date", "Reference", "Bottles", "Status"],
      ...inbound.map((move) => ["Receipt", batch.code, batch.sku, move.supplier || batch.supplier, move.address || batch.supplierAddress, move.date, move.reference, move.qty, "Received"]),
      ...outbound,
      ["Stock on hand", batch.code, batch.sku, "", batch.location, db.localDay(), "", batch.onHand, lotState(batch)],
    ]);
  }

  const actions = {
    "new-order": addOrder, order: orderDetail, receive, stock: manageStock, adjust: (id) => adjustStock(id),
    "repeat-receipt": (id) => adjustStock(id, true), hold, asset: editAsset,
    customer: (id) => id ? customerDetail(id) : editCustomer(id),
    "edit-customer": editCustomer, export: exportReport, "trace-export": exportTrace,
    close: () => dialog.close(),
    "remove-line": (_, trigger) => trigger.closest(".editor-line").remove(),
  };
  ["dispatch", "cancel", "delivered", "exception", "retry"].forEach((action) => { actions[action] = (id) => progress(action, id); });
  document.addEventListener("click", (e) => {
    const trigger = e.target.closest("button[data-action]");
    if (trigger) actions[trigger.dataset.action]?.(trigger.dataset.id, trigger);
  });
  content.addEventListener("input", (e) => { if (e.target.id === "ops-search") filterRows(); });
  content.addEventListener("change", (e) => {
    if (e.target.name === "filter") filterRows();
    if (e.target.name === "trace-lot") {
      const next = new URL(location.href);
      next.searchParams.set("lot", e.target.value);
      history.replaceState(null, "", next);
      render();
      content.querySelector('[name="trace-lot"]').focus();
    }
  });
  window.addEventListener("storage", (e) => {
    if (e.key === db.key) { state = db.load(); render(); }
  });
  render();
})();
