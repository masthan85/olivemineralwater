import { api } from "./platform.js";

const form = document.querySelector("#intake");
const button = form.querySelector('button[type="submit"]');
const status = document.querySelector("#intake-status");
const requestKey = crypto.randomUUID();
const bottle = form.querySelector("[name=bottle]");
const email = form.elements.namedItem("email");
const previous = new URLSearchParams(location.hash.slice(1)).get("reorder");
let signedIn = false;
if (bottle) {
  const slug = new URLSearchParams(location.search).get("bottle");
  const option = [...bottle.options].find((entry) => entry.dataset.slug === slug && slug);
  if (option) bottle.value = option.value;
}
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  button.disabled = true;
  status.textContent = "Sending your request…";
  try {
    const fields = [...new FormData(form), ["requestKey", requestKey], ["expectAccount", signedIn ? "1" : "0"]];
    const { reference, savedToAccount } = await api("/api/requests", { fields });
    const code = document.createElement("strong");
    code.textContent = reference;
    const track = document.createElement("a");
    track.href = savedToAccount ? "/account.html" : "/track.html";
    track.textContent = savedToAccount ? "View in My Account" : "Track your request";
    status.replaceChildren("Request received. Your tracking reference is ", code, " · ", track);
    form.reset();
    form.querySelectorAll("input, select, textarea").forEach((control) => { control.disabled = true; });
  } catch (error) {
    status.textContent = error.message;
    button.disabled = false;
  }
});

async function prepare() {
  try {
    const data = await api(previous ? "/api/customer" : "/api/customer-profile");
    if (data.account) {
      signedIn = true;
      email.value = data.account.email;
      email.readOnly = true;
    }
    if (!previous) return;
    const draft = data.orders?.find((item) => item.reference === previous)?.reorder;
    if (!draft) {
      status.textContent = "Sign in to the account that placed this order to reuse its details.";
      return;
    }
    for (const field of ["name", "address", "postcode", "bottle", "quantity", "notes"]) {
      const control = form.elements.namedItem(field);
      if (control) control.value = draft[field] ?? "";
    }
    status.textContent = "Previous order details are filled in. Review them before sending a new request.";
  } catch (error) {
    status.textContent = error.message;
  } finally {
    button.disabled = false;
  }
}
prepare();
