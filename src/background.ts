interface TabData {
    scanning: boolean;
    results: SecretResult[];
}

export interface SecretResult {
    pattern: string;
    match: string; // the found secret
    source: string; // source URL
    timestamp: string;
}

const activeTabs = new Map<number, TabData>(); // Track active scanning sessions

interface Message {
    action: string;
    tabId: number;
}

// Message handling from popup
chrome.runtime.onMessage.addListener(
    (
        message: Message,
        _sender: chrome.runtime.MessageSender,
        sendResponse: (response?: object) => void,
    ) => {
        if (message.action === "startScanning") {
            startScanning(message.tabId)
                .then(() => {
                    sendResponse({ status: "started" });
                })
                .catch((error: Error) => {
                    sendResponse({ status: "error", error });
                });
            return true; // Keep message channel open for async response
        } else if (message.action === "stopScanning") {
            stopScanning(message.tabId)
                .then(() => {
                    sendResponse({ status: "stopped" });
                })
                .catch((error: Error) => {
                    sendResponse({ status: "error", error });
                });
            return true; // Keep message channel open for async response
        } else if (message.action === "getResults") {
            const results = activeTabs.get(message.tabId)?.results || [];
            sendResponse({ results });
        } else if (message.action === "getStatus") {
            const tabData = activeTabs.get(message.tabId);
            const isScanning = tabData?.scanning || false;
            sendResponse({ isScanning });
        }
    },
);

async function startScanning(tabId: number): Promise<void> {
    // Clear any existing badge
    updateBadge(tabId, 0);

    // Attach debugger to the tab
    await chrome.debugger.attach({ tabId }, "1.3");

    // Initialize tab tracking
    activeTabs.set(tabId, {
        scanning: true,
        results: [],
    });

    // Enable Debugger domain to catch script parsing
    await chrome.debugger.sendCommand({ tabId }, "Debugger.enable");

    // Enable Runtime domain to catch script parsing
    await chrome.debugger.sendCommand({ tabId }, "Runtime.enable");
}

// Global event listener (only set up once)
if (!chrome.debugger.onEvent.hasListener(handleDebuggerEvent)) {
    chrome.debugger.onEvent.addListener(handleDebuggerEvent);
}

function handleDebuggerEvent(
    source: chrome.debugger.Debuggee,
    method: string,
    params?: object,
): void {
    const tabId = source.tabId;
    if (!tabId || !activeTabs.has(tabId)) return;

    if (method === "Debugger.scriptParsed") {
        handleScriptParsed(tabId, params as ScriptParsedParams);
    }
}

interface ScriptParsedParams {
    url?: string;
    scriptId: string;
}
async function handleScriptParsed(
    tabId: number,
    params?: ScriptParsedParams,
): Promise<void> {
    const tabData = activeTabs.get(tabId);
    if (!tabData || !tabData.scanning) return;

    try {
        // Get the script source
        const result = (await chrome.debugger.sendCommand(
            { tabId },
            "Debugger.getScriptSource",
            { scriptId: params?.scriptId },
        )) as { scriptSource?: string };

        if (result?.scriptSource) {
            scanForSecrets(
                tabId,
                result.scriptSource,
                params?.url || "inline script",
            );
        }
    } catch (error) {
        console.error("Failed to get script source:", error);
    }
}

function scanForSecrets(tabId: number, content: string, source: string): void {
    const tabData = activeTabs.get(tabId);
    if (!tabData) return;

    const previousCount = tabData.results.length;

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
                const isDuplicate = tabData.results.some(
                    (existing) =>
                        existing.match === match && existing.source === source,
                );

                if (!isDuplicate) {
                    tabData.results.push({
                        pattern: pattern.source,
                        match: match,
                        source: source,
                        timestamp: new Date().toISOString(),
                    });
                }
            });
        }
    });

    // Update badge if new secrets were found
    if (tabData.results.length > previousCount) {
        updateBadge(tabId, tabData.results.length);
    }
}

async function stopScanning(tabId: number): Promise<void> {
    const tabData = activeTabs.get(tabId);
    if (tabData && tabData.results.length === 0) {
        // Clear badge if no secrets were found
        chrome.action.setBadgeText({ text: "", tabId });
    }
    activeTabs.delete(tabId);

    await chrome.debugger.detach({ tabId });
}

function updateBadge(tabId: number, count: number | undefined): void {
    const badgeText = count !== undefined ? count.toString() : "";
    const badgeColor = "#FF4444";

    chrome.action.setBadgeText({ text: badgeText, tabId });
    chrome.action.setBadgeBackgroundColor({ color: badgeColor, tabId });
}

chrome.tabs.onActivated.addListener((activeInfo) => {
    const count = activeTabs.get(activeInfo.tabId)?.results.length;
    void updateBadge(activeInfo.tabId, count);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.url === undefined) {
        return; // url unchanged, nothing to do
    }

    const count = activeTabs.get(tabId)?.results.length;
    void updateBadge(tabId, count);
});

// Clean up when tab is closed
chrome.tabs.onRemoved.addListener((tabId: number) => {
    if (activeTabs.has(tabId)) {
        void stopScanning(tabId);
    }
});
