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
    for (const value of reportRow(record, index)) {
      row.insertCell().textContent = value;
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

document.getElementById("scan").addEventListener("submit", event => {
  event.preventDefault();
  if (!areas.includes(area) || !date.value || !date.validity.valid) return;

  const rfid = field.value.trim().toUpperCase();
  if (!/^[A-Z0-9_-]{1,128}$/.test(rfid)) {
    announce("Kode RFID tidak valid. Gunakan huruf, angka, tanda hubung atau garis bawah.", "error");
    field.select();
    return;
  }

  try {
    const commit = () => {
      const records = readRecords();
      const index = records.findIndex(record => record.date === observationDate && record.rfid === rfid);
      const previous = records[index];
      const known = master.get(rfid) ?? records.find(record => record.rfid === rfid && (record.palletNo || record.type));
      const number = details.number || known?.palletNo;
      const type = details.type || known?.type;
      const customerName = observationArea === "CUSTOMER"
        ? details.customer || (previous?.area === "CUSTOMER" ? previous.customer : "") || ""
        : "";
      if (previous?.area === observationArea && !details.number && !details.type && !details.customer) {
        return rfid + " sudah tercatat di " + observationArea + ".";
      }
      const record = {
        date: observationDate, rfid, area: observationArea, updated: Date.now(),
        palletNo: number || previous?.palletNo || "",
        type: type || previous?.type || "",
        customer: customerName
      };
      if (previous) records[index] = record;
      else records.push(record);
      localStorage.setItem(key, JSON.stringify(records));
      return previous && previous.area !== observationArea ? rfid + " dipindahkan dari " + previous.area + " ke " + observationArea + "."
        : rfid + " tersimpan di " + observationArea + ".";
    };

    const observationDate = date.value;
    const observationArea = area;
    const details = {number: palletNo.value.trim(), type: palletType.value.trim(), customer: customer.value.trim()};
    palletNo.value = "";
    palletType.value = "";
    field.value = "";
    field.focus();
    const result = navigator.locks ? navigator.locks.request(key, commit) : Promise.resolve(commit());
    result.then(message => {
      announce(message, "ok");
      refresh();
    }).catch(() => {
      announce("Gagal menyimpan " + rfid + ". Periksa penyimpanan browser lalu scan ulang.", "error");
    });
  } catch {
    announce("Gagal menyimpan " + rfid + ". Periksa penyimpanan browser lalu scan ulang.", "error");
  }
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
