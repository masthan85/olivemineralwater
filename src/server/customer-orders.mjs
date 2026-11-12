import { DomainError, progress } from "./domain.mjs";
import { cleanPostcode } from "../../public/assets/stock.mjs";

const bottleNames = new Map([
  ["ST-250", "OLIVE Still Water (250ml)"], ["ST-500", "OLIVE Still Water (500ml)"],
  ["ST-1000", "OLIVE Still Water (1 litre)"], ["GL-CL", "Classic Olive (750ml)"],
  ["GL-FR", "Forest Reserve (750ml)"], ["GL-SB", "Sapphire Blue (750ml)"], ["GL-AS", "Aqua Spring (750ml)"],
]);

function item(state, request, order) {
  const status = order?.status || request.status;
  const lines = (order?.lines || []).map((line) => {
    const lot = state.lots.find((batch) => batch.id === line.lot);
    return { bottle: bottleNames.get(lot?.sku) || lot?.sku || "OLIVE bottled water", quantity: line.qty };
  });
  const quantity = lines.reduce((sum, line) => sum + line.quantity, 0) || request?.quantity;
  const products = [...new Set(lines.map((line) => line.bottle))];
  const mixed = products.length > 1;
  const bottle = mixed ? "Mixed sizes or colourways" : products[0] || request?.bottle || "";
  const address = order?.recipient || request;
  return {
    reference: request?.reference || order.tracking,
    number: order?.id || "",
    kind: request?.kind || "order",
    created: request?.created || order.created,
    status,
    scheduled: order?.expected || "",
    delivered: order?.delivered || "",
    lines: lines.length ? lines : request?.bottle ? [{ bottle: request.bottle, quantity }] : [],
    canCancel: ["Received", "Reviewed", "Ready to dispatch"].includes(status),
    reorder: bottle && quantity ? {
      bottle, quantity, name: address.name, address: address.address, postcode: address.postcode,
      notes: mixed ? lines.map((line) => `${line.quantity} × ${line.bottle}`).join("\n").slice(0, 1000) : request?.kind === "order" ? request.notes : "",
    } : null,
  };
}

export function history(state, account) {
  const linked = new Set(state.requests.map((request) => request.orderId).filter(Boolean));
  return [
    ...state.requests.filter((request) => request.accountId === account.user_id)
      .map((request) => item(state, request, state.orders.find((order) => order.id === request.orderId))),
    ...state.orders.filter((order) => order.accountId === account.user_id && !linked.has(order.id))
      .map((order) => item(state, null, order)),
  ].sort((a, b) => b.created.localeCompare(a.created));
}

function locate(state, reference) {
  const request = state.requests.find((item) => item.reference === reference);
  const order = request ? state.orders.find((item) => item.id === request.orderId) : state.orders.find((item) => item.tracking === reference);
  const parent = request || (order && state.requests.find((item) => item.orderId === order.id));
  return { request: parent, order, owner: parent || order };
}

export function claim(state, account, reference, postcode) {
  const { request, order, owner } = locate(state, reference);
  const customer = order && state.customers.find((item) => item.id === order.customer);
  const email = request?.email || order?.recipient.email || customer?.email || "";
  const zip = request?.postcode || order?.recipient.postcode || "";
  if (!owner || (owner.accountId && owner.accountId !== account.user_id) ||
      email.toLowerCase() !== account.email || cleanPostcode(zip) !== cleanPostcode(postcode)) {
    throw new DomainError("We couldn’t link that order. Check the reference and postcode and use the account matching the order email.");
  }
  owner.accountId = account.user_id;
  return { linked: true };
}

export function cancel(state, account, reference) {
  const { request, order, owner } = locate(state, reference);
  if (owner?.accountId !== account.user_id) throw new DomainError("We couldn’t find that order in your account.");
  if (order) {
    progress(state, new URLSearchParams({ reason: "Cancelled by customer before dispatch" }), order.id, "cancel");
  } else if (!["Received", "Reviewed"].includes(request.status)) {
    throw new DomainError("This request can no longer be cancelled online.");
  }
  if (request) request.status = "Cancelled";
  return { cancelled: true };
}
