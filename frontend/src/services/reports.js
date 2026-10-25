
import { jsPDF } from "jspdf";

import { loadWarehouseSnapshot } from "./warehouseInsights";

function csvCell(value) {
  let content = String(value ?? "");

  // Prevent formula execution when a CSV is opened
  // in spreadsheet software.
  if (/^\s*[=+\-@\t\r]/.test(content)) {
    content = `'${content}`;
  }

  return `"${content.replace(/"/g, '""')}"`;
}

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;

  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function reportDate() {
  return new Date().toISOString().slice(0, 10);
}

export async function downloadInventoryCSV() {
  const snapshot = await loadWarehouseSnapshot();

  const headings = [
    "Item ID",
    "Product Name",
    "SKU",
    "Category",
    "Quantity",
    "Unit",
    "Current Zone",
    "Current Status",
    "Registration Timestamp",
    "Latest Update Timestamp",
    "Number of Movements",
  ];

  const rows = snapshot.items.map((item) => [
    item.id,
    item.name,
    item.sku,
    item.category,
    item.quantity,
    item.unit,
    item.zone,
    item.status,
    new Date(item.createdAt * 1000).toISOString(),
    new Date(item.updatedAt * 1000).toISOString(),
    Math.max(0, item.history.length - 1),
  ]);

  const csv = [
    headings.map(csvCell).join(","),
    ...rows.map((row) => row.map(csvCell).join(",")),
  ].join("\r\n");

  saveBlob(
    new Blob(["\uFEFF", csv], {
      type: "text/csv;charset=utf-8",
    }),
    `ChainStock_Inventory_${reportDate()}.csv`,
  );

  return rows.length;
}

export async function downloadMovementCSV() {
  const snapshot = await loadWarehouseSnapshot();

  const headings = [
    "Item ID",
    "Product",
    "Movement Number",
    "Zone",
    "Status",
    "Quantity",
    "Timestamp",
    "Actor",
    "Note",
  ];

  const rows = snapshot.items.flatMap((item) =>
    item.history.map((movement, index) => [
      item.id,
      item.name,
      index,
      movement.zone,
      movement.status,
      movement.quantity,
      new Date(movement.timestamp * 1000).toISOString(),
      movement.actor,
      movement.note,
    ]),
  );

  const csv = [
    headings.map(csvCell).join(","),
    ...rows.map((row) => row.map(csvCell).join(",")),
  ].join("\r\n");

  saveBlob(
    new Blob(["\uFEFF", csv], {
      type: "text/csv;charset=utf-8",
    }),
    `ChainStock_Movements_${reportDate()}.csv`,
  );

  return rows.length;
}

export async function downloadInventoryPDF() {
  const snapshot = await loadWarehouseSnapshot();

  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();

  const margin = 16;
  const right = width - margin;

  function drawHeader() {
    doc.setFillColor(12, 28, 45);
    doc.rect(0, 0, width, 38, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(23);
    doc.text("ChainStock", margin, 20);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("BLOCKCHAIN INVENTORY REPORT", margin, 29);

    doc.setTextColor(38, 57, 73);
  }

  drawHeader();

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(
    `Generated: ${new Date().toLocaleString("en-IN")}`,
    margin,
    50,
  );

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(
    `Snapshot block: ${snapshot.blockNumber}   |   Registered pallets: ${snapshot.items.length}`,
    margin,
    57,
  );

  doc.text(
    "Data source: deployed ChainStock WarehouseLedger contract",
    margin,
    64,
  );

  const columns = [
    { name: "ITEM ID", x: 16, max: 38 },
    { name: "PRODUCT", x: 58, max: 62 },
    { name: "SKU", x: 124, max: 34 },
    { name: "QTY / UNIT", x: 162, max: 32 },
    { name: "ZONE", x: 200, max: 35 },
    { name: "STATUS", x: 241, max: 37 },
  ];

  let y = 78;

  function drawTableHead() {
    doc.setFillColor(221, 242, 239);
    doc.rect(margin - 2, y - 6, right - margin + 4, 11, "F");

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(18, 92, 83);

    for (const column of columns) {
      doc.text(column.name, column.x, y);
    }

    y += 13;
  }

  drawTableHead();

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  for (const item of snapshot.items) {
    if (y > height - 22) {
      doc.addPage();
      y = 22;
      drawTableHead();
    }

    const fields = [
      item.id,
      item.name,
      item.sku,
      `${item.quantity} ${item.unit}`,
      item.zone,
      item.status,
    ];

    doc.setTextColor(35, 50, 62);

    fields.forEach((value, index) => {
      const column = columns[index];

      const fitted = doc.splitTextToSize(
        String(value),
        column.max,
      );

      doc.text(
        String(fitted[0] || ""),
        column.x,
        y,
      );
    });

    doc.setDrawColor(224, 231, 235);
    doc.line(margin - 2, y + 4, right + 2, y + 4);

    y += 12;
  }

  if (snapshot.items.length === 0) {
    doc.setTextColor(110, 125, 140);
    doc.text(
      "No registered inventory in this blockchain snapshot.",
      margin,
      y,
    );
  }

  const pages = doc.internal.getNumberOfPages();

  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    doc.setFontSize(8);
    doc.setTextColor(110, 125, 140);

    doc.text(
      "ChainStock | On-chain inventory snapshot",
      margin,
      height - 9,
    );

    doc.text(
      `Page ${page} of ${pages}`,
      right,
      height - 9,
      { align: "right" },
    );
  }

  doc.save(
    `ChainStock_Inventory_Report_${reportDate()}.pdf`,
  );

  return snapshot.items.length;
}
