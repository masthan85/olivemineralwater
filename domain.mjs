import { randomBytes, randomUUID } from "node:crypto";
import * as db from "./public/assets/stock.mjs";

export class DomainError extends Error {}
const find = (records, id) => records.find((item) => item.id === id);
const existing = (records, id) => {
  const record = find(records, id);
  if (!record) throw new DomainError("Record not found.");
  return record;
};
const active = (order) => ["Out for delivery", "Delivery exception"].includes(order.status);
const num = (n) => new Intl.NumberFormat("en-GB").format(n);
export const reference = () => randomBytes(16).toString("hex").toUpperCase();
const requireValue = (test, message) => {
  if (!test) throw new DomainError(message);
};
const value = (data, name) => String(data.get(name) ?? "").trim();
const dateFields = new Set(["expected", "delivered", "received", "best", "service"]);
const validDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const needed = (data, name, label = name) => {
  const result = value(data, name);
  requireValue(result, `Enter ${label}.`);
  if (dateFields.has(name)) requireValue(validDate(result), "Enter a valid date.");
  return result;
};
const units = (qty, signed = false) => {
  const result = Number(qty);
  requireValue(Number.isSafeInteger(result) && result !== 0 && (signed || result > 0) && Math.abs(result) <= 1000000, "Enter a whole bottle quantity in the allowed range.");
  return result;
};
const id = () => randomUUID();
const update = (draft, text, area) => {
  db.event(draft, text, area);
  return text;
};

export function newOrder(draft, data) {
  const customer = find(draft.customers, value(data, "customer"));
  requireValue(customer, "Choose a customer.");
  const requestId = value(data, "request");
  const request = requestId ? existing(draft.requests, requestId) : null;
  requireValue(!request || (request.customer === customer.id && !request.orderId && request.status === "Reviewed"), "Choose the customer linked to this reviewed request.");
  const expected = needed(data, "expected", "a delivery date");
  requireValue(expected >= db.localDay(), "Choose today or a later delivery date.");
  const quantities = data.getAll("qty");
  requireValue(quantities.length > 0 && quantities.length <= 40 && quantities.length === data.getAll("lot").length, "Use between one and forty order lines.");
  const lines = new Map();
  data.getAll("lot").forEach((item, index) => lines.set(item, (lines.get(item) || 0) + units(quantities[index])));
  for (const [item, qty] of lines) {
    const batch = find(draft.lots, item);
    requireValue(batch && db.available(draft, batch) >= qty, `Insufficient available stock for ${batch?.code || "this batch"}.`);
    requireValue(batch.best >= expected, `Batch ${batch.code} is past best-before on the scheduled delivery date.`);
  }
  const orderId = `OL-${draft.nextOrder++}`;
  draft.orders.unshift({
    id: orderId, tracking: reference(), customer: customer.id, status: "Ready to dispatch", created: db.localDay(), expected,
    lines: Array.from(lines, ([lot, qty]) => ({ lot, qty })), asset: "", reference: "", dispatched: "", delivered: "", proof: "", exception: "",
    recipient: { name: customer.name, email: request?.email || customer.email, address: request?.address || customer.address, postcode: request?.postcode || customer.postcode },
  });
  if (request) {
    request.orderId = orderId;
    request.status = "Order created";
  }
  return update(draft, `${orderId} created and stock reserved`, "orders");
}

export function progress(draft, data, orderId, action) {
  const saved = existing(draft.orders, orderId);
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
        const batch = existing(draft.lots, line.lot);
        requireValue(!db.blocked(batch) && batch.best >= saved.expected && batch.onHand >= db.reserved(draft, batch), `Batch ${batch.code} is held, expired for this delivery date or short of stock.`);
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
      requireValue(saved.lines.every((line) => {
        const batch = existing(draft.lots, line.lot);
        return !db.blocked(batch) && batch.best >= saved.expected;
      }), "A batch is held or expires before the rescheduled delivery.");
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
}

export function receive(draft, data) {
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
}

export function adjust(draft, data, batchId, receiving) {
  const item = find(draft.lots, batchId);
  requireValue(item, "Batch not found.");
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
}

export function hold(draft, data, batchId, action) {
  const item = find(draft.lots, batchId);
  requireValue(item && item.hold === (action === "release-hold"), "This batch or hold has changed.");
  item.hold = !item.hold;
  const reason = needed(data, "reason", "a hold reason");
  item.holdReason = item.hold ? reason : "";
  return update(draft, `${item.code} ${item.hold ? "placed on hold" : "hold released"} · ${reason}`, "traceability");
}

export function saveAsset(draft, data, assetId) {
  const code = needed(data, "code", "an asset ID").toUpperCase();
  requireValue(!draft.assets.some((item) => item.id !== assetId && item.code === code), "That asset ID is already in use.");
  const type = value(data, "type");
  const status = value(data, "status");
  requireValue(["Vehicle", "Warehouse equipment", "Returnable packaging", "Other"].includes(type), "Choose an asset type.");
  requireValue(["Available", "In use", "In service"].includes(status), "Choose an asset status.");
  requireValue(!value(data, "service") || validDate(value(data, "service")), "Enter a valid service date.");
  requireValue(type === "Vehicle" || !draft.orders.some((item) => item.asset === assetId && assetId), "This asset has delivery history and must remain a vehicle.");
  requireValue(status !== "In service" || !draft.orders.some((item) => item.asset === assetId && assetId && active(item)), "Resolve the active deliveries before marking this vehicle in service.");
  const record = { id: assetId || id(), code, type, status, name: needed(data, "name", "an asset name"), location: needed(data, "location", "a location"), service: value(data, "service"), notes: value(data, "notes") };
  if (assetId) Object.assign(existing(draft.assets, assetId), record);
  else draft.assets.unshift(record);
  return update(draft, `${code} ${assetId ? "updated" : "added"} · ${status}`, "assets");
}

export function saveCustomer(draft, data, customerId) {
  const postcode = needed(data, "postcode", "a postcode").toUpperCase();
  requireValue(/^[A-Z0-9]{5,8}$/.test(db.cleanPostcode(postcode)), "Enter a UK-style delivery postcode.");
  const record = {
    id: customerId || id(), name: needed(data, "name", "a customer name"), type: value(data, "type"),
    email: needed(data, "email", "an email address"), address: needed(data, "address", "a delivery address"), postcode,
  };
  requireValue(["Hospitality", "Retail", "Business", "Household", "Other"].includes(record.type), "Choose an account type.");
  requireValue(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(record.email), "Enter a valid email address.");
  if (customerId) Object.assign(existing(draft.customers, customerId), record);
  else draft.customers.unshift(record);
  return update(draft, `Customer ${customerId ? "updated" : "added"} · ${record.name}`, "customers");
}

export function intake(draft, data, account = null) {
  const kind = needed(data, "kind", "a request type");
  requireValue(["order", "trade"].includes(kind), "Choose a request type.");
  const email = account?.email || needed(data, "email", "an email address").toLowerCase();
  requireValue(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), "Enter a valid email address.");
  const postcode = needed(data, "postcode", "a postcode").toUpperCase();
  requireValue(/^[A-Z0-9]{5,8}$/.test(db.cleanPostcode(postcode)), "Enter a UK-style delivery postcode.");
  const requestKey = needed(data, "requestKey");
  requireValue(/^[a-f0-9-]{36}$/.test(requestKey), "Reload the page and try again.");
  const duplicate = draft.requests.find((request) => request.requestKey === requestKey);
  if (duplicate) {
    requireValue((duplicate.accountId || null) === (account?.user_id || null) &&
      duplicate.email === email && db.cleanPostcode(duplicate.postcode) === db.cleanPostcode(postcode), "Reload the page to submit a new request.");
    return duplicate;
  }
  const bottle = kind === "order" ? needed(data, "bottle", "a bottle") : "";
  const quantity = kind === "order" ? units(needed(data, "quantity", "a quantity")) : 0;
  const notes = kind === "trade" ? needed(data, "notes", "your requirements") : value(data, "notes");
  const request = {
    id: id(), reference: reference(), requestKey, kind, email, postcode, bottle, quantity, notes,
    ...(account ? { accountId: account.user_id } : {}),
    name: needed(data, "name", "a name"), address: needed(data, "address", "a delivery address"),
    business: kind === "trade" ? needed(data, "business", "a business name") : "",
    status: "Received", created: db.localDay(), customer: "", orderId: "",
  };
  draft.requests.unshift(request);
  return request;
}

export function reviewRequest(draft, data, requestId, action) {
  const request = existing(draft.requests, requestId);
  requireValue(request.status === "Received", "Only new requests can be reviewed or closed.");
  if (action === "close-request") {
    request.status = "Closed";
    return update(draft, "Request closed", "requests");
  }
  const customerId = value(data, "customer");
  if (customerId) {
    request.customer = existing(draft.customers, customerId).id;
  } else {
    const customer = {
      id: id(), name: request.business || request.name, type: request.business ? "Business" : "Other",
      email: request.email, address: request.address, postcode: request.postcode,
    };
    draft.customers.unshift(customer);
    request.customer = customer.id;
  }
  request.status = "Reviewed";
  return update(draft, "Request reviewed and linked to a customer", "requests");
}
