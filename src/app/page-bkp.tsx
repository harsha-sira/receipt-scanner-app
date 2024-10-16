'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import AddReceipt from './AddReceipt'; // Your Add Receipt component
import ViewReceipts from './ViewReceipts'; // Your View Receipts component
import ExportReceipts from './ExportReceipts'; // Your Export Receipts component

export default function ReceiptManager() {
  const [activeTab, setActiveTab] = useState('add'); // Default to the Add tab
  const [receipts, setReceipts] = useState<any[]>([]);

  // Function to fetch receipts from the database
  const fetchReceipts = async () => {
    try {
      const response = await axios.get('http://localhost:3001/api/receipts'); // Make sure this endpoint is set up in your backend
      setReceipts(response.data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())); // Sort by date (most recent first)
    } catch (error) {
      console.error('Error fetching receipts:', error);
    }
  };

  useEffect(() => {
    if (activeTab === 'view' || activeTab === 'export') {
      fetchReceipts(); // Fetch receipts when viewing or exporting
    }
  }, [activeTab]);

  return (
    <div style={styles.container}>
      <h1 style={styles.heading}>Receipt Manager</h1>
      <div style={styles.buttonContainer}>
        <button onClick={() => setActiveTab('add')} style={styles.button}>ADD</button>
        <button onClick={() => setActiveTab('view')} style={styles.button}>VIEW</button>
        <button onClick={() => setActiveTab('export')} style={styles.button}>EXPORT</button>
      </div>

      {activeTab === 'add' && <AddReceipt />} {/* Your Add Receipt component */}
      {activeTab === 'view' && <ViewReceipts receipts={receipts} />} {/* Your View Receipts component */}
      {activeTab === 'export' && <ExportReceipts receipts={receipts} />} {/* Your Export Receipts component */}
    </div>
  );
}

const styles = {
  container: {
    padding: '20px',
    backgroundColor: '#f9f9f9',
    color: '#333',
    fontFamily: 'Arial, sans-serif',
  },
  heading: {
    color: '#0070f3',
    fontSize: '24px',
    marginBottom: '20px',
  },
  buttonContainer: {
    marginBottom: '20px',
  },
  button: {
    padding: '10px 20px',
    marginRight: '10px',
    backgroundColor: '#0070f3',
    color: '#fff',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
  },
};
