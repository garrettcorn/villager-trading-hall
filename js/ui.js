/* Small DOM helpers: creation, escaping, modals, toasts. */
"use strict";

function esc(str) {
  return String(str == null ? "" : str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function el(tag, attrs, children) {
  const node = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") node.className = v;
      else if (k === "text") node.textContent = v;
      else if (k === "html") node.innerHTML = v;
      else if (k === "dataset") Object.assign(node.dataset, v);
      else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
      else if (v !== false && v != null) node.setAttribute(k, v);
    }
  }
  if (children != null) {
    const list = Array.isArray(children) ? children : [children];
    for (const c of list) {
      if (c == null) continue;
      if (typeof c === "string" || typeof c === "number") node.appendChild(document.createTextNode(String(c)));
      else node.appendChild(c);
    }
  }
  return node;
}

function empty(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

function toast(message, kind) {
  const box = document.getElementById("toasts");
  const item = el("div", { class: "toast" + (kind ? " toast-" + kind : "") }, message);
  box.appendChild(item);
  setTimeout(() => item.classList.add("show"), 10);
  setTimeout(() => {
    item.classList.remove("show");
    setTimeout(() => item.remove(), 300);
  }, 2600);
}

/* ---------- modals ---------- */

let modalEl = null;

function openModal(content) {
  closeModal();
  modalEl = el("div", { class: "modal-backdrop" });
  const sheet = el("div", { class: "modal" });
  if (typeof content === "string") sheet.innerHTML = content;
  else sheet.appendChild(content);
  sheet.addEventListener("click", (e) => e.stopPropagation());
  modalEl.addEventListener("click", closeModal);
  modalEl.appendChild(sheet);
  document.body.appendChild(modalEl);
  const first = sheet.querySelector("input,select,textarea");
  if (first) setTimeout(() => first.focus(), 50);
  return sheet;
}

function closeModal() {
  if (modalEl) {
    modalEl.remove();
    modalEl = null;
  }
}

function confirmDialog(title, message, okLabel) {
  return new Promise((resolve) => {
    const sheet = openModal(
      el(
        "div",
        { class: "confirm" },
        el("h3", { text: title }),
        el("p", { text: message }),
        el("div", { class: "row" },
          el("button", { class: "btn", text: "Cancel", onclick: () => { closeModal(); resolve(false); } }),
          el("button", { class: "btn btn-danger", text: okLabel || "Delete", onclick: () => { closeModal(); resolve(true); } })
        )
      )
    );
    const ok = sheet.querySelector(".btn-danger");
    if (ok) ok.focus();
  });
}

/* ---------- badges ---------- */

function professionBadge(profId) {
  const p = professionById(profId);
  return el("span", { class: "badge badge-prof prof-" + p.id, title: p.jobSite ? "Job site: " + p.jobSite : "" }, p.name);
}

function levelBadge(level) {
  const info = LEVELS[Math.max(0, Math.min(4, (level || 1) - 1))];
  return el("span", { class: "badge badge-level level-" + info.badge }, info.name);
}

function versionBadge(version) {
  return el(
    "span",
    { class: "badge badge-version " + (version === "bedrock" ? "bedrock" : "java") },
    version === "bedrock" ? "Bedrock" : "Java"
  );
}

function curedBadge() {
  return el("span", { class: "badge badge-cured" }, "Cured");
}

function heroBadge(level) {
  if (!level) return null;
  return el("span", { class: "badge badge-hero" }, "Hero " + level);
}
