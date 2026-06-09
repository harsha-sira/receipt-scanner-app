'use strict';

// ─── Configuration ────────────────────────────────────────────────────────────
const CONFIG = window.BILL_CONFIG || { CLIENT_ID: '', GEMINI_API_KEY: '', FOLDERS: [] };

// ─── State ────────────────────────────────────────────────────────────────────
let tokenClient   = null;
let accessToken   = null;
let tokenExpiry   = 0;
let videoStream   = null;
let capturedBlob  = null;
let pendingUpload = false;

let selectedFolderIdx = Math.min(
  parseInt(localStorage.getItem('lastFolder') || '0', 10),
  Math.max(0, (CONFIG.FOLDERS?.length || 1) - 1)
);

// ─── DOM helpers ──────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

// ─── Service Worker ───────────────────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

// ─── iOS install banner ───────────────────────────────────────────────────────
(function checkInstallable() {
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (isIOS && !isStandalone) $('install-banner').hidden = false;
})();

// ─── GIS initialisation ───────────────────────────────────────────────────────
function onGISLoad() {
  if (!CONFIG.CLIENT_ID || !CONFIG.FOLDERS?.length) {
    showStatus('Copy config.example.js → config.js and fill in your credentials.', 'error');
    return;
  }

  renderFolderChips();

  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CONFIG.CLIENT_ID,
    scope: 'https://www.googleapis.com/auth/drive.file',
    callback: handleToken,
    error_callback: () => {},
  });

  tokenClient.requestAccessToken({ prompt: '' });
}

function handleToken(response) {
  if (response.error) {
    if (response.error !== 'interaction_required' && response.error !== 'access_denied') {
      showStatus('Sign-in error: ' + response.error, 'error');
    }
    showScreen('auth');
    pendingUpload = false;
    return;
  }

  accessToken = response.access_token;
  tokenExpiry = Date.now() + (response.expires_in - 60) * 1000;

  if (pendingUpload) {
    pendingUpload = false;
    _doUpload();
  } else {
    showScreen('camera');
    startCamera();
  }
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
function signIn() {
  if (!tokenClient) {
    showStatus('Config not loaded — check that config.js exists.', 'error');
    return;
  }
  tokenClient.requestAccessToken({ prompt: 'consent' });
}

// ─── Folder picker ────────────────────────────────────────────────────────────
function renderFolderChips() {
  document.querySelectorAll('.folder-chips').forEach(container => {
    container.innerHTML = '';
    CONFIG.FOLDERS.forEach((folder, idx) => {
      const btn = document.createElement('button');
      btn.className = 'chip' + (idx === selectedFolderIdx ? ' active' : '');
      btn.textContent = folder.name;
      btn.setAttribute('aria-pressed', idx === selectedFolderIdx);
      btn.onclick = () => selectFolder(idx);
      container.appendChild(btn);
    });
  });
}

function selectFolder(idx) {
  selectedFolderIdx = idx;
  localStorage.setItem('lastFolder', idx);
  document.querySelectorAll('.folder-chips .chip').forEach((chip, i) => {
    chip.classList.toggle('active', i === idx);
    chip.setAttribute('aria-pressed', i === idx);
  });
}

// ─── Camera ───────────────────────────────────────────────────────────────────
async function startCamera() {
  hideStatus();
  try {
    videoStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
        width:  { ideal: 1920 },
        height: { ideal: 1080 },
      },
      audio: false,
    });
    $('video').srcObject = videoStream;
  } catch (err) {
    showStatus('Camera unavailable: ' + err.message, 'error');
    showScreen('auth');
  }
}

function stopCamera() {
  if (videoStream) {
    videoStream.getTracks().forEach(t => t.stop());
    videoStream = null;
  }
}

function capturePhoto() {
  const video  = $('video');
  const canvas = $('canvas');
  if (!video.videoWidth) {
    showStatus('Camera not ready yet — try again.', 'error');
    return;
  }
  canvas.width  = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);

  canvas.toBlob(blob => {
    if (!blob) { showStatus('Capture failed.', 'error'); return; }
    capturedBlob = blob;
    $('preview').src = URL.createObjectURL(blob);
    stopCamera();
    showScreen('preview');
  }, 'image/jpeg', 0.92);
}

// ─── AI bill reading (Gemini) ─────────────────────────────────────────────────
async function extractBillInfo(blob) {
  if (!CONFIG.GEMINI_API_KEY) return null;

  const base64 = await blobToBase64(blob);

  const payload = {
    contents: [{
      parts: [
        {
          text: [
            'You are reading a bill or receipt photo.',
            'Reply with ONLY a JSON object — no markdown, no extra text.',
            'Fields:',
            '  merchant  — business/store name, title-case, max 25 chars, letters and spaces only',
            '  date      — date on the receipt, format YYYY-MM-DD; use today if not visible',
            '  amount    — total amount paid as a plain number e.g. "42.50"; omit currency symbol',
            'If a field cannot be determined, use an empty string.',
            'Example: {"merchant":"Woolworths","date":"2024-03-15","amount":"42.50"}',
          ].join('\n'),
        },
        {
          inline_data: { mime_type: 'image/jpeg', data: base64 },
        },
      ],
    }],
    generationConfig: { temperature: 0, maxOutputTokens: 100 },
  };

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${CONFIG.GEMINI_API_KEY}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
  );

  if (!res.ok) return null;

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) return null;

  try {
    // Strip accidental markdown fences if the model adds them
    const clean = text.replace(/^```[a-z]*\n?|\n?```$/g, '').trim();
    return JSON.parse(clean);
  } catch {
    return null;
  }
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// ─── Upload ───────────────────────────────────────────────────────────────────
function uploadToDrive() {
  if (!capturedBlob) return;

  if (!accessToken || Date.now() >= tokenExpiry) {
    pendingUpload = true;
    tokenClient.requestAccessToken({ prompt: '' });
    return;
  }

  _doUpload();
}

async function _doUpload() {
  showScreen('uploading');

  const folder = CONFIG.FOLDERS[selectedFolderIdx];

  // Step 1 — read the bill with Gemini (skipped if no API key)
  let billInfo = null;
  if (CONFIG.GEMINI_API_KEY) {
    $('upload-msg').textContent = 'Reading bill…';
    try {
      billInfo = await extractBillInfo(capturedBlob);
    } catch {
      // non-fatal — fall through to timestamp filename
    }
  }

  // Step 2 — upload
  $('upload-msg').textContent = 'Uploading to Google Drive…';

  const filename = buildFilename(folder.name, billInfo);
  const metadata = { name: filename, mimeType: 'image/jpeg', parents: [folder.id] };

  const body = new FormData();
  body.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  body.append('file', capturedBlob, filename);

  try {
    const res = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
      { method: 'POST', headers: { Authorization: 'Bearer ' + accessToken }, body }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || `HTTP ${res.status}`);

    $('success-filename').textContent = data.name;
    $('success-folder').textContent   = folder.name;
    const link = $('success-link');
    link.href   = data.webViewLink || '#';
    link.hidden = !data.webViewLink;
    showScreen('success');

    URL.revokeObjectURL($('preview').src);
    capturedBlob = null;

  } catch (err) {
    showScreen('preview');
    showStatus('Upload failed: ' + err.message, 'error');
  }
}

// ─── Navigation ───────────────────────────────────────────────────────────────
function retake()        { showScreen('camera'); startCamera(); }
function captureAnother(){ showScreen('camera'); startCamera(); }

// ─── UI helpers ───────────────────────────────────────────────────────────────
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $('screen-' + name).classList.add('active');
  hideStatus();
}

let _statusTimer = null;

function showStatus(msg, type) {
  const el = $('status');
  el.textContent = msg;
  el.className   = 'status ' + (type || '');
  el.hidden      = false;
  clearTimeout(_statusTimer);
  if (type !== 'error') _statusTimer = setTimeout(hideStatus, 4000);
}

function hideStatus() {
  clearTimeout(_statusTimer);
  $('status').hidden = true;
}

// ─── Filename builder ─────────────────────────────────────────────────────────
function buildFilename(folderName, info) {
  const slug = s => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const hex4 = () => Math.floor(Math.random() * 0xffff).toString(16).padStart(4, '0');

  if (info?.merchant) {
    // e.g. woolworths_2024-03-15_42.50_a3f2.jpg
    const parts = [slug(info.merchant)];
    if (info.date)   parts.push(info.date);
    if (info.amount) parts.push(info.amount.replace('.', '-'));
    parts.push(hex4());
    return parts.join('_') + '.jpg';
  }

  // Fallback: groceries_2024-03-15_14-30-05_a3f2.jpg
  return `${slug(folderName)}_${formatTimestamp(new Date())}_${hex4()}.jpg`;
}

function formatTimestamp(d) {
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
       + `_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
}
