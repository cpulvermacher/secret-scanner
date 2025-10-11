import { updateIcon } from "./icon";
import type { Message, ScriptDetectedMessage } from "./messages";
import { type Secret, scan } from "./scanner";

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

const tabDataLockName = "tabDataLock";

function getTabKey(tabId: number) {
    return `tab_${tabId}`;
}

// Use chrome.storage.session to persist state across service worker restarts
async function getTabData(tabId: number): Promise<TabData | undefined> {
    const key = getTabKey(tabId);
    const result = await chrome.storage.session.get(key);
    return result[key];
}

async function deleteTabData(tabId: number): Promise<void> {
    await navigator.locks.request(tabDataLockName, async () => {
        const key = getTabKey(tabId);
        await chrome.storage.session.remove(key);
    });
}

/** Update tab data with locking to prevent race conditions.
 *
 * Returns a copy of the updated tab data. (should be used read-only)
 */
async function updateTabData(
    tabId: number,
    update: (data: TabData) => Promise<void>,
): Promise<TabData> {
    return await navigator.locks.request(tabDataLockName, async () => {
        let tabData = await getTabData(tabId);
        if (!tabData) {
            tabData = {
                isDebuggerActive: false,
                results: [],
                errors: [],
            };
        }

        await update(tabData);

        await chrome.storage.session.set({ [getTabKey(tabId)]: tabData });
        return tabData;
    });
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
                getTabData(message.tabId)
                    .then((tabData) => {
                        const response: TabData = tabData ?? {
                            isDebuggerActive: false,
                            results: [],
                            errors: [],
                        };
                        sendResponse(response);
                    })
                    .catch((error: Error) => {
                        sendResponse({ status: "error", error });
                    });
                return true; // Keep message channel open for async response
            }
        }
    },
);

async function startDebugger(tabId: number): Promise<void> {
    await updateTabData(tabId, async (tabData) => {
        updateIcon(tabId, "active", tabData.results.length);

        // Initialize tab tracking
        tabData.isDebuggerActive = true;
    });

    // Attach debugger to the tab
    await chrome.debugger.attach({ tabId }, "1.3");

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
        void getTabData(tabId).then((tabData) => {
            const count = tabData?.results.length || 0;
            updateIcon(tabId, "inactive", count);
        });
    }
});

function handleDebuggerEvent(
    source: chrome.debugger.Debuggee,
    method: string,
    params?: object,
): void {
    const tabId = source.tabId;
    if (!tabId) return;

    if (method === "Debugger.scriptParsed") {
        void handleScriptParsed(tabId, params as ScriptParsedParams);
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
    const tabData = await getTabData(tabId);
    if (!tabData?.isDebuggerActive) return;

    try {
        // Get the script source
        const result = (await chrome.debugger.sendCommand(
            { tabId },
            "Debugger.getScriptSource",
            { scriptId: params?.scriptId },
        )) as { scriptSource?: string };

        if (result?.scriptSource) {
            await scanForSecrets(
                tabId,
                result.scriptSource,
                params?.url || "inline script",
            );
        }
    } catch (error) {
        console.error("Failed to get script source:", error);
    }
}

async function scanForSecrets(
    tabId: number,
    content: string,
    source: string,
): Promise<void> {
    await updateTabData(tabId, async (tabData) => {
        const results = scan(content);
        results.forEach((result) => {
            const isDuplicate = tabData.results.some(
                (existing) =>
                    existing.match === result.match &&
                    existing.source === source,
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
            console.log("secrets detected", tabId, tabData.results.length);
        }

        updateIcon(
            tabId,
            tabData.isDebuggerActive ? "active" : "inactive",
            tabData.results.length,
        );
    });
}

async function handleScriptDetectedMessage(
    msg: ScriptDetectedMessage,
    tabId?: number,
) {
    if (!tabId) {
        console.error("No tab ID in scriptDetected message");
        return;
    }

    const tabData = await getTabData(tabId);
    if (tabData?.isDebuggerActive) {
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
            await updateTabData(tabId, async (errorTabData) => {
                const isDuplicate = errorTabData.errors.some(
                    (e) => e.scriptUrl === msg.url,
                );
                if (!isDuplicate) {
                    errorTabData.errors.push({
                        scriptUrl: msg.url,
                        error: String(error),
                    });
                }
            });
            return;
        }
    }
    await scanForSecrets(tabId, content, sourceUrl);
}

async function stopDebugger(tabId: number): Promise<void> {
    const tabData = await updateTabData(tabId, async (tabData) => {
        tabData.isDebuggerActive = false;
    });

    if (tabData.results.length === 0) {
        // Clear badge if no secrets were found
        chrome.action.setBadgeText({ text: "", tabId });
    }
    updateIcon(tabId, "inactive", tabData?.results?.length ?? 0);

    await chrome.debugger.detach({ tabId });
}

chrome.tabs.onActivated.addListener((activeInfo) => {
    void getTabData(activeInfo.tabId).then((tabData) => {
        const count = tabData?.results.length ?? 0;
        updateIcon(
            activeInfo.tabId,
            tabData?.isDebuggerActive ? "active" : "inactive",
            count,
        );
    });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.url === undefined) {
        return; // url unchanged, nothing to do
    }

    void getTabData(tabId).then((tabData) => {
        if (tabData) {
            const count = tabData.results.length;
            void updateIcon(tabId, "active", count);
        } else {
            void updateIcon(tabId, "inactive", 0);
        }
    });
});

chrome.tabs.onRemoved.addListener((tabId: number) => {
    void getTabData(tabId).then((tabData) => {
        if (tabData) {
            console.log("Secret Scanner: Tab closed, cleaning up", tabId);
            void deleteTabData(tabId);
        }
        if (tabData?.isDebuggerActive) {
            void stopDebugger(tabId);
        }
    });
});
