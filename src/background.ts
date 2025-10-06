import type { ScriptDetectedMessage, Message } from "./messages";
import { updateIcon } from "./icon";
import { scan, type Secret } from "./scanner";

interface TabData {
    scanning: boolean;
    results: SecretResult[];
}

export interface SecretResult extends Secret {
    source: string; // source URL
    timestamp: string;
}

const activeTabs = new Map<number, TabData>(); // Track active scanning sessions

// Message handling from popup / content script
chrome.runtime.onMessage.addListener(
    (
        message: Message,
        sender: chrome.runtime.MessageSender,
        sendResponse: (response?: object) => void,
    ) => {
        if (message.type === "scriptDetected") {
            handleScriptDetectedMessage(message, sender.tab?.id);
        } else if (message.type === "userAction") {
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
        }
    },
);

async function startScanning(tabId: number): Promise<void> {
    // Clear any existing badge
    updateIcon(tabId, "active", 0);

    // Attach debugger to the tab
    await chrome.debugger.attach({ tabId }, "1.3");

    // Initialize tab tracking
    const tabData = activeTabs.get(tabId) ?? { scanning: false, results: [] };
    tabData.scanning = true;
    activeTabs.set(tabId, tabData);

    // Enable Debugger domain to catch script parsing
    await chrome.debugger.sendCommand({ tabId }, "Debugger.enable");

    // Enable Runtime domain to catch script parsing
    await chrome.debugger.sendCommand({ tabId }, "Runtime.enable");
}

// Global event listener (only set up once)
if (!chrome.debugger.onEvent.hasListener(handleDebuggerEvent)) {
    chrome.debugger.onEvent.addListener(handleDebuggerEvent);
}

chrome.debugger.onDetach.addListener((source) => {
    const tabId = source.tabId;
    if (tabId !== undefined) {
        updateIcon(tabId, "inactive");
    }
});

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

    const results = scan(content);
    results.forEach((result) => {
        const isDuplicate = tabData.results.some(
            (existing) =>
                existing.match === result.match && existing.source === source,
        );

        if (!isDuplicate) {
            tabData.results.push({
                source: source,
                timestamp: new Date().toISOString(),
                ...result,
            });
        }
    });

    updateIcon(tabId, "active", tabData.results.length);
}

async function handleScriptDetectedMessage(
    msg: ScriptDetectedMessage,
    tabId?: number,
) {
    if (!tabId) {
        console.error("No tab ID in scriptDetected message");
        return;
    }

    let content;
    let sourceUrl = "url" in msg ? msg.url : msg.documentUrl;
    if ("content" in msg) {
        content = msg.content;
    } else {
        try {
            console.log(`Secret Scanner: Fetching script ${msg.url}...`);
            const response = await fetch(msg.url);
            content = await response.text();
        } catch (error) {
            //TODO notify popup about errors and show
            console.error(
                "Secret Scanner: Failed to fetch script:",
                msg.url,
                error,
            );
        }
    }
    if (!content) {
        return;
    }
    scanForSecrets(tabId, content, sourceUrl);
}

async function stopScanning(tabId: number): Promise<void> {
    const tabData = activeTabs.get(tabId);
    if (tabData) {
        tabData.scanning = false;
    }
    if (tabData && tabData.results.length === 0) {
        // Clear badge if no secrets were found
        chrome.action.setBadgeText({ text: "", tabId });
    }

    await chrome.debugger.detach({ tabId });
}

chrome.tabs.onActivated.addListener((activeInfo) => {
    const tabData = activeTabs.get(activeInfo.tabId);
    if (tabData) {
        const count = tabData.results.length;
        void updateIcon(activeInfo.tabId, "active", count);
    } else {
        void updateIcon(activeInfo.tabId, "inactive", 0);
    }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.url === undefined) {
        return; // url unchanged, nothing to do
    }

    const tabData = activeTabs.get(tabId);
    if (tabData) {
        const count = tabData.results.length;
        void updateIcon(tabId, "active", count);
    } else {
        void updateIcon(tabId, "inactive", 0);
    }
});

chrome.tabs.onRemoved.addListener((tabId: number) => {
    if (activeTabs.has(tabId)) {
        activeTabs.delete(tabId);
        void stopScanning(tabId);
    }
});
