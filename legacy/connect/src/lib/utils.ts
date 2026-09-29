import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
  }).format(amount);
};

export const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString("en-KE", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

export const generatePDFReport = (title: string, columns: string[], data: any[][], filename: string) => {
  const doc = new jsPDF();
  
  // Header
  doc.setFontSize(20);
  doc.setTextColor(16, 185, 129); // Emerald 500
  doc.text("CountyConnect System", 14, 22);
  
  doc.setFontSize(12);
  doc.setTextColor(55, 65, 81); // Gray 700
  doc.text(title, 14, 32);
  
  doc.setFontSize(10);
  doc.setTextColor(107, 114, 128); // Gray 500
  doc.text(`Generated on: ${new Date().toLocaleString('en-KE')}`, 14, 40);

  // Table
  autoTable(doc, {
    startY: 45,
    head: [columns],
    body: data,
    theme: 'grid',
    headStyles: { fillColor: [16, 185, 129] },
    alternateRowStyles: { fillColor: [249, 250, 251] },
  });

  // Footer
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(156, 163, 175);
    doc.text(
      `CountyConnect - Cryptographically Verified - Page ${i} of ${pageCount}`,
      14,
      doc.internal.pageSize.height - 10
    );
  }

  doc.save(`${filename}.pdf`);
};
