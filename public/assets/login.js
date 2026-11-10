import { api } from "./platform.js";

const form = document.querySelector("#login-form");
const button = form.querySelector("button");
const status = document.querySelector("#login-status");
api("/api/config").then(({ demo }) => {
  document.querySelector("#login-demo").hidden = !demo;
}).catch(() => {});
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  status.textContent = "";
  button.disabled = true;
  try {
    await api("/api/login", Object.fromEntries(new FormData(form)));
    const next = new URLSearchParams(location.search).get("next");
    location.assign(/^\/(operations|ops-[a-z]+)\.html$/.test(next) ? next : "/operations.html");
  } catch (error) {
    status.textContent = error.message;
    button.disabled = false;
  }
});
button.disabled = false;
