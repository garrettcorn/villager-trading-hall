/* Villager Trading Hall Tracker - main application. */
"use strict";

(function () {
  const $ = (sel, root) => (root || document).querySelector(sel);

  /* ---------------- routing ---------------- */

  function currentRoute() {
    return window.location.hash.replace(/^#/, "") || "/";
  }

  function navigate(route) {
    if (window.location.hash === "#" + route) render();
    else window.location.hash = route;
  }

  function currentHall() {
    const state = getState();
    if (state.settings.selectedHallId) {
      const h = getHall(state.settings.selectedHallId);
      if (h) return h;
    }
    const halls = allHalls();
    return halls.length ? halls[0] : null;
  }

  function findVillagerGlobal(vId) {
    for (const hall of allHalls()) {
      const v = hall.villagers.find((x) => x.id === vId);
      if (v) return { hall: hall, villager: v };
    }
    return null;
  }

  function render() {
    const route = currentRoute();
    const main = document.getElementById("view");
    empty(main);
    document.querySelectorAll(".nav-tab").forEach((t) => {
      t.classList.toggle("active", t.dataset.route === route.split("/")[1] || (t.dataset.route === "hall" && route === "/"));
    });
    if (route.startsWith("/villager/")) {
      renderVillager(main, route.split("/")[2]);
    } else if (route.startsWith("/books")) {
      renderBooks(main);
    } else if (route.startsWith("/discounts")) {
      renderDiscounts(main);
    } else if (route.startsWith("/data")) {
      renderData(main);
    } else {
      renderHall(main);
    }
    window.scrollTo(0, 0);
  }

  window.addEventListener("hashchange", render);
  window.addEventListener("store:change", render);

  /* ---------------- hall view ---------------- */

  function renderHall(main) {
    const hall = currentHall();

    const controls = el("div", { class: "controls" });

    if (allHalls().length === 0) {
      controls.appendChild(
        el("button", { class: "btn btn-primary", text: "Create your first hall", onclick: newHallModal })
      );
      controls.appendChild(
        el("p", { class: "muted", html: "A trading hall is a group of villagers you want to organize together (each hall can be Java or Bedrock)." })
      );
      main.appendChild(controls);
      main.appendChild(
        el("div", { class: "empty-state" },
          el("h3", { text: "No halls yet" }),
          el("p", { text: "Create a hall, then add villagers and their trades." })
        )
      );
      return;
    }

    const hallSelect = el("select", {
      class: "input",
      onchange: (e) => {
        setSettings({ selectedHallId: e.target.value });
        render();
      },
    });
    for (const h of allHalls()) {
      hallSelect.appendChild(
        el("option", { value: h.id, text: h.name + "  (" + VERSION_LABELS[h.version] + ")" })
      );
    }
    hallSelect.value = hall.id;

    const versionBtn = el("button", {
      class: "btn",
      title: "Switch this hall between Java and Bedrock trade mechanics",
      onclick: () => {
        const next = hall.version === "bedrock" ? "java" : "bedrock";
        updateHall(hall.id, { version: next });
        toast("Hall switched to " + VERSION_LABELS[next]);
      },
    }, "Version: " + VERSION_LABELS[hall.version]);

    const newBtn = el("button", { class: "btn", text: "New Hall", onclick: newHallModal });
    const addBtn = el("button", {
      class: "btn btn-primary",
      text: "Add Villager",
      onclick: () => villagerFormModal(hall.id, null),
    });
    const renameBtn = el("button", {
      class: "btn btn-ghost",
      text: "Rename",
      onclick: () => {
        const name = prompt("Hall name", hall.name);
        if (name && name.trim()) {
          updateHall(hall.id, { name: name.trim() });
          render();
        }
      },
    });
    const delHallBtn = el("button", {
      class: "btn btn-danger-ghost",
      text: "Delete Hall",
      onclick: async () => {
        if (await confirmDialog("Delete hall?", "Delete \u201C" + hall.name + "\u201D and all " + hall.villagers.length + " villagers? This cannot be undone.", "Delete Hall")) {
          deleteHall(hall.id);
          toast("Hall deleted");
        }
      },
    });

    controls.append(
      el("div", { class: "field" }, el("span", { class: "field-label", text: "Hall" }), hallSelect),
      versionBtn,
      addBtn,
      newBtn,
      renameBtn,
      delHallBtn,
      makeHeroControl()
    );

    /* stats */
    const stats = el("div", { class: "stats" });
    const nVillagers = hall.villagers.length;
    const nBooks = hall.villagers.reduce(
      (acc, v) => acc + v.trades.filter((t) => t.kind === "book").length,
      0
    );
    const nCured = hall.villagers.filter((v) => v.cured).length;
    const nLibrarians = hall.villagers.filter((v) => v.profession === "librarian").length;
    stats.append(
      statCard("Villagers", String(nVillagers)),
      statCard("Librarians", String(nLibrarians)),
      statCard("Book trades", String(nBooks)),
      statCard("Cured", String(nCured))
    );

    main.appendChild(controls);
    main.appendChild(stats);
    main.appendChild(renderVillagerGrid(hall));
  }

  function statCard(label, value) {
    return el("div", { class: "stat" }, el("div", { class: "stat-value", text: value }), el("div", { class: "stat-label", text: label }));
  }

  function makeHeroControl() {
    const state = getState();
    const sel = el("select", {
      class: "input input-inline",
      title: "Your current Hero of the Village level (affects displayed prices)",
      onchange: (e) => {
        setSettings({ heroLevel: parseInt(e.target.value, 10) || 0 });
        toast("Hero level set to " + e.target.value);
      },
    });
    for (let i = 0; i <= 5; i++) {
      sel.appendChild(el("option", { value: i, text: i === 0 ? "Hero: none" : "Hero of the Village " + i }));
    }
    sel.value = String(state.settings.heroLevel || 0);
    return el("div", { class: "field" }, el("span", { class: "field-label", text: "Discount" }), sel);
  }

  function renderVillagerGrid(hall) {
    const wrap = el("div", { class: "villager-list" });

    const filterWrap = el("div", { class: "filter-row" });
    const search = el("input", {
      class: "input",
      type: "search",
      placeholder: "Search villagers, enchantments, items\u2026",
      oninput: (e) => {
        const q = e.target.value.toLowerCase();
        $$(".villager-card").forEach((card) => {
          card.style.display = card.dataset.search && card.dataset.search.includes(q) ? "" : "none";
        });
      },
    });
    const profSel = el("select", {
      class: "input",
      onchange: (e) => {
        const f = e.target.value;
        $$(".villager-card").forEach((card) => {
          card.style.display = !f || card.dataset.prof === f ? "" : "none";
        });
      },
    });
    profSel.appendChild(el("option", { value: "", text: "All professions" }));
    for (const p of PROFESSIONS) {
      if (p.id === "nitwit") continue;
      profSel.appendChild(el("option", { value: p.id, text: p.name }));
    }
    filterWrap.append(search, profSel);

    const grid = el("div", { class: "card-grid" });

    const villagers = hall.villagers.slice().sort((a, b) => {
      const sa = parseInt(a.stall, 10) || 0;
      const sb = parseInt(b.stall, 10) || 0;
      if (sa !== sb) return sa - sb;
      return (a.name || "zzz").localeCompare(b.name || "zzz");
    });

    if (villagers.length === 0) {
      grid.appendChild(
        el("div", { class: "empty-state" },
          el("h3", { text: "No villagers yet" }),
          el("p", { text: "Click \u201CAdd Villager\u201D to start tracking trades." })
        )
      );
    }

    for (const v of villagers) {
      grid.appendChild(villagerCard(hall, v));
    }

    wrap.append(filterWrap, grid);
    return wrap;
  }

  function $$(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  function villagerCard(hall, v) {
    const prof = professionById(v.profession);
    const books = v.trades.filter((t) => t.kind === "book").slice(0, 3);
    const nTrades = v.trades.length;

    const searchable = [
      v.name,
      prof.name,
      v.stall,
      v.position,
      v.notes,
      ...v.trades.map((t) => (t.kind === "book" ? t.bookEnchant + " " + t.bookLevel : t.getItem || "")),
    ]
      .join(" ")
      .toLowerCase();

    const body = el("div", { class: "card-body" });
    const head = el("div", { class: "card-head" });
    head.append(
      professionBadge(v.profession),
      levelBadge(v.level),
      v.cured ? curedBadge() : null,
      nTrades > 0 ? el("span", { class: "badge badge-muted", text: nTrades + " trade" + (nTrades === 1 ? "" : "s") }) : null
    );

    const name = el("div", { class: "card-title", text: v.name || "Unnamed villager" });
    const meta = el("div", { class: "card-meta" });
    const bits = [];
    if (v.stall) bits.push("Stall " + v.stall);
    if (v.position) bits.push(v.position);
    if (bits.length) meta.textContent = bits.join(" \u00B7 ");

    body.append(head, name, meta);

    if (books.length) {
      const chips = el("div", { class: "book-chips" });
      for (const b of books) {
        const price = finalTradePrice(b, hall.version, v.cured, getState().settings.heroLevel).final;
        chips.appendChild(
          el("span", { class: "chip" }, esc(b.bookEnchant + " " + b.bookLevel) + " \u00B7 " + price + "e")
        );
      }
      if (v.trades.length > books.length) {
        chips.appendChild(el("span", { class: "chip chip-more", text: "+" + (v.trades.length - books.length) }));
      }
      body.appendChild(chips);
    }

    if (v.notes) {
      body.appendChild(el("div", { class: "card-note", text: v.notes.length > 60 ? v.notes.slice(0, 60) + "\u2026" : v.notes }));
    }

    return el("div", {
      class: "card villager-card",
      dataset: { prof: v.profession, search: searchable },
      onclick: () => navigate("/villager/" + v.id),
    }, body);
  }

  function newHallModal() {
    const sheet = openModal(
      el("form", { class: "modal-form" },
        el("h3", { text: "New Trading Hall" }),
        el("label", { class: "field" },
          el("span", { class: "field-label", text: "Name" }),
          el("input", { class: "input", id: "f-hall-name", value: "Trading Hall " + (allHalls().length + 1), required: true })
        ),
        el("label", { class: "field" },
          el("span", { class: "field-label", text: "Edition" }),
          el("select", { class: "input", id: "f-hall-version" },
            el("option", { value: "java", text: "Java Edition" }),
            el("option", { value: "bedrock", text: "Bedrock Edition" })
          )
        ),
        el("div", { class: "row" },
          el("button", { class: "btn", type: "button", text: "Cancel", onclick: closeModal }),
          el("button", { class: "btn btn-primary", text: "Create", onclick: (e) => {
            e.preventDefault();
            const name = $("#f-hall-name").value.trim();
            const version = $("#f-hall-version").value;
            if (name) {
              const hall = newHall(name, version);
              closeModal();
              toast("Hall created");
              navigate("/");
            }
          } })
        )
      )
    );
    $("#f-hall-name", sheet).select();
  }

  /* ---------------- villager form ---------------- */

  function villagerFormModal(hallId, vId) {
    const hall = getHall(hallId);
    const v = vId ? getVillager(hallId, vId) : null;
    if (!hall || (vId && !v)) return;

    const sheet = openModal(
      el("form", { class: "modal-form" },
        el("h3", { text: v ? "Edit villager" : "Add villager" }),
        el("label", { class: "field" },
          el("span", { class: "field-label", text: "Name" }),
          el("input", { class: "input", id: "f-name", value: v ? v.name : "", placeholder: "e.g. Mending Bob" })
        ),
        el("div", { class: "two-col" },
          el("label", { class: "field" },
            el("span", { class: "field-label", text: "Profession" }),
            el("select", { class: "input", id: "f-prof" }, professionOptions(v ? v.profession : "librarian"))
          ),
          el("label", { class: "field" },
            el("span", { class: "field-label", text: "Level" }),
            el("select", { class: "input", id: "f-level" },
              LEVELS.map((l) => el("option", { value: l.id, text: l.name, selected: (v ? v.level : 1) === l.id }))
            )
          )
        ),
        el("div", { class: "two-col" },
          el("label", { class: "field" },
            el("span", { class: "field-label", text: "Stall / cell #" }),
            el("input", { class: "input", id: "f-stall", value: v ? v.stall : "" })
          ),
          el("label", { class: "field" },
            el("span", { class: "field-label", text: "Position" }),
            el("input", { class: "input", id: "f-position", value: v ? v.position : "", placeholder: "e.g. west wall" })
          )
        ),
        el("label", { class: "checkbox" },
          el("input", { type: "checkbox", id: "f-cured", checked: !!(v && v.cured) }),
          el("span", { text: "Cured (first cure discount applied)" })
        ),
        el("label", { class: "field" },
          el("span", { class: "field-label", text: "Notes" }),
          el("textarea", { class: "input", id: "f-notes", rows: 2 }, v ? v.notes : "")
        ),
        el("div", { class: "row" },
          el("button", { class: "btn", type: "button", text: "Cancel", onclick: closeModal }),
          el("button", { class: "btn btn-primary", text: v ? "Save" : "Add", onclick: (e) => {
            e.preventDefault();
            const data = {
              name: $("#f-name").value.trim(),
              profession: $("#f-prof").value,
              level: parseInt($("#f-level").value, 10) || 1,
              stall: $("#f-stall").value.trim(),
              position: $("#f-position").value.trim(),
              cured: $("#f-cured").checked,
              notes: $("#f-notes").value,
            };
            if (v) {
              updateVillager(hallId, v.id, data);
              toast("Villager updated");
            } else {
              const created = addVillager(hallId, data);
              toast("Villager added");
              closeModal();
              navigate("/villager/" + created.id);
              return;
            }
            closeModal();
            render();
          } })
        )
      )
    );
  }

  function professionOptions(selected) {
    return PROFESSIONS.map((p) => el("option", { value: p.id, text: p.name, selected: selected === p.id }));
  }

  /* ---------------- villager detail ---------------- */

  function renderVillager(main, vId) {
    const found = findVillagerGlobal(vId);
    if (!found) {
      main.appendChild(
        el("div", { class: "empty-state" },
          el("h3", { text: "Villager not found" }),
          el("button", { class: "btn", text: "Back to hall", onclick: () => navigate("/") })
        )
      );
      return;
    }
    const { hall, villager: v } = found;
    const heroLevel = getState().settings.heroLevel;

    main.appendChild(
      el("div", { class: "page-head" },
        el("button", { class: "btn btn-ghost", text: "\u2190 Hall", onclick: () => navigate("/") }),
        el("h2", { class: "page-title", text: v.name || "Unnamed villager" }),
        el("div", { class: "badge-row" },
          professionBadge(v.profession),
          levelBadge(v.level),
          versionBadge(hall.version),
          v.cured ? curedBadge() : null,
          heroLevel ? heroBadge(heroLevel) : null
        ),
        el("button", { class: "btn", text: "Edit", onclick: () => villagerFormModal(hall.id, v.id) })
      )
    );

    if (v.stall || v.position) {
      main.appendChild(
        el("div", { class: "muted", text: [v.stall ? "Stall " + v.stall : "", v.position].filter(Boolean).join(" \u00B7 ") })
      );
    }

    if (v.notes) {
      main.appendChild(el("div", { class: "notes-box", text: v.notes }));
    }

    /* trades */
    const tradeHead = el("div", { class: "section-head" },
      el("h3", { text: "Trades (" + v.trades.length + ")" }),
      el("button", { class: "btn", text: "+ Item trade", onclick: () => tradeFormModal(hall.id, v.id, null, "item") }),
      el("button", { class: "btn btn-primary", text: "+ Enchanted book", onclick: () => tradeFormModal(hall.id, v.id, null, "book") })
    );
    main.appendChild(tradeHead);

    if (v.trades.length === 0) {
      main.appendChild(
        el("div", { class: "empty-state small" },
          el("p", { text: "No trades recorded. Librarians usually sell enchanted books at level 1\u20133." })
        )
      );
    } else {
      const list = el("div", { class: "trade-list" });
      for (const t of v.trades) {
        list.appendChild(tradeRow(hall, v, t));
      }
      main.appendChild(list);
    }
  }

  function tradeRow(hall, v, t) {
    const isBook = t.kind === "book";
    const calc = finalTradePrice(t, hall.version, v.cured, getState().settings.heroLevel);
    const base = t.direction === "buy" ? t.getCount : t.price;

    const left = el("div", { class: "trade-main" });
    const title = el("div", { class: "trade-title" });

    if (isBook) {
      title.appendChild(
        el("span", { class: "book-name", text: t.bookEnchant + " " + (t.bookLevel || "") })
      );
    } else if (t.direction === "sell") {
      title.appendChild(
        el("span", { html: "Sell: <b>" + esc(t.getItem || "?") + "</b> \u00D7 " + esc(t.getCount || 1) })
      );
    } else {
      title.appendChild(
        el("span", { html: "Buy: give <b>" + esc(t.getItem || "?") + "</b>, get " + esc(t.price || 1) + " emerald(s)" })
      );
    }
    left.appendChild(title);

    const metaBits = [];
    if (isBook) metaBits.push("price mult " + t.multiplier);
    else metaBits.push("mult " + t.multiplier);
    if (t.stock != null) metaBits.push("stock " + t.stock + "/" + (t.maxStock != null ? t.maxStock : "?"));
    if (t.locked) metaBits.push("LOCKED");
    if (t.note) metaBits.push(t.note);
    left.appendChild(el("div", { class: "trade-meta", text: metaBits.join("  \u00B7  ") }));

    const priceBox = el("div", { class: "trade-price" });
    if (t.direction === "buy") {
      priceBox.appendChild(el("span", { class: "price-final", text: "Give " + calc.final }));
      priceBox.appendChild(
        el("span", { class: "price-base muted", text: "base " + base + (calc.reputationTerm ? " \u00B7 cure \u2212" + calc.reputationTerm : "") + (calc.heroTerm ? " \u00B7 hero \u2212" + calc.heroTerm : "") })
      );
    } else {
      priceBox.appendChild(el("span", { class: "price-final", text: calc.final + " emeralds" }));
      priceBox.appendChild(el("span", { class: "price-base muted", text: "base " + base + (calc.reputationTerm ? " \u00B7 cure \u2212" + calc.reputationTerm : "") + (calc.heroTerm ? " \u00B7 hero \u2212" + calc.heroTerm : "") }));
    }

    return el("div", { class: "trade-row" },
      left,
      priceBox,
      el("div", { class: "trade-actions" },
        el("button", { class: "btn btn-ghost btn-sm", text: "Edit", onclick: () => tradeFormModal(hall.id, v.id, t.id, t.kind) }),
        el("button", { class: "btn btn-danger-ghost btn-sm", text: "Delete", onclick: async () => {
          if (await confirmDialog("Delete trade?", "Remove this trade from " + (v.name || "this villager") + "?", "Delete")) {
            deleteTrade(hall.id, v.id, t.id);
            toast("Trade deleted");
          }
        } })
      )
    );
  }

  function tradeFormModal(hallId, vId, tId, forcedKind) {
    const hall = getHall(hallId);
    const v = getVillager(hallId, vId);
    if (!hall || !v) return;
    const t = tId ? v.trades.find((x) => x.id === tId) : null;

    const kind = t ? t.kind : forcedKind;
    const isBook = kind === "book";

    const sheet = openModal(
      el("form", { class: "modal-form trade-form" },
        el("h3", { text: t ? (isBook ? "Edit enchanted book trade" : "Edit trade") : (isBook ? "Add enchanted book trade" : "Add trade") }),

        isBook
          ? el("div", { class: "two-col" },
              el("label", { class: "field" },
                el("span", { class: "field-label", text: "Enchantment" }),
                el("input", { class: "input", id: "tf-enchant", list: "enchant-list", value: t ? t.bookEnchant : "", placeholder: "e.g. Mending" })
              ),
              el("label", { class: "field" },
                el("span", { class: "field-label", text: "Level" }),
                el("select", { class: "input", id: "tf-level" },
                  [1, 2, 3, 4, 5].map((l) => el("option", { value: l, text: "Level " + l, selected: t && t.bookLevel === l }))
                )
              )
            )
          : el("div", { class: "field" },
              el("span", { class: "field-label", text: "Direction" }),
              el("div", { class: "seg" },
                el("button", { type: "button", class: "seg-btn" + (t ? (t.direction === "sell" ? " on" : "") : " on"), id: "tf-dir-sell", text: "Villager sells to me" }),
                el("button", { type: "button", class: "seg-btn", id: "tf-dir-buy", text: "I sell to villager" })
              )
            ),

        isBook
          ? el("label", { class: "field" },
              el("span", { class: "field-label", text: "Price (emeralds)" }),
              el("input", { class: "input", type: "number", min: "1", max: "64", id: "tf-price", value: t ? t.price : 8 })
            )
          : el("div", { class: "two-col" },
              el("label", { class: "field" },
                el("span", { class: "field-label", text: "Item", id: "tf-item-label" }),
                el("input", { class: "input", id: "tf-item", value: t ? t.getItem : "" })
              ),
              el("label", { class: "field" },
                el("span", { class: "field-label", text: "Count" }),
                el("input", { class: "input", type: "number", min: "1", id: "tf-count", value: t ? t.getCount : 1 })
              ),
              el("label", { class: "field" },
                el("span", { class: "field-label", text: "Emeralds" }),
                el("input", { class: "input", type: "number", min: "1", id: "tf-price2", value: t ? t.price : 1 })
              )
            ),

        el("div", { class: "two-col" },
          el("label", { class: "field" },
            el("span", { class: "field-label", text: "Price multiplier" }),
            el("select", { class: "input", id: "tf-mult" },
              PRICE_MULTIPLIERS.map((m) => el("option", { value: m.value, text: m.label, selected: t && t.multiplier === m.value || (isBook && m.value === 0.3) }))
            )
          ),
          el("label", { class: "field" },
            el("span", { class: "field-label", text: "Stock (remaining / max)" }),
            el("div", { class: "inline-row" },
              el("input", { class: "input", type: "number", min: "0", id: "tf-stock", value: t && t.stock != null ? t.stock : "", placeholder: "cur" }),
              el("input", { class: "input", type: "number", min: "0", id: "tf-maxstock", value: t && t.maxStock != null ? t.maxStock : "", placeholder: "max" })
            )
          )
        ),

        el("label", { class: "checkbox" },
          el("input", { type: "checkbox", id: "tf-locked", checked: !!(t && t.locked) }),
          el("span", { text: "Trade is locked (out of stock, must re-stock)" })
        ),

        el("label", { class: "field" },
          el("span", { class: "field-label", text: "Note" }),
          el("input", { class: "input", id: "tf-note", value: t ? t.note : "" })
        ),

        el("div", { class: "row" },
          el("button", { class: "btn", type: "button", text: "Cancel", onclick: closeModal }),
          el("button", { class: "btn btn-primary", text: t ? "Save" : "Add", onclick: (e) => {
            e.preventDefault();
            const data = buildTradeFromForm(isBook);
            if (!data) return;
            if (t) {
              updateTrade(hallId, vId, t.id, data);
              toast("Trade updated");
            } else {
              addTrade(hallId, vId, data);
              toast("Trade added");
            }
            closeModal();
            render();
          } })
        )
      )
    );

    if (isBook) {
      const dl = el("datalist", { id: "enchant-list" }, ENCHANTMENTS.map((e) => el("option", { value: e.name })));
      sheet.appendChild(dl);
    }

    if (!isBook) {
      const sellBtn = $("#tf-dir-sell", sheet);
      const buyBtn = $("#tf-dir-buy", sheet);
      const itemLabel = $("#tf-item-label", sheet);
      const itemInput = $("#tf-item", sheet);
      const countInput = $("#tf-count", sheet);
      const priceInput = $("#tf-price2", sheet);
      const setMode = (mode) => {
        sellBtn.classList.toggle("on", mode === "sell");
        buyBtn.classList.toggle("on", mode === "buy");
        if (mode === "buy") {
          itemLabel.textContent = "Item you give";
          itemInput.placeholder = "e.g. Wheat";
          countInput.placeholder = "count";
          priceInput.value = priceInput.value || "1";
        } else {
          itemLabel.textContent = "Item you receive";
          itemInput.placeholder = "e.g. Diamond Chestplate";
          countInput.placeholder = "count";
          priceInput.value = priceInput.value || "8";
        }
      };
      sellBtn.addEventListener("click", () => setMode("sell"));
      buyBtn.addEventListener("click", () => setMode("buy"));
      setMode(t ? t.direction : "sell");
    }

    function buildTradeFromForm(isBookForm) {
      const mult = parseFloat($("#tf-mult", sheet).value) || 0.05;
      const stock = $("#tf-stock", sheet).value;
      const maxStock = $("#tf-maxstock", sheet).value;
      const locked = $("#tf-locked", sheet).checked;
      const note = $("#tf-note", sheet).value.trim();

      if (isBookForm) {
        const enchant = $("#tf-enchant", sheet).value.trim();
        if (!enchant) {
          toast("Enter an enchantment name", "error");
          return null;
        }
        const level = parseInt($("#tf-level", sheet).value, 10) || 1;
        const price = Math.max(1, parseInt($("#tf-price", sheet).value, 10) || 1);
        return {
          kind: "book",
          direction: "sell",
          bookEnchant: enchant,
          bookLevel: level,
          price: price,
          multiplier: mult,
          stock: stock === "" ? null : parseInt(stock, 10),
          maxStock: maxStock === "" ? null : parseInt(maxStock, 10),
          locked: locked,
          note: note,
        };
      }

      const direction = $("#tf-dir-sell", sheet).classList.contains("on") ? "sell" : "buy";
      const item = $("#tf-item", sheet).value.trim();
      if (!item) {
        toast("Enter an item name", "error");
        return null;
      }
      const count = Math.max(1, parseInt($("#tf-count", sheet).value, 10) || 1);
      const price = Math.max(1, parseInt($("#tf-price2", sheet).value, 10) || 1);
      return {
        kind: "item",
        direction: direction,
        getItem: item,
        getCount: count,
        price: price,
        multiplier: mult,
        stock: stock === "" ? null : parseInt(stock, 10),
        maxStock: maxStock === "" ? null : parseInt(maxStock, 10),
        locked: locked,
        note: note,
      };
    }
  }

  /* ---------------- books page ---------------- */

  function renderBooks(main) {
    const state = getState();
    const heroLevel = state.settings.heroLevel;

    main.appendChild(
      el("div", { class: "page-head" },
        el("h2", { class: "page-title", text: "Enchanted Books" }),
        el("p", { class: "muted", text: "Every enchanted book you\u2019ve tracked, plus a reference of all enchantments librarians can sell." })
      )
    );

    /* collected books */
    const books = allTrackedBooks();
    const collected = el("div", { class: "panel" },
      el("h3", { text: "Your book collection (" + books.length + ")" })
    );

    if (books.length === 0) {
      collected.appendChild(
        el("p", { class: "muted", text: "No enchanted book trades tracked yet. Add an \u201CEnchanted book\u201D trade to a librarian to see it here." })
      );
    } else {
      const filterInput = el("input", {
        class: "input",
        type: "search",
        placeholder: "Filter your books\u2026",
        oninput: (e) => {
          const q = e.target.value.toLowerCase();
          $$("tbody tr", table).forEach((row) => {
            row.style.display = row.dataset.search.includes(q) ? "" : "none";
          });
        },
      });
      collected.appendChild(filterInput);

      const table = el("table", { class: "table" });
      table.appendChild(
        el("thead", {},
          el("tr", {},
            el("th", { text: "Enchantment" }),
            el("th", { text: "Price" }),
            el("th", { text: "Villager" }),
            el("th", { text: "Hall" }),
            el("th", { text: "Stall" })
          )
        )
      );
      const tbody = el("tbody");
      for (const b of books) {
        const calc = finalTradePrice(b.trade, b.hall.version, b.villager.cured, heroLevel);
        const enchant = enchantByName(b.trade.bookEnchant);
        const row = el("tr", {
          dataset: { search: (b.trade.bookEnchant + " " + (b.trade.bookLevel || "") + " " + (b.villager.name || "") + " " + b.hall.name).toLowerCase() },
        },
          el("td", {},
            el("span", { class: "book-enchant", text: b.trade.bookEnchant + " " + (b.trade.bookLevel || "") }),
            enchant && enchant.treasure ? el("span", { class: "badge badge-treasure", text: "treasure" }) : null
          ),
          el("td", { text: calc.final + " emeralds" + (calc.heroTerm ? " (hero)" : "") }),
          el("td", { text: (b.villager.name || "Unnamed") + " \u00B7 " + professionById(b.villager.profession).name }),
          el("td", { text: b.hall.name + " (" + VERSION_LABELS[b.hall.version] + ")" }),
          el("td", { text: b.villager.stall || "\u2014" })
        );
        tbody.appendChild(row);
      }
      table.appendChild(tbody);
      collected.appendChild(table);
    }

    main.appendChild(collected);

    /* reference */
    const ref = el("div", { class: "panel" },
      el("h3", { text: "Enchantment reference (" + ENCHANTMENTS.length + ")" }),
      el("p", { class: "muted", text: "Librarians can sell enchanted books for any enchantment, including treasure enchantments that can\u2019t be obtained from an enchanting table. Book trades use a 0.3 price multiplier and usually cost 5\u201364 emeralds." })
    );
    const refFilter = el("input", {
      class: "input",
      type: "search",
      placeholder: "Filter enchantments\u2026",
      oninput: (e) => {
        const q = e.target.value.toLowerCase();
        $$("tbody tr", refTable).forEach((row) => {
          row.style.display = row.dataset.search.includes(q) ? "" : "none";
        });
      },
    });
    ref.appendChild(refFilter);
    const refTable = el("table", { class: "table" });
    refTable.appendChild(
      el("thead", {},
        el("tr", {},
          el("th", { text: "Enchantment" }),
          el("th", { text: "Max" }),
          el("th", { text: "Applies to" }),
          el("th", { text: "Type" })
        )
      )
    );
    const refBody = el("tbody");
    for (const e of ENCHANTMENTS) {
      refBody.appendChild(
        el("tr", {
          dataset: { search: (e.name + " " + e.appliesTo).toLowerCase() },
        },
          el("td", { class: "book-enchant", text: e.name }),
          el("td", { text: e.maxLevel }),
          el("td", { text: e.appliesTo }),
          el("td", {},
            e.treasure
              ? el("span", { class: "badge badge-treasure", text: "Treasure" })
              : el("span", { class: "badge badge-muted", text: "Standard" })
          )
        )
      );
    }
    refTable.appendChild(refBody);
    ref.appendChild(refTable);
    main.appendChild(ref);
  }

  /* ---------------- discounts page ---------------- */

  function renderDiscounts(main) {
    main.appendChild(
      el("div", { class: "page-head" },
        el("h2", { class: "page-title", text: "Discounts & Pricing" }),
        el("p", { class: "muted", text: "How villager prices are calculated in current Java (1.20.2+) and Bedrock (1.20.30+) versions." })
      )
    );

    main.appendChild(
      el("div", { class: "panel" },
        el("h3", { text: "Curing discount (first cure, permanent)" }),
        el("p", {}, "Curing a zombie villager with a golden apple gives a ",
          el("b", { text: "permanent" }),
          " discount to the player who cured it. Since 1.20.2 (Java) / 1.20.30 (Bedrock), only the ",
          el("b", { text: "first cure" }),
          " counts \u2014 re-curing does not stack any more discounts."),
        el("p", {}, "Mechanically it adds ",
          el("b", { text: "+20 major-positive reputation" }),
          " (capped at 20). The discount in emeralds is ",
          el("b", { text: "\u230Amultiplier \u00D7 20\u230B" }),
          " (rounded down):"),
        el("table", { class: "table" },
          el("thead", {}, el("tr", {}, el("th", { text: "Price multiplier" }), el("th", { text: "Typical trades" }), el("th", { text: "Cure discount" }))),
          el("tbody", {},
            el("tr", {}, el("td", { text: "0.05" }), el("td", { text: "villager buys items from you" }), el("td", { text: "\u22121 emerald" })),
            el("tr", {}, el("td", { text: "0.2" }), el("td", { text: "most sells (gear, food)" }), el("td", { text: "\u22124 emeralds" })),
            el("tr", {}, el("td", { text: "0.3" }), el("td", { text: "enchanted books" }), el("td", { text: "\u22126 emeralds" }))
          )
        ),
        el("p", { class: "muted small" },
          "Cured villagers also improve your reputation with nearby villagers: in Bedrock, villagers within a 16-block cube get a small discount that grows with the number of cured villagers (up to 10). In Java the cured villager spreads minor-positive gossip that nearby villagers pick up. (Iron golems also become friendlier via the same reputation.)"
        )
      )
    );

    main.appendChild(
      el("div", { class: "panel" },
        el("h3", { text: "Hero of the Village" }),
        el("p", {}, "Completing a raid gives ",
          el("b", { text: "Hero of the Village" }),
          " for 40 minutes. It discounts every villager\u2019s trades by ",
          el("b", { text: "30% + 6.25% per additional level" }),
          " of the base price \u2014 ",
          el("b", { text: "55% at level V" }),
          ". Bedrock only has level I (a flat 30%)."),
        el("p", {}, "The reduction is rounded down to whole emeralds, is at least 1, and is ",
          el("b", { text: "not affected by the price multiplier" }),
          " (unlike curing). It can be combined with the cure discount."),
        el("table", { class: "table" },
          el("thead", {}, el("tr", {}, el("th", { text: "Hero level" }), el("th", { text: "Discount rate" }), el("th", { text: "On a 20-emerald trade" }))),
          el("tbody", {},
            [1, 2, 3, 4, 5].map((h) =>
              el("tr", {},
                el("td", { text: h + (h === 1 ? " (Java & Bedrock)" : " (Java)") }),
                el("td", { text: Math.round(HERO_DISCOUNTS[h] * 100) + "%" }),
                el("td", { text: "\u2212" + Math.max(1, Math.floor(20 * HERO_DISCOUNTS[h])) + " emeralds" })
              )
            )
          )
        )
      )
    );

    main.appendChild(
      el("div", { class: "panel" },
        el("h3", { text: "The full formula" }),
        el("p", { class: "small" },
          el("code", {}, "final = min(max(\u230Ap\u00B7(m\u00B7max(0,d)+1)\u230B \u2212 \u230Am\u00B7r\u230B \u2212 hero, 1), stack)"),
        ),
        el("p", { class: "muted small" },
          "p = base price, m = price multiplier (0.05 / 0.2 / 0.3), d = demand (rises after you buy; only raises price), r = reputation (cured \u2192 +20; only raises price in Bedrock, can\u2019t lower it), hero = \u230Amax(1, p\u00B7(0.3+0.0625\u00B7(level\u22121))\u230B if active, stack = item stack size. Quantities can\u2019t drop below 1."
        )
      )
    );

    main.appendChild(renderCalculator());
  }

  function renderCalculator() {
    const state = getState();
    const panel = el("div", { class: "panel" },
      el("h3", { text: "Price calculator" }),
      el("div", { class: "calc-grid" },
        el("label", { class: "field" },
          el("span", { class: "field-label", text: "Edition" }),
          el("select", { class: "input", id: "c-version" },
            el("option", { value: "java", text: "Java" }),
            el("option", { value: "bedrock", text: "Bedrock" })
          )
        ),
        el("label", { class: "field" },
          el("span", { class: "field-label", text: "Base price" }),
          el("input", { class: "input", type: "number", min: "1", id: "c-base", value: "8" })
        ),
        el("label", { class: "field" },
          el("span", { class: "field-label", text: "Multiplier" }),
          el("select", { class: "input", id: "c-mult" },
            PRICE_MULTIPLIERS.map((m) => el("option", { value: m.value, text: m.value + " (" + (m.value === 0.05 ? "buy" : m.value === 0.2 ? "sell" : "book") + ")" }))
          )
        ),
        el("label", { class: "field" },
          el("span", { class: "field-label", text: "Demand" }),
          el("input", { class: "input", type: "number", id: "c-demand", value: "0" })
        ),
        el("label", { class: "checkbox" },
          el("input", { type: "checkbox", id: "c-cured" }),
          el("span", { text: "Villager cured (reputation +20)" })
        ),
        el("label", { class: "field" },
          el("span", { class: "field-label", text: "Hero level" }),
          el("select", { class: "input", id: "c-hero" },
            [0, 1, 2, 3, 4, 5].map((h) => el("option", { value: h, text: h === 0 ? "none" : "Hero " + h }))
          )
        ),
        el("label", { class: "field" },
          el("span", { class: "field-label", text: "Stack size" }),
          el("input", { class: "input", type: "number", min: "1", id: "c-stack", value: "64" })
        )
      ),
      el("div", { id: "calc-out", class: "calc-out" })
    );

    const versionSel = $("#c-version", panel);
    versionSel.value = state.settings.defaultVersion;

    const update = () => {
      const result = computePrice({
        version: $("#c-version", panel).value,
        base: parseInt($("#c-base", panel).value, 10) || 0,
        multiplier: parseFloat($("#c-mult", panel).value) || 0,
        demand: parseInt($("#c-demand", panel).value, 10) || 0,
        reputation: $("#c-cured", panel).checked ? CURE_REPUTATION : 0,
        heroLevel: parseInt($("#c-hero", panel).value, 10) || 0,
        stackSize: parseInt($("#c-stack", panel).value, 10) || 64,
      });
      const out = $("#calc-out", panel);
      empty(out);
      out.appendChild(
        el("div", { class: "calc-breakdown" },
          el("div", { class: "calc-line" }, el("span", { text: "Demand term (\u230A" + result.base + "\u00B7(" + result.multiplier + "\u00B7" + Math.max(0, result.demand) + "+1)\u230B)" }), el("span", { text: String(result.demandTerm) })),
          el("div", { class: "calc-line" }, el("span", { text: "\u2212 reputation discount (\u230A" + result.multiplier + "\u00D7 " + result.reputation + "\u230B)" }), el("span", { text: "\u2212" + result.reputationTerm })),
          el("div", { class: "calc-line" }, el("span", { text: "\u2212 Hero of the Village" }), el("span", { text: result.heroTerm ? "\u2212" + result.heroTerm : "0" })),
          el("div", { class: "calc-line calc-total" }, el("span", { text: "Final price" }), el("span", { text: String(result.final) }))
        )
      );
    };

    ["input", "change"].forEach((evt) =>
      panel.addEventListener(evt, update)
    );
    update();
    return panel;
  }

  /* ---------------- data page ---------------- */

  function renderData(main) {
    const state = getState();
    const storageBytes = (localStorage.getItem(STORAGE_KEY) || "").length;

    main.appendChild(
      el("div", { class: "page-head" },
        el("h2", { class: "page-title", text: "Data & Settings" }),
        el("p", { class: "muted", text: "Everything is stored on this device (localStorage). Export a backup to move or save your data." })
      )
    );

    const settingsPanel = el("div", { class: "panel" },
      el("h3", { text: "Settings" }),
      el("label", { class: "field" },
        el("span", { class: "field-label", text: "Default edition for new halls" }),
        el("select", { class: "input", onchange: (e) => setSettings({ defaultVersion: e.target.value }) },
          el("option", { value: "java", text: "Java Edition", selected: state.settings.defaultVersion !== "bedrock" }),
          el("option", { value: "bedrock", text: "Bedrock Edition", selected: state.settings.defaultVersion === "bedrock" })
        )
      )
    );
    main.appendChild(settingsPanel);

    const exportPanel = el("div", { class: "panel" },
      el("h3", { text: "Backup & transfer" }),
      el("p", { class: "muted small", text: state.halls.length + " halls, " + state.halls.reduce((a, h) => a + h.villagers.length, 0) + " villagers, " + allTrackedBooks().length + " book trades tracked. " + Math.round(storageBytes / 1024) + " KB stored." }),
      el("div", { class: "row" },
        el("button", { class: "btn btn-primary", text: "Export JSON", onclick: () => { downloadExport(); toast("Backup downloaded"); } }),
        el("button", { class: "btn", text: "Import JSON", onclick: () => $("#import-file").click() }),
        el("input", { id: "import-file", type: "file", accept: ".json,application/json", style: "display:none",
          onchange: (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
              try {
                importText(String(reader.result));
                toast("Data imported");
                render();
              } catch (err) {
                toast("Import failed: " + err.message, "error");
              }
            };
            reader.readAsText(file);
            e.target.value = "";
          } })
      ),
      el("label", { class: "field" },
        el("span", { class: "field-label", text: "Or paste backup JSON" }),
        el("textarea", { class: "input", id: "paste-json", rows: 4, placeholder: '{"app":"Villager Trading Hall Tracker", ...}' })
      ),
      el("div", { class: "row" },
        el("button", { class: "btn", text: "Import pasted JSON", onclick: () => {
          const text = $("#paste-json").value.trim();
          if (!text) { toast("Nothing to import", "error"); return; }
          try {
            importText(text);
            $("#paste-json").value = "";
            toast("Data imported");
            render();
          } catch (err) {
            toast("Import failed: " + err.message, "error");
          }
        } })
      )
    );
    main.appendChild(exportPanel);

    const dangerPanel = el("div", { class: "panel panel-danger" },
      el("h3", { text: "Danger zone" }),
      el("p", { class: "muted small", text: "Wipe all halls and data on this device. You should export a backup first." }),
      el("button", { class: "btn btn-danger", text: "Erase all data", onclick: async () => {
        if (await confirmDialog("Erase all data?", "This permanently deletes all halls, villagers, and trades on this device. Export a backup first!", "Erase everything")) {
          resetAll();
          toast("All data erased");
          navigate("/");
        }
      } })
    );
    main.appendChild(dangerPanel);
  }

  /* ---------------- init ---------------- */

  function init() {
    loadState();
    document.querySelectorAll(".nav-tab").forEach((tab) => {
      tab.addEventListener("click", () => navigate("/" + tab.dataset.route));
    });
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker.register("sw.js").catch(() => {});
      });
    }
    render();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
