// ExportReceipts.tsx
'use client';

import ExcelJS from 'exceljs';

export default function ExportReceipts({ receipts }) {
  const handleExport = async () => {
    if (receipts.length === 0) {
      console.error('No receipts available to export.');
      return;
    }

    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Receipts');

      worksheet.columns = [
        { header: 'Description', key: 'description', width: 30 },
        { header: 'Store', key: 'store', width: 30 },
        { header: 'Price with GST', key: 'priceWithGST', width: 20 },
        { header: 'Date', key: 'date', width: 15 },
        { header: 'Purpose', key: 'purpose', width: 15 },
        { header: 'Image URL', key: 'imageURL', width: 40 },
      ];

      receipts.forEach((receipt) => {
        worksheet.addRow({
          description: receipt.description,
          store: receipt.store,
          priceWithGST: receipt.priceWithGST,
          date: new Date(receipt.date).toLocaleDateString(),
          purpose: receipt.purpose,
          imageURL: receipt.imageURL,
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'receipts_data.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting to Excel:', error);
    }
  };

  return (
    <div>
      <h2>Export Receipts</h2>
      <button onClick={handleExport}>Export to Excel</button>
    </div>
  );
}
