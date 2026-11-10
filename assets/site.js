const header = document.querySelector(".site-header");
const toggle = document.querySelector(".menu-toggle");
const menu = document.querySelector(".primary-nav");

function setMenu(open) {
  header.classList.toggle("menu-open", open);
  toggle.setAttribute("aria-expanded", String(open));
}

toggle.addEventListener("click", () => setMenu(toggle.getAttribute("aria-expanded") === "false"));
menu.addEventListener("click", (event) => {
  if (event.target.closest("a")) setMenu(false);
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && header.classList.contains("menu-open")) {
    setMenu(false);
    toggle.focus();
  }
});
matchMedia("(max-width: 860px)").addEventListener("change", () => setMenu(false));

if (document.body.classList.contains("home")) {
  const updateHeader = () => header.classList.toggle("is-solid", window.scrollY > 18);
  window.addEventListener("scroll", updateHeader, { passive: true });
  updateHeader();
}

const bottle = document.querySelector("#bottle");
if (bottle) {
  const selected = new URLSearchParams(window.location.search).get("bottle");
  if (Array.from(bottle.options).some((option) => option.value === selected)) {
    bottle.value = selected;
  }
}

const form = document.querySelector("form.request-form");
if (form) {
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const lines = Array.from(new FormData(form), ([label, value]) => {
      const detail = label === "Bottle" ? bottle.selectedOptions[0].textContent : value.trim();
      return detail ? `${label}: ${detail}` : "";
    }).filter(Boolean);
    const subject = encodeURIComponent(form.dataset.subject);
    const body = encodeURIComponent(lines.join("\r\n"));
    window.location.href = `mailto:${form.dataset.email}?subject=${subject}&body=${body}`;
  });
  form.querySelector('button[type="submit"]').disabled = false;
}
