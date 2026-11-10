(() => {
  const form = document.querySelector("#tracking-form");
  const result = document.querySelector("#tracking-result");
  const { load, cleanPostcode } = window.OliveOps;
  const dates = new Intl.DateTimeFormat("en-GB", { dateStyle: "long" });
  const messages = {
    "Ready to dispatch": "We’re preparing your order for delivery.",
    "Out for delivery": "Your order is on its way.",
    "Delivery exception": "There’s been a delay. Contact OLIVE for an update.",
    Delivered: "Your order has been delivered.",
    Cancelled: "This order was cancelled. Contact OLIVE if you have a question.",
  };
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const fields = new FormData(form);
    const reference = fields.get("reference").trim().toUpperCase();
    const postcode = cleanPostcode(fields.get("postcode"));
    const order = load().orders.find((record) => record.id === reference && cleanPostcode(record.recipient.postcode) === postcode);
    const title = document.createElement("h2");
    const detail = document.createElement("p");
    title.textContent = order ? order.status : "Order not found";
    detail.textContent = order ? messages[order.status] : "Check the order reference and delivery postcode, then try again.";
    result.replaceChildren(title, detail);
    const day = order?.delivered || (order && !["Cancelled", "Delivery exception"].includes(order.status) ? order.expected : "");
    if (day) {
      const date = document.createElement("p");
      date.textContent = (order.delivered ? "Delivered on " : "Scheduled for ") + dates.format(new Date(day + "T12:00:00"));
      result.append(date);
    }
  });
})();
