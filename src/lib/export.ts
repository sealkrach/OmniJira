// Client-side only — call from "use client" components

export function exportCsv(filename: string, columns: string[], rows: (string | number)[][]) {
  const escape = (v: string | number) => {
    const s = String(v ?? "");
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const lines = [columns, ...rows].map((r) => r.map(escape).join(",")).join("\n");
  const blob = new Blob(["﻿" + lines], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportPdf(
  filename: string,
  title: string,
  columns: string[],
  rows: (string | number)[][]
) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF({ orientation: "landscape" });

  doc.setFontSize(14);
  doc.setTextColor(40, 40, 40);
  doc.text(title, 14, 16);
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text(`Exported ${new Date().toLocaleDateString("fr-FR")}`, 14, 22);

  autoTable(doc, {
    startY: 27,
    head: [columns],
    body: rows.map((r) => r.map(String)),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [67, 56, 202], textColor: 255 },
    alternateRowStyles: { fillColor: [248, 248, 255] },
  });

  doc.save(`${filename}.pdf`);
}
