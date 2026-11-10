import { api } from "./platform.js";
import { localDay } from "./stock.mjs";

const status = document.querySelector("#account-status");
const signin = document.querySelector("#account-signin");
const history = document.querySelector("#account-history");
const details = document.querySelector("#account-details");
const orders = document.querySelector("#account-orders");
const period = document.querySelector("#account-period");
const claimForm = document.querySelector("#account-claim");
let savedOrders = [];
const dates = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "Europe/London" });
const day = (value) => dates.format(new Date(value + "T12:00:00Z"));
const element = (tag, text, css) => {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (css) node.className = css;
  return node;
};

function orderCard(order) {
  const card = element("article", null, "account-order");
  const name = order.number || (order.kind === "trade" ? "Trade enquiry" : "Order request");
  card.append(element("h3", name), element("p", `${order.status} · ${day(order.created)}`, "account-meta"));
  if (order.delivered) card.append(element("p", `Delivered ${day(order.delivered)}`, "account-meta"));
  else if (order.scheduled && !["Cancelled", "Delivery exception"].includes(order.status)) {
    card.append(element("p", `Scheduled for ${day(order.scheduled)}`, "account-meta"));
  }
  if (order.lines.length) {
    const list = element("ul");
    list.append(...order.lines.map((line) => element("li", `${line.quantity} × ${line.bottle}`)));
    card.append(list);
  }
  const actions = element("div", null, "account-actions");
  if (order.reorder) {
    const reorder = element("a", "Reorder", "button button--green");
    reorder.href = "order.html#reorder=" + encodeURIComponent(order.reference);
    actions.append(reorder);
  }
  if (order.canCancel) {
    const cancel = element("button", "Cancel order", "button");
    cancel.type = "button";
    cancel.addEventListener("click", async () => {
      if (!window.confirm("Cancel this order or request?")) return;
      cancel.disabled = true;
      try {
        await api("/api/customer-cancel", { reference: order.reference });
        await refresh();
        status.textContent = "Your order or request has been cancelled.";
      } catch (error) {
        status.textContent = error.message;
        cancel.disabled = false;
      }
    });
    actions.append(cancel);
  }
  card.append(actions);
  return card;
}

function renderOrders() {
  const days = Number(period.value);
  const list = days ? savedOrders.filter((order) => order.created >= localDay(1 - days)) : savedOrders;
  const placed = list.filter((order) => order.number).length;
  const requests = list.filter((order) => !order.number && order.kind === "order").length;
  document.querySelector("#account-count").textContent = `${placed} ${placed === 1 ? "order" : "orders"} · ${requests} ${requests === 1 ? "order request" : "order requests"}`;
  orders.replaceChildren(...(list.length ? list.map(orderCard) : [element("p", "There are no orders or requests in this period.")]));
}
period.addEventListener("change", renderOrders);

async function refresh() {
  const data = await api("/api/customer");
  signin.hidden = Boolean(data.account);
  history.hidden = details.hidden = !data.account;
  document.querySelector(".account-main").classList.toggle("account-main--signin", !data.account);
  if (!data.account) {
    savedOrders = [];
    orders.replaceChildren();
    document.querySelector("#account-email").textContent = "";
    document.querySelectorAll("[data-provider]").forEach((link) => { link.hidden = !data.providers.includes(link.dataset.provider); });
    const available = data.providers.length > 0;
    for (const id of ["#signin-options", "#signin-intro", "#signin-note"]) document.querySelector(id).hidden = !available;
    if (!available) status.textContent = "Online account sign-in is unavailable right now. Guest order tracking is available.";
    return;
  }
  document.querySelector("#account-email").textContent = data.account.email;
  savedOrders = data.orders;
  renderOrders();
}

claimForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = claimForm.querySelector("button");
  button.disabled = true;
  try {
    await api("/api/customer-claim", Object.fromEntries(new FormData(claimForm)));
    claimForm.reset();
    await refresh();
    status.textContent = "The order is now linked to your account.";
  } catch (error) {
    status.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

document.querySelector("#account-signout").addEventListener("click", async () => {
  try {
    await api("/api/customer-logout", {});
    await refresh();
    status.textContent = "You’re signed out.";
  } catch (error) {
    status.textContent = error.message;
  }
});

const signIn = new URLSearchParams(location.search).get("signin");
if (signIn) {
  status.textContent = signIn === "failed" ? "Sign-in didn’t finish. Try again using the same browser." : "That sign-in option is unavailable.";
  window.history.replaceState(null, "", location.pathname);
}
refresh().catch((error) => { status.textContent = error.message; });
window.addEventListener("pageshow", (event) => {
  if (event.persisted) refresh().catch((error) => { status.textContent = error.message; });
});
