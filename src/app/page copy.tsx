'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { CSSProperties } from 'react';
import ExcelJS from 'exceljs';


export default function ReceiptUploader() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [description, setDescription] = useState('');
  const [store, setStore] = useState('');
  const [priceWithGST, setPriceWithGST] = useState('');
  const [date, setDate] = useState('');
  const [purpose, setPurpose] = useState('Work');
  const [receipts, setReceipts] = useState<any[]>([]);
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    const fetchReceipts = async () => {
      try {
        const response = await axios.get('http://localhost:3001/api/receipts');
        // Sort receipts by date, most recent first
        const sortedReceipts = response.data.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
        setReceipts(response.data);
      } catch (error) {
        console.error('Error fetching receipts:', error);
      }
    };

    fetchReceipts();
  }, []); 

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setSelectedFile(file);
    setStatusMessage('');
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    const formData = new FormData();
    formData.append('receipt', selectedFile);
    formData.append('description', description);
    formData.append('store', store);
    formData.append('priceWithGST', priceWithGST);
    formData.append('date', date);
    formData.append('purpose', purpose);

    try {
      const response = await axios.post('http://localhost:3001/api/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setReceipts((prevReceipts) => [...prevReceipts, response.data]);

      setStatusMessage('Upload successful!');
    } catch (error) {
      console.error('Error uploading and saving data:', error);
      setStatusMessage('Failed to upload receipt. Please try again.');
    }
  };

  const handleExport  = async () => {
    
    if (receipts.length === 0) {
      console.log('No receipts to export');
      return;
    }
  
    try {
      // Create a new workbook and worksheet
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Receipts');
  
      // Add columns headers
      worksheet.columns = [
        { header: 'Description', key: 'description', width: 30 },
        { header: 'Store', key: 'store', width: 30 },
        { header: 'Price with GST', key: 'priceWithGST', width: 20 },
        { header: 'Date', key: 'date', width: 15 },
        { header: 'Purpose', key: 'purpose', width: 15 },
        { header: 'Image URL', key: 'imageURL', width: 40 },
      ];
  
      // Add rows from receipts
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
  
      // Generate buffer
      const buffer = await workbook.xlsx.writeBuffer();
      // Create a Blob from the buffer
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    // Create a link element
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'receipts_data.xlsx'; // Set the name for the downloaded file
    
    // Append to the body (required for Firefox)
    document.body.appendChild(a);
    a.click(); // Trigger the download

    // Clean up and remove the link
    setTimeout(() => {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url); // Free up memory
    }, 0);
      
    } catch (error) {
      console.error('Error exporting to Excel:', error);
    }
  };
  

  return (
    <div style={styles.container}>
      <h1 style={styles.heading}>Receipt Upload</h1>

      <input type="file" onChange={handleFileChange} style={styles.fileInput} />

      <div style={styles.inputGroup}>
        <label style={styles.label}>Description:</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          style={styles.input}
        />
      </div>

      <div style={styles.inputGroup}>
        <label style={styles.label}>Store:</label>
        <input
          type="text"
          value={store}
          onChange={(e) => setStore(e.target.value)}
          style={styles.input}
        />
      </div>

      <div style={styles.inputGroup}>
        <label style={styles.label}>Price with GST:</label>
        <input
          type="number"
          value={priceWithGST}
          onChange={(e) => setPriceWithGST(e.target.value)}
          style={styles.input}
        />
      </div>

      <div style={styles.inputGroup}>
        <label style={styles.label}>Date:</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          style={styles.input}
        />
      </div>

      <div style={styles.inputGroup}>
        <label style={styles.label}>Purpose:</label>
        <select value={purpose} onChange={(e) => setPurpose(e.target.value)} style={styles.select}>
          <option value="Work">Work</option>
          <option value="Uber">Uber</option>
          <option value="Ecom">Ecom</option>
        </select>
      </div>

      <button onClick={handleUpload} style={styles.button}>
        Upload and Save
      </button>

      {statusMessage && (
        <p style={statusMessage.includes('successful') ? styles.successMessage : styles.errorMessage}>
          {statusMessage}
        </p>
      )}


      <button onClick={handleExport} style={styles.exportButton}>
        Export to Excel
      </button>

      <h2 style={styles.subheading}>Saved Receipts</h2>
      <table style={styles.table}>
        <thead>
          <tr>
            <th>Description</th>
            <th>Store</th>
            <th>Price with GST</th>
            <th>Date</th>
            <th>Purpose</th>
            <th>Image</th>
          </tr>
        </thead>
        <tbody>
          {receipts.map((receipt) => (
            <tr key={receipt._id}>
              <td>{receipt.description}</td>
              <td>{receipt.store}</td>
              <td>{receipt.priceWithGST}</td>
              <td>{new Date(receipt.date).toLocaleDateString()}</td>
              <td>{receipt.purpose}</td>
              <td>
                <a href={receipt.imageURL} target="_blank" rel="noopener noreferrer">
                  View Image
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const styles: { [key: string]: CSSProperties } = {
  container: {
    padding: '20px',
    backgroundColor: '#f9f9f9',
    color: '#333',
    fontFamily: 'Arial, sans-serif',
  },
  heading: {
    color: '#0070f3', // Blue color
    fontSize: '24px',
    marginBottom: '20px',
  },
  subheading: {
    color: '#333',
    fontSize: '18px',
    marginTop: '30px',
  },
  fileInput: {
    marginBottom: '15px',
    padding: '5px',
    borderColor: '#0070f3',
    borderWidth: '1px',
    borderRadius: '5px',
  },
  inputGroup: {
    marginBottom: '15px',
  },
  label: {
    display: 'block',
    marginBottom: '5px',
    color: '#333',
  },
  input: {
    padding: '8px',
    width: '100%',
    border: '1px solid #0070f3',
    borderRadius: '5px',
  },
  select: {
    padding: '8px',
    width: '100%',
    border: '1px solid #0070f3',
    borderRadius: '5px',
  },
  button: {
    padding: '10px 20px',
    backgroundColor: '#0070f3',
    color: '#fff',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
    marginRight: '10px',
  },
  exportButton: {
    padding: '10px 20px',
    backgroundColor: '#333',
    color: '#fff',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    marginTop: '20px',
  },
  th: {
    backgroundColor: '#0070f3',
    color: '#fff',
    padding: '10px',
    border: '1px solid #333',
  },
  td: {
    padding: '10px',
    border: '1px solid #333',
  },
};
