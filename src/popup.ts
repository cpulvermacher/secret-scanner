let currentTabId = null;
let isScanning = false;

// Get current tab and initialize UI
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  if (tabs[0]) {
    currentTabId = tabs[0].id;
    updateUI();
    loadResults();
  }
});

// UI elements
const statusIndicator = document.getElementById('statusIndicator');
const statusText = document.getElementById('statusText');
const toggleButton = document.getElementById('toggleButton');
const resultsList = document.getElementById('resultsList');

// Toggle scanning
toggleButton.addEventListener('click', () => {
  if (isScanning) {
    stopScanning();
  } else {
    startScanning();
  }
});

function startScanning() {
  chrome.runtime.sendMessage({
    action: 'startScanning',
    tabId: currentTabId
  }, (response) => {
    if (response.status === 'started') {
      isScanning = true;
      updateUI();

      // Poll for results every 2 seconds
      pollForResults();
    }
  });
}

function stopScanning() {
  chrome.runtime.sendMessage({
    action: 'stopScanning',
    tabId: currentTabId
  }, (response) => {
    if (response.status === 'stopped') {
      isScanning = false;
      updateUI();
    }
  });
}

function loadResults() {
  chrome.runtime.sendMessage({
    action: 'getResults',
    tabId: currentTabId
  }, (response) => {
    if (response && response.results) {
      displayResults(response.results);
    }
  });
}

function pollForResults() {
  if (isScanning) {
    loadResults();
    setTimeout(pollForResults, 2000);
  }
}

function updateUI() {
  if (isScanning) {
    statusIndicator.className = 'status-indicator active';
    statusText.textContent = 'Scanning active';
    toggleButton.textContent = 'Stop Scanning';
  } else {
    statusIndicator.className = 'status-indicator inactive';
    statusText.textContent = 'Not scanning';
    toggleButton.textContent = 'Start Scanning';
  }
}

function displayResults(results) {
  if (results.length === 0) {
    resultsList.innerHTML = '<div class="no-results">No secrets found</div>';
    return;
  }

  resultsList.innerHTML = results.map(result => `
    <div class="result-item">
      <div class="result-type">🚨 Secret Detected</div>
      <div class="result-match">${escapeHtml(result.match.substring(0, 100))}${result.match.length > 100 ? '...' : ''}</div>
      <div class="result-source">Source: ${escapeHtml(result.source)}</div>
    </div>
  `).join('');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}