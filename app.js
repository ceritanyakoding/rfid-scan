"use strict";

const key = "pallet-rfid-observations-v1";
const areas = ["SHIPPING", "EMPTY", "CUSTOMER"];
const date = document.getElementById("date");
const field = document.getElementById("rfid");
const save = document.getElementById("save");
const exportButton = document.getElementById("export");
const status = document.getElementById("status");
const rows = document.getElementById("rows");
const stats = document.getElementById("stats");
const columns = ["NO", "HARI/TANGGAL", "NO. PALLET", "NO. RFID", "TYPE", "CUSTOMER", "AREA"];
const months = ["JAN", "FEB", "MAR", "APR", "MEI", "JUN", "JUL", "AGU", "SEP", "OKT", "NOV", "DES"];
const palletNo = document.getElementById("palletNo");
const palletType = document.getElementById("palletType");
const customer = document.getElementById("customer");
const initialRecords = ["0008", "0017", "0014", "0034", "0060", "0019"].map((number, index) => ({
  date: "2026-10-05",
  rfid: "00000007" + number + "0826",
  palletNo: number,
  type: "S14",
  area: index < 4 ? "EMPTY" : "SHIPPING",
  updated: 0
}));
const master = new Map(initialRecords.map(record => [record.rfid, record]));
let area = "";
let savingBatch = false;
const pending = new Map();
const bulk = document.getElementById("bulk");
const saveBatch = document.getElementById("saveBatch");
const clearBatch = document.getElementById("clearBatch");
const areaControls = document.getElementById("areas");

function readRecords() {
  const saved = JSON.parse(localStorage.getItem(key) ?? "[]");
  const existing = new Set(saved.map(record => record.date + "|" + record.rfid));
  return [...saved, ...initialRecords.filter(record => !existing.has(record.date + "|" + record.rfid))];
}

function announce(message, tone = "") {
  status.textContent = message;
  status.dataset.tone = tone;
}

function dailyRecords() {
  return readRecords().filter(record => record.date === date.value)
    .sort((a, b) => b.updated - a.updated);
}

function formatDate(value) {
  const [year, month, day] = value.split("-");
  return day + " " + months[Number(month) - 1] + " " + year;
}

function reportRow(record, index) {
  const known = master.get(record.rfid);
  return [index + 1, formatDate(record.date), record.palletNo || known?.palletNo || "-",
    record.rfid, record.type || known?.type || "-", record.customer || "-", record.area];
}

function render() {
  exportButton.disabled = true;
  rows.replaceChildren();
  stats.replaceChildren();
  document.getElementById("reportDate").textContent = date.value
    ? formatDate(date.value) : "Pilih tanggal observasi.";
  const records = dailyRecords();
  for (const label of ["Total", ...areas]) {
    const card = document.createElement("div");
    card.className = "stat";
    const count = document.createElement("b");
    count.textContent = label === "Total" ? records.length
      : records.filter(record => record.area === label).length;
    const name = document.createElement("small");
    name.textContent = label;
    card.append(count, name);
    stats.append(card);
  }
  if (!records.length) {
    const cell = rows.insertRow().insertCell();
    cell.colSpan = columns.length;
    cell.textContent = "Belum ada scan untuk tanggal ini.";
    return;
  }

  for (const [index, record] of records.entries()) {
    const row = rows.insertRow();
    for (const [column, value] of reportRow(record, index).entries()) {
      const cell = row.insertCell();
      cell.dataset.label = columns[column];
      cell.textContent = value;
    }
  }
  exportButton.disabled = false;
}

function refresh() {
  try {
    render();
  } catch {
    announce("Data lokal tidak dapat dibaca di browser ini.", "error");
  }
}

function updateScanner() {
  const ready = Boolean(date.value && date.validity.valid && area);
  field.value = "";
  field.disabled = save.disabled = !ready;
  field.placeholder = ready ? "Arahkan scanner ke tag pallet" : "Pilih tanggal dan area";
  announce(ready ? "Siap scan di area " + area + "." : "Pilih tanggal dan area untuk mulai scan.");
  if (ready) field.focus();
}

customer.disabled = true;
const now = new Date();
date.value = [now.getFullYear(), now.getMonth() + 1, now.getDate()]
  .map(part => String(part).padStart(2, "0")).join("-");

document.getElementById("areas").addEventListener("change", event => {
  area = event.target.value;
  customer.value = "";
  customer.disabled = area !== "CUSTOMER";
  updateScanner();
});
date.addEventListener("change", () => {
  updateScanner();
  refresh();
});

function renderBatch() {
  const count = pending.size;
  document.getElementById("batch").hidden = !bulk.checked;
  document.getElementById("pendingCount").textContent = count;
  date.disabled = areaControls.disabled = bulk.disabled = Boolean(count);
  field.disabled = save.disabled = savingBatch || !area || !date.value || !date.validity.valid;
  saveBatch.disabled = clearBatch.disabled = !count || savingBatch;
  save.textContent = bulk.checked ? "Tambah" : "Simpan";
  const list = document.getElementById("pendingList");
  list.replaceChildren();
  for (const rfid of [...pending.keys()].reverse()) {
    const item = document.createElement("li");
    const code = document.createElement("span");
    code.textContent = rfid;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "secondary";
    remove.textContent = "Hapus";
    remove.setAttribute("aria-label", "Hapus " + rfid);
    remove.disabled = savingBatch;
    remove.addEventListener("click", () => {
      pending.delete(rfid);
      renderBatch();
      field.focus();
    });
    item.append(code, remove);
    list.append(item);
  }
}

async function storeObservations(entries, observationDate, observationArea) {
  const commit = () => {
    const records = readRecords();
    let changed = 0;
    for (const [rfid, details] of entries) {
      const index = records.findIndex(record => record.date === observationDate && record.rfid === rfid);
      const previous = records[index];
      const known = records.find(record => record.rfid === rfid && (record.palletNo || record.type)) ?? master.get(rfid);
      if (previous?.area === observationArea && !details.number && !details.type && !details.customer) continue;
      const record = {
        date: observationDate, rfid, area: observationArea, updated: Date.now(),
        palletNo: details.number || previous?.palletNo || known?.palletNo || "",
        type: details.type || previous?.type || known?.type || "",
        customer: observationArea === "CUSTOMER"
          ? details.customer || (previous?.area === "CUSTOMER" ? previous.customer : "") || ""
          : ""
      };
      if (previous) records[index] = record;
      else records.push(record);
      changed++;
    }
    if (changed) localStorage.setItem(key, JSON.stringify(records));
    return changed;
  };
  return navigator.locks ? navigator.locks.request(key, commit) : commit();
}

bulk.addEventListener("change", () => {
  renderBatch();
  if (!field.disabled) field.focus();
});

clearBatch.addEventListener("click", () => {
  if (!window.confirm("Kosongkan semua tag yang belum disimpan?")) return;
  pending.clear();
  renderBatch();
  announce("Antrean dikosongkan.");
  field.focus();
});

saveBatch.addEventListener("click", async () => {
  if (!pending.size || savingBatch) return;
  savingBatch = true;
  renderBatch();
  const total = pending.size;
  try {
    const changed = await storeObservations(pending, date.value, area);
    pending.clear();
    announce(changed + " tersimpan · " + (total - changed) + " sudah tercatat di " + area + ".", "ok");
    refresh();
  } catch {
    announce("Gagal menyimpan. Antrean masih tersedia untuk dicoba lagi.", "error");
  } finally {
    savingBatch = false;
    renderBatch();
    field.focus();
  }
});

document.getElementById("scan").addEventListener("submit", async event => {
  event.preventDefault();
  if (savingBatch || !areas.includes(area) || !date.value || !date.validity.valid) return;

  const rfid = field.value.trim().toUpperCase();
  if (!/^[A-Z0-9_-]{1,128}$/.test(rfid)) {
    announce("Kode RFID tidak valid. Gunakan huruf, angka, tanda hubung atau garis bawah.", "error");
    field.select();
    return;
  }

  const details = {number: palletNo.value.trim(), type: palletType.value.trim(), customer: customer.value.trim()};
  field.value = "";
  field.focus();
  if (bulk.checked && pending.has(rfid)) {
    announce(rfid + " sudah ada di antrean.");
    return;
  }

  palletNo.value = "";
  palletType.value = "";
  if (bulk.checked) {
    pending.set(rfid, details);
    renderBatch();
    announce(rfid + " masuk antrean.", "ok");
    return;
  }

  try {
    const changed = await storeObservations([[rfid, details]], date.value, area);
    announce(rfid + (changed ? " tersimpan." : " sudah tercatat di area ini."), "ok");
    refresh();
  } catch {
    announce("Gagal menyimpan " + rfid + ". Periksa penyimpanan browser lalu scan ulang.", "error");
  }
});

window.addEventListener("beforeunload", event => {
  if (!pending.size) return;
  event.preventDefault();
  event.returnValue = "";
});

exportButton.addEventListener("click", () => {
  try {
    const records = dailyRecords();
    if (!records.length) return;
    downloadExcel("Rekap_RFID_" + date.value + ".xlsx", [
      columns,
      ...records.map(reportRow)
    ]);
  } catch {
    announce("Ekspor gagal. Coba lagi.", "error");
  }
});

window.addEventListener("storage", event => {
  if (event.key === key || event.key === null) refresh();
});
refresh();
