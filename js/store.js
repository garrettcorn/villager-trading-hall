/* Persistence: localStorage + JSON export/import. */
"use strict";

const STORAGE_KEY = "villager-trading-hall:v1";
const APP_NAME = "Villager Trading Hall Tracker";

function defaultState() {
  return {
    app: APP_NAME,
    schemaVersion: 1,
    settings: {
      heroLevel: 0,
      defaultVersion: "java",
      selectedHallId: null,
    },
    halls: [],
  };
}

let state = null;

function loadState() {
  if (state) return state;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.halls)) {
        state = Object.assign(defaultState(), parsed);
        state.settings = Object.assign(defaultState().settings, parsed.settings || {});
        return state;
      }
    }
  } catch (e) {
    /* corrupted storage -> start fresh */
  }
  state = defaultState();
  return state;
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent("store:change", { detail: state }));
}

function getState() {
  return loadState();
}

function setSettings(patch) {
  loadState();
  state.settings = Object.assign({}, state.settings, patch);
  saveState();
  return state.settings;
}

function newHall(name, version) {
  loadState();
  const hall = {
    id: uid("hall"),
    name: name || "Trading Hall",
    version: version || state.settings.defaultVersion || "java",
    createdAt: Date.now(),
    villagers: [],
  };
  state.halls.push(hall);
  state.settings.selectedHallId = hall.id;
  saveState();
  return hall;
}

function getHall(id) {
  return (loadState().halls.find((h) => h.id === id)) || null;
}

function allHalls() {
  return loadState().halls;
}

function updateHall(id, patch) {
  loadState();
  const hall = getHall(id);
  if (hall) {
    Object.assign(hall, patch);
    saveState();
  }
  return hall;
}

function deleteHall(id) {
  loadState();
  state.halls = state.halls.filter((h) => h.id !== id);
  if (state.settings.selectedHallId === id) {
    state.settings.selectedHallId = state.halls.length ? state.halls[0].id : null;
  }
  saveState();
}

function addVillager(hallId, data) {
  loadState();
  const hall = getHall(hallId);
  if (!hall) return null;
  const villager = Object.assign(
    {
      id: uid("villager"),
      name: "",
      profession: "librarian",
      level: 1,
      stall: "",
      position: "",
      notes: "",
      cured: false,
      trades: [],
    },
    data,
    { id: uid("villager"), trades: data.trades || [] }
  );
  hall.villagers.push(villager);
  saveState();
  return villager;
}

function getVillager(hallId, vId) {
  const hall = getHall(hallId);
  if (!hall) return null;
  return hall.villagers.find((v) => v.id === vId) || null;
}

function updateVillager(hallId, vId, patch) {
  loadState();
  const villager = getVillager(hallId, vId);
  if (villager) {
    Object.assign(villager, patch);
    saveState();
  }
  return villager;
}

function deleteVillager(hallId, vId) {
  loadState();
  const hall = getHall(hallId);
  if (hall) {
    hall.villagers = hall.villagers.filter((v) => v.id !== vId);
    saveState();
  }
}

function addTrade(hallId, vId, data) {
  loadState();
  const villager = getVillager(hallId, vId);
  if (!villager) return null;
  const trade = Object.assign({ id: uid("trade") }, data);
  villager.trades.push(trade);
  saveState();
  return trade;
}

function updateTrade(hallId, vId, tId, patch) {
  loadState();
  const villager = getVillager(hallId, vId);
  if (!villager) return null;
  const trade = villager.trades.find((t) => t.id === tId);
  if (trade) {
    Object.assign(trade, patch);
    saveState();
  }
  return trade;
}

function deleteTrade(hallId, vId, tId) {
  loadState();
  const villager = getVillager(hallId, vId);
  if (villager) {
    villager.trades = villager.trades.filter((t) => t.id !== tId);
    saveState();
  }
}

/* ---------- export / import ---------- */

function exportState() {
  loadState();
  return {
    app: APP_NAME,
    exportedAt: new Date().toISOString(),
    data: JSON.parse(JSON.stringify(state)),
  };
}

function downloadExport() {
  const payload = JSON.stringify(exportState(), null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = "trading-hall-backup-" + date + ".json";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

function importText(text) {
  const parsed = JSON.parse(text);
  const incoming =
    parsed && parsed.data && Array.isArray(parsed.data.halls)
      ? parsed.data
      : Array.isArray(parsed && parsed.halls)
        ? parsed
        : null;
  if (!incoming) throw new Error("Not a valid trading hall backup file.");
  const defaults = defaultState();
  state = Object.assign(defaults, incoming);
  state.settings = Object.assign({}, defaults.settings, incoming.settings || {});
  saveState();
  return state;
}

function resetAll() {
  state = defaultState();
  saveState();
  return state;
}

/* Aggregates every tracked enchanted book across all halls. */
function allTrackedBooks() {
  const books = [];
  for (const hall of loadState().halls) {
    for (const v of hall.villagers) {
      for (const t of v.trades) {
        if (t.kind === "book") {
          books.push({
            trade: t,
            villager: v,
            hall: hall,
          });
        }
      }
    }
  }
  return books;
}
