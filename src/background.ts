interface TabData {
  scanning: boolean;
  results: SecretResult[];
}

interface SecretResult {
  type: string;
  pattern: string;
  match: string;
  source: string;
  timestamp: string;
}

let activeTabs = new Map<number, TabData>(); // Track active scanning sessions

interface Message {
  action: string;
  tabId: number;
}

// Message handling from popup
chrome.runtime.onMessage.addListener(
  (
    message: Message,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: any) => void,
  ) => {
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
  },
);

async function startScanning(tabId: number): Promise<void> {
  try {
    // Clear any existing badge
    updateBadge(tabId, 0);

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

function setupEventListeners(tabId: number): void {
  // Listen for script parsed events
  chrome.debugger.onEvent.addListener(
    (source: chrome.debugger.Debuggee, method: string, params?: any) => {
      if (source.tabId === tabId && method === "Debugger.scriptParsed") {
        handleScriptParsed(tabId, params);
      }
    },
  );

  // Listen for network response events
  chrome.debugger.onEvent.addListener(
    (source: chrome.debugger.Debuggee, method: string, params?: any) => {
      if (source.tabId === tabId && method === "Network.responseReceived") {
        handleNetworkResponse(tabId, params);
      }
    },
  );
}

async function handleScriptParsed(tabId: number, params: any): Promise<void> {
  const tabData = activeTabs.get(tabId);
  if (!tabData || !tabData.scanning) return;

  try {
    // Get the script source
    const result = (await chrome.debugger.sendCommand(
      { tabId },
      "Debugger.getScriptSource",
      { scriptId: params.scriptId },
    )) as { scriptSource?: string };

    if (result && result.scriptSource) {
      scanForSecrets(tabId, result.scriptSource, params.url || "inline script");
    }
  } catch (error) {
    console.error("Failed to get script source:", error);
  }
}

async function handleNetworkResponse(
  tabId: number,
  params: any,
): Promise<void> {
  const tabData = activeTabs.get(tabId);
  if (!tabData || !tabData.scanning) return;

  const response = params.response;

  // Only process JavaScript files
  if (response.mimeType && response.mimeType.includes("javascript")) {
    try {
      // Get response body
      const result = (await chrome.debugger.sendCommand(
        { tabId },
        "Network.getResponseBody",
        { requestId: params.requestId },
      )) as { body?: string };

      if (result && result.body) {
        scanForSecrets(tabId, result.body, response.url);
      }
    } catch (error) {
      console.error("Failed to get response body:", error);
    }
  }
}

function scanForSecrets(tabId: number, content: string, source: string): void {
  const tabData = activeTabs.get(tabId);
  if (!tabData) return;

  // Simple secret patterns - can be extended
  const secretPatterns: RegExp[] = [
    /-----BEGIN PRIVATE KEY-----/g,
    /-----BEGIN RSA PRIVATE KEY-----/g,
    /-----BEGIN EC PRIVATE KEY-----/g,
    /sk_live_[a-zA-Z0-9]{24}/g, // Stripe secret key
    /xoxb-[0-9]{11}-[0-9]{11}-[a-zA-Z0-9]{24}/g, // Slack bot token
    /api[_-]?key\s*[:=]\s*['"][^'"]+['"]/gi,
  ];

  secretPatterns.forEach((pattern: RegExp) => {
    const matches = content.match(pattern);
    if (matches) {
      matches.forEach((match: string) => {
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

  // Update badge if new secrets were found
  if (tabData.results.length > previousCount) {
    updateBadge(tabId, tabData.results.length);
  }
}

async function stopScanning(tabId: number): Promise<void> {
  try {
    await chrome.debugger.detach({ tabId });
    const tabData = activeTabs.get(tabId);
    if (tabData && tabData.results.length === 0) {
      // Clear badge if no secrets were found
      chrome.action.setBadgeText({ text: "", tabId });
    }
    activeTabs.delete(tabId);
    console.log(`Stopped scanning tab ${tabId}`);
  } catch (error) {
    console.error("Failed to stop scanning:", error);
  }
}

function updateBadge(tabId: number, count: number): void {
  const badgeText = count > 0 ? count.toString() : "";
  const badgeColor = count > 0 ? "#FF4444" : "#4CAF50";

  chrome.action.setBadgeText({ text: badgeText, tabId });
  chrome.action.setBadgeBackgroundColor({ color: badgeColor, tabId });
}

// Clean up when tab is closed
chrome.tabs.onRemoved.addListener((tabId: number) => {
  if (activeTabs.has(tabId)) {
    stopScanning(tabId);
  }
});

export {};
