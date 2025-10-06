import type {
    ScriptDetectedMessage,
    Message,
    ErrorWhenFetchingScriptMessage,
    SecretsDetectedMessage,
} from "./messages";
import { updateIcon } from "./icon";
import { scan, type Secret } from "./scanner";

export type TabData = {
    isDebuggerActive: boolean;
    results: SecretResult[];
    errors: ScriptFetchError[];
};

export type ScriptFetchError = {
    scriptUrl: string;
    error: string;
};

export type SecretResult = Secret & {
    source: string; // source URL
    timestamp: string;
};

const tabs = new Map<number, TabData>(); // Track status per tab

function getOrCreateTabData(tabId: number): TabData {
    let tabData = tabs.get(tabId);
    if (!tabData) {
        tabData = {
            isDebuggerActive: false,
            results: [],
            errors: [],
        };
        tabs.set(tabId, tabData);
    }
    return tabData;
}

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
            if (message.action === "startDebugger") {
                startDebugger(message.tabId)
                    .then(() => {
                        sendResponse({ status: "started" });
                    })
                    .catch((error: Error) => {
                        sendResponse({ status: "error", error });
                    });
                return true; // Keep message channel open for async response
            } else if (message.action === "stopDebugger") {
                stopDebugger(message.tabId)
                    .then(() => {
                        sendResponse({ status: "stopped" });
                    })
                    .catch((error: Error) => {
                        sendResponse({ status: "error", error });
                    });
                return true; // Keep message channel open for async response
            } else if (message.action === "getStatus") {
                const tabData: TabData = tabs.get(message.tabId) ?? {
                    isDebuggerActive: false,
                    results: [],
                    errors: [],
                };
                sendResponse(tabData);
            }
        }
    },
);

async function startDebugger(tabId: number): Promise<void> {
    const tabData = getOrCreateTabData(tabId);

    updateIcon(tabId, "active", tabData.results.length);

    // Attach debugger to the tab
    await chrome.debugger.attach({ tabId }, "1.3");

    // Initialize tab tracking
    tabData.isDebuggerActive = true;
    tabs.set(tabId, tabData);

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
        const count = tabs.get(tabId)?.results.length || 0;
        updateIcon(tabId, "inactive", count);
    }
});

function handleDebuggerEvent(
    source: chrome.debugger.Debuggee,
    method: string,
    params?: object,
): void {
    const tabId = source.tabId;
    if (!tabId || !tabs.has(tabId)) return;

    if (method === "Debugger.scriptParsed") {
        handleScriptParsed(tabId, params as ScriptParsedParams);
    }
}

type ScriptParsedParams = {
    url?: string;
    scriptId: string;
};
async function handleScriptParsed(
    tabId: number,
    params?: ScriptParsedParams,
): Promise<void> {
    const tabData = tabs.get(tabId);
    if (!tabData?.isDebuggerActive) return;

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
    const tabData = getOrCreateTabData(tabId);

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

    if (tabData.results.length > 0) {
        chrome.runtime.sendMessage<SecretsDetectedMessage>({
            type: "secretsDetected",
            results: tabData.results,
        });
    }

    updateIcon(
        tabId,
        tabData.isDebuggerActive ? "active" : "inactive",
        tabData.results.length,
    );
}

async function handleScriptDetectedMessage(
    msg: ScriptDetectedMessage,
    tabId?: number,
) {
    if (!tabId) {
        console.error("No tab ID in scriptDetected message");
        return;
    }
    if (tabs.get(tabId)?.isDebuggerActive) {
        // with debugger active, we catch scripts via the Debugger API
        return;
    }
    console.log(
        "Secret Scanner: Script detected in tab",
        tabId,
        msg.documentUrl,
    );

    let content: string | undefined;
    const sourceUrl = "url" in msg ? msg.url : msg.documentUrl;
    if ("content" in msg) {
        content = msg.content;
    } else {
        try {
            console.log(`Secret Scanner: Fetching script ${msg.url}...`);
            const response = await fetch(msg.url);
            content = await response.text();
        } catch (error) {
            const tabData = getOrCreateTabData(tabId);
            tabData.errors.push({
                scriptUrl: msg.url,
                error: String(error),
            });
            chrome.runtime.sendMessage<ErrorWhenFetchingScriptMessage>({
                type: "errorWhenFetchingScript",
                errors: tabData.errors,
            });
            return;
        }
    }
    scanForSecrets(tabId, content, sourceUrl);
}

async function stopDebugger(tabId: number): Promise<void> {
    const tabData = getOrCreateTabData(tabId);
    tabData.isDebuggerActive = false;
    if (tabData.results.length === 0) {
        // Clear badge if no secrets were found
        chrome.action.setBadgeText({ text: "", tabId });
    }
    updateIcon(tabId, "inactive", tabData?.results?.length ?? 0);

    await chrome.debugger.detach({ tabId });
}

chrome.tabs.onActivated.addListener((activeInfo) => {
    const tabData = tabs.get(activeInfo.tabId);
    const count = tabData?.results.length ?? 0;
    updateIcon(
        activeInfo.tabId,
        tabData?.isDebuggerActive ? "active" : "inactive",
        count,
    );
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.url === undefined) {
        return; // url unchanged, nothing to do
    }

    const tabData = tabs.get(tabId);
    if (tabData) {
        const count = tabData.results.length;
        void updateIcon(tabId, "active", count);
    } else {
        void updateIcon(tabId, "inactive", 0);
    }
});

chrome.tabs.onRemoved.addListener((tabId: number) => {
    const tabData = tabs.get(tabId);
    if (tabData) {
        tabs.delete(tabId);
    }
    if (tabData?.isDebuggerActive) {
        void stopDebugger(tabId);
    }
});
