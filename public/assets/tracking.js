import { api } from "./platform.js";

const form = document.querySelector("#tracking-form");
const result = document.querySelector("#tracking-result");
const button = form.querySelector("button");
const dates = new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "Europe/London" });
const messages = {
  Received: "We’ve received your request and will review it.",
  Reviewed: "Your request is being processed by the OLIVE team.",
  Closed: "This request was closed. Contact OLIVE if you have a question.",
  "Ready to dispatch": "We’re preparing your order for delivery.",
  "Out for delivery": "Your order is on its way.",
  "Delivery exception": "There’s been a delay. Contact OLIVE for an update.",
  Delivered: "Your order has been delivered.",
  Cancelled: "This order was cancelled. Contact OLIVE if you have a question.",
};
const line = (tag, text) => {
  const element = document.createElement(tag);
  element.textContent = text;
  return element;
};
api("/api/config").then(({ demo }) => {
  document.querySelector("#track-demo").hidden = !demo;
}).catch(() => {});
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  button.disabled = true;
  result.textContent = "Looking up your reference…";
  try {
    const { status, scheduled, delivered } = await api("/api/tracking", Object.fromEntries(new FormData(form)));
    result.replaceChildren(line("h2", status), line("p", messages[status]));
    const day = delivered || (!["Cancelled", "Delivery exception"].includes(status) && scheduled);
    if (day) result.append(line("p", (delivered ? "Delivered on " : "Scheduled for ") + dates.format(new Date(day + "T12:00:00Z"))));
  } catch (error) {
    result.textContent = error.status === 404 ? "Check the reference and delivery postcode, then try again." : error.message;
  } finally {
    button.disabled = false;
  }
});
button.disabled = false;
