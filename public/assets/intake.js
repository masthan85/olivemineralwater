import { api } from "./platform.js";

const form = document.querySelector("#intake");
const button = form.querySelector('button[type="submit"]');
const status = document.querySelector("#intake-status");
const requestKey = crypto.randomUUID();
const bottle = form.querySelector("[name=bottle]");
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
    const fields = [...new FormData(form), ["requestKey", requestKey]];
    const { reference } = await api("/api/requests", { fields });
    const code = document.createElement("strong");
    code.textContent = reference;
    const track = document.createElement("a");
    track.href = "/track.html";
    track.textContent = "Track your request";
    status.replaceChildren("Request received. Save this reference and use it with your delivery postcode. ", code, " · ", track);
    form.reset();
    form.querySelectorAll("input, select, textarea").forEach((control) => { control.disabled = true; });
  } catch (error) {
    status.textContent = error.message;
    button.disabled = false;
  }
});
button.disabled = false;
