"use strict";

function workbookBytes(rows) {
  const xmlHeader = '<?xml version="1.0" encoding="UTF-8"?>';
  const spreadsheet = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
  const relationships = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
  const packageRelationships = "http://schemas.openxmlformats.org/package/2006/relationships";
  const escapeXml = value => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  const sheetRows = rows.map((row, index) => {
    const cells = row.map((value, column) =>
      '<c r="' + String.fromCharCode(65 + column) + (index + 1) +
      '" t="inlineStr"><is><t>' + escapeXml(value) + '</t></is></c>').join("");
    return '<row r="' + (index + 1) + '">' + cells + '</row>';
  }).join("");
  const lastRow = rows.length;
  const lastColumn = String.fromCharCode(64 + rows[0].length);

  return storeZip({
    "[Content_Types].xml": xmlHeader + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
    "_rels/.rels": xmlHeader + '<Relationships xmlns="' + packageRelationships +
      '"><Relationship Id="rId1" Type="' + relationships + '/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    "xl/workbook.xml": xmlHeader + '<workbook xmlns="' + spreadsheet + '" xmlns:r="' + relationships +
      '"><sheets><sheet name="Rekap Harian" sheetId="1" r:id="rId1"/></sheets></workbook>',
    "xl/_rels/workbook.xml.rels": xmlHeader + '<Relationships xmlns="' + packageRelationships +
      '"><Relationship Id="rId1" Type="' + relationships + '/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    "xl/worksheets/sheet1.xml": xmlHeader + '<worksheet xmlns="' + spreadsheet + '">' +
      '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
      '<cols><col min="1" max="1" width="8" customWidth="1"/><col min="2" max="3" width="18" customWidth="1"/>' +
      '<col min="4" max="4" width="26" customWidth="1"/><col min="5" max="7" width="16" customWidth="1"/></cols><sheetData>' + sheetRows +
      '</sheetData><autoFilter ref="A1:' + lastColumn + lastRow + '"/></worksheet>'
  });
}

function crc32(bytes) {
  let checksum = -1;
  for (const byte of bytes) {
    checksum ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      checksum = (checksum >>> 1) ^ (0xedb88320 & -(checksum & 1));
    }
  }
  return (checksum ^ -1) >>> 0;
}

// Package the workbook XML in a ZIP with uncompressed entries.
function storeZip(files) {
  const localParts = [];
  const directoryParts = [];
  const encoder = new TextEncoder();
  let localOffset = 0;
  let directoryLength = 0;

  for (const [path, xml] of Object.entries(files)) {
    const name = encoder.encode(path);
    const data = encoder.encode(xml);
    const crc = crc32(data);

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(12, 33, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, data.length, true);
    local.setUint32(22, data.length, true);
    local.setUint16(26, name.length, true);

    const central = new DataView(new ArrayBuffer(46));
    central.setUint32(0, 0x02014b50, true);
    central.setUint16(4, 20, true);
    central.setUint16(6, 20, true);
    central.setUint16(14, 33, true);
    central.setUint32(16, crc, true);
    central.setUint32(20, data.length, true);
    central.setUint32(24, data.length, true);
    central.setUint16(28, name.length, true);
    central.setUint32(42, localOffset, true);

    localParts.push(local.buffer, name, data);
    directoryParts.push(central.buffer, name);
    localOffset += local.byteLength + name.length + data.length;
    directoryLength += central.byteLength + name.length;
  }

  const end = new DataView(new ArrayBuffer(22));
  const count = Object.keys(files).length;
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, count, true);
  end.setUint16(10, count, true);
  end.setUint32(12, directoryLength, true);
  end.setUint32(16, localOffset, true);
  return [...localParts, ...directoryParts, end.buffer];
}

function downloadExcel(filename, rows) {
  const blob = new Blob(workbookBytes(rows), {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
