// 'app/receipts/page.tsx' (Receipts List Page)
'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { CSSProperties } from 'react';
import { useRouter } from 'next/navigation';

export default function ReceiptsList() {
  const router = useRouter();

  const [receipts, setReceipts] = useState<any[]>([]);
  const [filteredReceipts, setFilteredReceipts] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const receiptsPerPage = 15;


   // Filters state
   const [personFilter, setPersonFilter] = useState('');
   const [purposeFilter, setPurposeFilter] = useState('');


  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<any>(null);

  useEffect(() => {
    const fetchReceipts = async () => {
      try {
        const response = await axios.get('https://upload-backend-wsmc.onrender.com/api/receipts');
        const sortedReceipts = response.data.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setReceipts(sortedReceipts);
        setFilteredReceipts(sortedReceipts); // Initially set filteredReceipts to all receipts
      } catch (error) {
        console.error('Error fetching receipts:', error);
      }
    };

    fetchReceipts();
  }, []);

  const filterReceipts = () => {
    const filtered = receipts.filter((receipt) => {
      const matchesPerson = personFilter ? receipt.person.toLowerCase().trim() === personFilter.toLowerCase().trim() : true;
      const matchesPurpose = purposeFilter ? receipt.purpose.toLowerCase().trim() === purposeFilter.toLowerCase().trim() : true;
      
      return matchesPerson && matchesPurpose;
    });
  
    setFilteredReceipts(filtered);
    setCurrentPage(1); // Reset to the first page
  };

  const indexOfLastReceipt = currentPage * receiptsPerPage;
  const indexOfFirstReceipt = indexOfLastReceipt - receiptsPerPage;
  const currentReceipts = filteredReceipts.slice(indexOfFirstReceipt, indexOfLastReceipt);
  const totalPages = Math.ceil(filteredReceipts.length / receiptsPerPage);

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

  const resetFilters = () => {
    setPersonFilter('');
    setPurposeFilter('');
    setFilteredReceipts(receipts); // Reset to the full list of receipts
    setCurrentPage(1); // Reset pagination to the first page
  };
  

  return (
    <div style={styles.container}>
    <button onClick={() => router.push('/')} style={styles.backButton}>
      Back
    </button>
      <h1 style={styles.heading}>Receipts List</h1>
      
        {/* Filter Section */}
      <div style={styles.filterContainer}>
    <div>
        <label htmlFor="personFilter">Filter by Person:</label>
        <select
          id="personFilter"
          value={personFilter}
          onChange={(e) => setPersonFilter(e.target.value)}
          style={styles.select}
        >
          <option value="">All</option>
          <option value="Harsha">Harsha</option>
          <option value="Hesh">Hesh</option>
        </select>
      </div>
      <div>
        <label htmlFor="purposeFilter">Filter by Purpose:</label>
        <select
          id="purposeFilter"
          value={purposeFilter}
          onChange={(e) => setPurposeFilter(e.target.value)}
          style={styles.select}
        >
          <option value="">All</option>
          <option value="Work">Work</option>
          <option value="Uber">Uber</option>
          <option value="Ecom">Ecom</option>
        </select>
      </div>
        
        <button onClick={filterReceipts} style={styles.button}>Apply Filters</button>
        <button onClick={resetFilters} style={styles.resetButton}>Clear Filters</button>
      </div>

      <div style={styles.tableContainer}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th>Store</th>
              <th>Price with GST</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {currentReceipts.map((receipt) => (
              <tr key={receipt._id}>
                <td>{receipt.store}</td>
                <td>{receipt.priceWithGST}</td>
                <td>
                  <button onClick={() => openModal(receipt)} style={styles.detailsButton}>
                    More Details
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={styles.pagination}>
        {Array.from({ length: totalPages }, (_, index) => (
          <button
            key={index}
            onClick={() => handlePageChange(index + 1)}
            style={styles.pageButton}
          >
            {index + 1}
          </button>
        ))}
      </div>

      {/* Modal for showing receipt details */}
      {isModalOpen && selectedReceipt && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <h2>Receipt Details</h2>
            <p><strong>Description:</strong> {selectedReceipt.description}</p>
            <p><strong>Store:</strong> {selectedReceipt.store}</p>
            <p><strong>Price with GST:</strong> {selectedReceipt.priceWithGST}</p>
            <p><strong>Date:</strong> {new Date(selectedReceipt.date).toLocaleDateString()}</p>
            <p><strong>Purpose:</strong> {selectedReceipt.purpose}</p>
            <p><strong>Person:</strong> {selectedReceipt.person}</p>
            <img src={selectedReceipt.imageURL} alt="Receipt" style={styles.receiptImage} />
            <button onClick={closeModal} style={styles.button}>Close</button>
          </div>
        </div>
      )}
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
        textAlign: 'center',      // Center the text
        fontWeight: 'bold',       // Make it bold
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
    backButton: {
        padding: '10px 20px',
        backgroundColor: 'gray',  // Blue button background
        color: '#fff',               // White button text
        border: 'none',
        borderRadius: '5px',
        cursor: 'pointer',
        marginBottom: '20px',
      },
      
  };