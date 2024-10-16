// AddReceipt.tsx
'use client';

import { useState } from 'react';
import axios from 'axios';

export default function AddReceipt() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [description, setDescription] = useState('');
  const [store, setStore] = useState('');
  const [priceWithGST, setPriceWithGST] = useState('');
  const [date, setDate] = useState('');
  const [purpose, setPurpose] = useState('Work');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setSelectedFile(file);
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
      await axios.post('http://localhost:3001/api/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      // Reset form fields after upload
      setSelectedFile(null);
      setDescription('');
      setStore('');
      setPriceWithGST('');
      setDate('');
      setPurpose('Work');
    } catch (error) {
      console.error('Error uploading receipt:', error);
    }
  };

  return (
    <div>
      <h2>Add Receipt</h2>
      <input type="file" onChange={handleFileChange} />
      <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" />
      <input type="text" value={store} onChange={(e) => setStore(e.target.value)} placeholder="Store" />
      <input type="number" value={priceWithGST} onChange={(e) => setPriceWithGST(e.target.value)} placeholder="Price with GST" />
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      <select value={purpose} onChange={(e) => setPurpose(e.target.value)}>
        <option value="Work">Work</option>
        <option value="Uber">Uber</option>
        <option value="Ecom">Ecom</option>
      </select>
      <button onClick={handleUpload}>Upload</button>
    </div>
  );
}
