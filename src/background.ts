let activeTabs = new Map(); // Track active scanning sessions

// Message handling from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "startScanning") {
    startScanning(message.tabId);
    sendResponse({ status: "started" });
  } else if (message.action === "stopScanning") {
    stopScanning(message.tabId);
    sendResponse({ status: "stopped" });
  } else if (message.action === "getResults") {
    const results = activeTabs.get(message.tabId)?.results || [];
    sendResponse({ results });
  }
});

async function startScanning(tabId: number) {
  try {
    // Attach debugger to the tab
    await chrome.debugger.attach({ tabId }, "1.3");

    // Initialize tab tracking
    activeTabs.set(tabId, {
      scanning: true,
      results: [],
    });

    // Enable Runtime domain to catch script parsing
    await chrome.debugger.sendCommand({ tabId }, "Runtime.enable");

    // Enable Network domain to intercept responses
    await chrome.debugger.sendCommand({ tabId }, "Network.enable");

    console.log(`Started scanning tab ${tabId}`);

    // Set up event listeners for this tab
    setupEventListeners(tabId);
  } catch (error) {
    console.error("Failed to start scanning:", error);
  }
}

function setupEventListeners(tabId: number) {
  // Listen for script parsed events
  chrome.debugger.onEvent.addListener((source, method, params) => {
    if (source.tabId === tabId && method === "Debugger.scriptParsed") {
      handleScriptParsed(tabId, params);
    }
  });

  // Listen for network response events
  chrome.debugger.onEvent.addListener((source, method, params) => {
    if (source.tabId === tabId && method === "Network.responseReceived") {
      handleNetworkResponse(tabId, params);
    }
  });
}

async function handleScriptParsed(tabId, params) {
  const tabData = activeTabs.get(tabId);
  if (!tabData || !tabData.scanning) return;

  try {
    // Get the script source
    const result = await chrome.debugger.sendCommand(
      { tabId },
      "Debugger.getScriptSource",
      { scriptId: params.scriptId },
    );

    if (result.scriptSource) {
      scanForSecrets(tabId, result.scriptSource, params.url || "inline script");
    }
  } catch (error) {
    console.error("Failed to get script source:", error);
  }
}

async function handleNetworkResponse(tabId, params) {
  const tabData = activeTabs.get(tabId);
  if (!tabData || !tabData.scanning) return;

  const response = params.response;

  // Only process JavaScript files
  if (response.mimeType && response.mimeType.includes("javascript")) {
    try {
      // Get response body
      const result = await chrome.debugger.sendCommand(
        { tabId },
        "Network.getResponseBody",
        { requestId: params.requestId },
      );

      if (result.body) {
        scanForSecrets(tabId, result.body, response.url);
      }
    } catch (error) {
      console.error("Failed to get response body:", error);
    }
  }
}

function scanForSecrets(tabId, content, source) {
  const tabData = activeTabs.get(tabId);
  if (!tabData) return;

  // Simple secret patterns - can be extended
  const secretPatterns = [
    /-----BEGIN PRIVATE KEY-----/g,
    /-----BEGIN RSA PRIVATE KEY-----/g,
    /-----BEGIN EC PRIVATE KEY-----/g,
    /sk_live_[a-zA-Z0-9]{24}/g, // Stripe secret key
    /xoxb-[0-9]{11}-[0-9]{11}-[a-zA-Z0-9]{24}/g, // Slack bot token
  ];

  secretPatterns.forEach((pattern) => {
    const matches = content.match(pattern);
    if (matches) {
      matches.forEach((match) => {
        tabData.results.push({
          type: "secret_found",
          pattern: pattern.source,
          match: match,
          source: source,
          timestamp: new Date().toISOString(),
        });
      });
    }
  });
}

async function stopScanning(tabId: number) {
  try {
    await chrome.debugger.detach({ tabId });
    activeTabs.delete(tabId);
    console.log(`Stopped scanning tab ${tabId}`);
  } catch (error) {
    console.error("Failed to stop scanning:", error);
  }
}

// Clean up when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  if (activeTabs.has(tabId)) {
    stopScanning(tabId);
  }
});

