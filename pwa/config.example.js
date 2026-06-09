// Copy this file to config.js and fill in your values.
// config.js is gitignored — your credentials never leave your machine.
window.BILL_CONFIG = {
  CLIENT_ID: 'YOUR_GOOGLE_CLIENT_ID',   // from Google Cloud Console → Credentials

  // Optional — enables AI-based filename extraction (merchant, date, amount).
  // If blank, filenames fall back to folder + timestamp.
  // Get a key: console.cloud.google.com → APIs & Services → Credentials → API key
  // Restrict the key to "Generative Language API" and your site's domain.
  GEMINI_API_KEY: '',

  FOLDERS: [
    { name: 'Groceries', id: 'DRIVE_FOLDER_ID_1' },
    { name: 'Utilities', id: 'DRIVE_FOLDER_ID_2' },
    { name: 'Medical',   id: 'DRIVE_FOLDER_ID_3' },
    { name: 'Other',     id: 'DRIVE_FOLDER_ID_4' },
  ],
};
