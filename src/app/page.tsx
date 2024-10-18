'use client';

import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { CSSProperties } from 'react';
import ExcelJS from 'exceljs';
import { useRouter } from 'next/navigation';

export default function ReceiptUploader() {
  const router = useRouter();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null); // To store the captured image data
  const [description, setDescription] = useState('');
  const [store, setStore] = useState('');
  const [priceWithGST, setPriceWithGST] = useState('');
  const [date, setDate] = useState('');
  const [purpose, setPurpose] = useState('Work');
  const [person, setPerson] = useState('Harsha');
  const [receipts, setReceipts] = useState<any[]>([]);
  const [statusMessage, setStatusMessage] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const receiptsPerPage = 10;

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<any>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null); // Ref for video element
  const [isCameraOpen, setIsCameraOpen] = useState(false); // To control camera modal
  const canvasRef = useRef<HTMLCanvasElement | null>(null);


  useEffect(() => {
    const fetchReceipts = async () => {
      try {
        const response = await axios.get('https://upload-backend-wsmc.onrender.com/api/receipts');
        // const response = await axios.get('http://localhost:3001/api/receipts');
        
        const sortedReceipts = response.data.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setReceipts(sortedReceipts);
      } catch (error) {
        console.error('Error fetching receipts:', error);
      }
    };

    fetchReceipts();
  }, []);

  const openCamera = async () => {
    setIsCameraOpen(true);
    setStatusMessage('');
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } } // Use the back camera
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    }
  };

  const closeCamera = () => {
    if (videoRef.current) {
      const stream = videoRef.current.srcObject as MediaStream;
      const tracks = stream.getTracks();
      tracks.forEach(track => track.stop()); // Stop all tracks (camera feed)
    }
    setIsCameraOpen(false); // Close the camera modal
  };

  const captureImage = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      canvasRef.current.width = videoRef.current.videoWidth;
      canvasRef.current.height = videoRef.current.videoHeight;
      context?.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
      const dataUrl = canvasRef.current.toDataURL('image/jpeg');
      setCapturedImage(dataUrl); // Set base64-encoded image
      setSelectedFile(null);
      // Stop the video stream after capturing the image
      const stream = videoRef.current.srcObject as MediaStream;
      const tracks = stream.getTracks();
      tracks.forEach(track => track.stop()); // Stop all tracks (camera feed)
  
      setIsCameraOpen(false); // Close camera after capturing image
      
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setSelectedFile(file);
    setCapturedImage(null);
    setStatusMessage('');
  };

  const handleUpload = async () => {
    // if (!selectedFile) return;

    const formData = new FormData();
    if (selectedFile) {
      formData.append('receipt', selectedFile);
    } else if (capturedImage) {
      formData.append('base64Image', capturedImage);
    } else {
      setStatusMessage('No image selected or captured.');
      return;
    }
    formData.append('description', description);
    formData.append('store', store);
    formData.append('priceWithGST', priceWithGST);
    formData.append('date', date);
    formData.append('purpose', purpose);
    formData.append('person', person);

    try {
      const response = await axios.post('https://upload-backend-wsmc.onrender.com/api/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      // const response = await axios.post('http://localhost:3001/api/upload', formData, {
      //   headers: { 'Content-Type': 'multipart/form-data' },
      // });
      setReceipts((prevReceipts) => [...prevReceipts, response.data]);
      setStatusMessage('Upload successful!');
      setCapturedImage(null);
      setSelectedFile(null);
      setDescription('');
      setStore('')
      setPriceWithGST('')
      setDate('')
      setPurpose('Work')
      setPerson('Harsha')
    } catch (error) {
      console.error('Error uploading and saving data:', error);
      setStatusMessage('Failed to upload receipt. Please try again.');
    }
  };

  const handleExport = async () => {
    if (receipts.length === 0) {
      console.log('No receipts to export');
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
        { header: 'Person', key: 'person', width: 15 },
        { header: 'Image URL', key: 'imageURL', width: 40 },
      ];

      receipts.forEach((receipt) => {
        worksheet.addRow({
          description: receipt.description,
          store: receipt.store,
          priceWithGST: receipt.priceWithGST,
          date: new Date(receipt.date).toLocaleDateString(),
          purpose: receipt.purpose,
          person: receipt.person,
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
      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }, 0);
    } catch (error) {
      console.error('Error exporting to Excel:', error);
    }
  };

  const indexOfLastReceipt = currentPage * receiptsPerPage;
  const indexOfFirstReceipt = indexOfLastReceipt - receiptsPerPage;
  const currentReceipts = receipts.slice(indexOfFirstReceipt, indexOfLastReceipt);
  const totalPages = Math.ceil(receipts.length / receiptsPerPage);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const openModal = (receipt: any) => {
    setSelectedReceipt(receipt);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedReceipt(null);
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.heading}>Receipt Upload</h1>

      <input type="file" onChange={handleFileChange} style={styles.fileInput} />

      <button onClick={openCamera} style={styles.cameraButton}>
        Open Camera
      </button>

      {isCameraOpen && (
        <div>
          <video ref={videoRef} style={styles.video} />
          <button onClick={captureImage} style={styles.captureButton}>Capture Image</button>
          <canvas ref={canvasRef} style={styles.canvas}></canvas>
        </div>
      )}

      {isCameraOpen && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <h2>Capture Image</h2>
            <video ref={videoRef} autoPlay style={styles.video} />
            <button onClick={captureImage} style={styles.button}>Capture</button>
            <button onClick={closeCamera} style={styles.button}>Close Camera</button>
          </div>
        </div>
      )}

      {capturedImage && <img src={capturedImage} alt="Captured" style={styles.capturedImage} />}

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

      <div style={styles.inputGroup}>
        <label style={styles.label}>Person:</label>
        <select value={person} onChange={(e) => setPerson(e.target.value)} style={styles.select}>
          <option value="Harsha">Harsha</option>
          <option value="Hesh">Hesh</option>
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

      <button onClick={() => router.push('/receipts')} style={styles.viewReceiptsButton}>
        View Receipts
      </button>

      
    </div>
  );
}

const styles: { [key: string]: CSSProperties } = {
  container: {
    padding: '20px',
    backgroundColor: '#fff',  // White background
    color: '#000',            // Black text
  },
  heading: {
    color: '#000',            // Black heading text
    fontSize: '24px',
    marginBottom: '20px',
  },
  subheading: {
    color: '#000',            // Black subheading text
    fontSize: '18px',
    marginTop: '30px',
  },
  fileInput: {
    marginBottom: '15px',
    padding: '5px',
    borderColor: '#000',      // Black border for inputs
    borderWidth: '1px',
    borderRadius: '5px',
  },
  inputGroup: {
    marginBottom: '15px',
  },
  label: {
    display: 'block',
    marginBottom: '5px',
    color: '#000',            // Black label text
  },
  input: {
    padding: '8px',
    width: '100%',
    border: '1px solid #000', // Black border for text inputs
    borderRadius: '5px',
  },
  select: {
    padding: '8px',
    width: '100%',
    border: '1px solid #000', // Black border for select input
    borderRadius: '5px',
  },
  button: {
    padding: '10px 20px',
    backgroundColor: '#007bff',  // Blue button background
    color: '#fff',               // White button text
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
    marginRight: '10px',
  },
  exportButton: {
    padding: '10px 20px',
    backgroundColor: '#333',     // Dark grey/black export button
    color: '#fff',               // White text on the export button
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
  },
  cameraButton: {
    padding: '10px 20px',
    backgroundColor: 'gray',     // Dark grey/black export button
    color: '#fff',               // White text on the export button
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
  },
  tableContainer: {
    maxHeight: '300px',
    overflowY: 'scroll',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    marginTop: '20px',
  },
  th: {
    backgroundColor: '#007bff',  // Blue table header background
    color: '#fff',               // White text in table headers
    padding: '10px',
    border: '1px solid #000',    // Black border for table headers
  },
  td: {
    padding: '10px',
    border: '1px solid #000',    // Black border for table cells
  },
  pagination: {
    marginTop: '20px',
    display: 'flex',
    justifyContent: 'center',
  },
  pageButton: {
    padding: '8px 12px',
    margin: '0 5px',
    backgroundColor: '#007bff',  // Blue pagination buttons
    color: '#fff',               // White text on pagination buttons
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
  },
  detailsButton: {
    padding: '5px 10px',
    backgroundColor: '#007bff',  // Blue details button
    color: '#fff',               // White text on details button
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',  // Black transparent overlay
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    backgroundColor: '#fff',     // White modal background
    padding: '20px',
    borderRadius: '5px',
    width: '400px',
    textAlign: 'center',
    color: '#000',               // Black text inside modal
  },
  receiptImage: {
    width: '100%',
    height: 'auto',
    marginTop: '10px',
    borderRadius: '5px',
    border: '1px solid #000',    // Black border around the image
  },
  successMessage: {
    color: '#007bff',            // Blue success message text
    marginTop: '10px',
  },
  errorMessage: {
    color: '#ff0000',            // Red error message text
    marginTop: '10px',
  },
  viewReceiptsButton: {
    padding: '10px 20px',
    backgroundColor: '#28a745',
    color: '#fff',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
    marginTop: '20px',
  },
};
