let currentTabId: number | null = null;
let isScanning: boolean = false;

// Get current tab and initialize UI
chrome.tabs.query(
  { active: true, currentWindow: true },
  (tabs: chrome.tabs.Tab[]) => {
    if (tabs[0] && tabs[0].id) {
      currentTabId = tabs[0].id;
      updateUI();
      loadResults();
    }
  },
);

// UI elements
const statusIndicator = document.getElementById(
  "statusIndicator",
) as HTMLElement;
const statusText = document.getElementById("statusText") as HTMLElement;
const toggleButton = document.getElementById(
  "toggleButton",
) as HTMLButtonElement;
const resultsList = document.getElementById("resultsList") as HTMLElement;

// Toggle scanning
toggleButton.addEventListener("click", (): void => {
  if (isScanning) {
    stopScanning();
  } else {
    startScanning();
  }
});

function startScanning(): void {
  chrome.runtime.sendMessage(
    {
      action: "startScanning",
      tabId: currentTabId,
    },
    (response: { status: string }) => {
      if (response.status === "started") {
        isScanning = true;
        updateUI();

        // Poll for results every 2 seconds
        pollForResults();
      }
    },
  );
}

function stopScanning(): void {
  chrome.runtime.sendMessage(
    {
      action: "stopScanning",
      tabId: currentTabId,
    },
    (response: { status: string }) => {
      if (response.status === "stopped") {
        isScanning = false;
        updateUI();
      }
    },
  );
}

interface SecretResult {
  type: string;
  pattern: string;
  match: string;
  source: string;
  timestamp: string;
}

function loadResults(): void {
  chrome.runtime.sendMessage(
    {
      action: "getResults",
      tabId: currentTabId,
    },
    (response: { results?: SecretResult[] }) => {
      if (response && response.results) {
        displayResults(response.results);
      }
    },
  );
}

function pollForResults(): void {
  if (isScanning) {
    loadResults();
    setTimeout(pollForResults, 2000);
  }
}

function updateUI(): void {
  if (isScanning) {
    statusIndicator.className = "status-indicator active";
    statusText.textContent = "Scanning active";
    toggleButton.textContent = "Stop Scanning";
  } else {
    statusIndicator.className = "status-indicator inactive";
    statusText.textContent = "Not scanning";
    toggleButton.textContent = "Start Scanning";
  }
}

function displayResults(results: SecretResult[]): void {
  if (results.length === 0) {
    resultsList.innerHTML = '<div class="no-results">No secrets found</div>';
    return;
  }

  resultsList.innerHTML = results
    .map(
      (result: SecretResult) => `
    <div class="result-item">
      <div class="result-type">🚨 Secret Detected</div>
      <div class="result-match">${escapeHtml(result.match.substring(0, 100))}${result.match.length > 100 ? "..." : ""}</div>
      <div class="result-source">Source: ${escapeHtml(result.source)}</div>
    </div>
  `,
    )
    .join("");
}

function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// export {};
