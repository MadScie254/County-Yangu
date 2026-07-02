"use client";

import { Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PdfExportButton({ label }: { label: string }) {
  return (
    <Button className="mt-3" type="button" onClick={() => window.print()}>
      <FileText aria-hidden="true" size={18} />
      {label}
    </Button>
  );
}

export function CsvExportButton({ csvData }: { csvData: string }) {
  const downloadCsv = () => {
    const blob = new Blob([csvData], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "county-assembly-report.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Button variant="secondary" type="button" onClick={downloadCsv}>
      <Download aria-hidden="true" size={18} />
      CSV
    </Button>
  );
}
