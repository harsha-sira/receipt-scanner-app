// ViewReceipts.tsx
'use client';

export default function ViewReceipts({ receipts }) {
  return (
    <div>
      <h2>View Receipts</h2>
      <table>
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
                <a href={receipt.imageURL} target="_blank" rel="noopener noreferrer">View Image</a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
