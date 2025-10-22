import { scan } from "./secrets/scan";
import { updateIcon } from "./util/icon";
import { debugLog } from "./util/log";
import type { Message, ScriptDetectedMessage } from "./util/messages";
import {
    type TabData,
    deleteTabData,
    getTabData,
    updateTabData,
} from "./util/tabdata";

// ========================= event handlers =========================

// Message handling from popup / content script
chrome.runtime.onMessage.addListener(handleMessage);

chrome.tabs.onActivated.addListener((activeInfo) => {
    void getTabData(activeInfo.tabId).then((tabData) => {
        updateIcon(activeInfo.tabId, tabData?.results.length ?? 0);
    });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    //loading status happens on navigation or reload
    if (changeInfo.status !== "loading") {
        return; //ignore everything else
    }

    // Clear tab storage on navigation
    updateTabData(tabId, async (tabData) => {
        tabData.results = [];
        tabData.errors = [];

        // Update icon to reflect cleared state
        updateIcon(tabId, 0);
    });
});

chrome.tabs.onRemoved.addListener((tabId: number) => {
    void getTabData(tabId).then((tabData) => {
        if (tabData) {
            debugLog("Secret Scanner: Tab closed, cleaning up", tabId);
            void deleteTabData(tabId);
        }
    });
});

// ========================= handlers & logic =========================

/** handle messages from popup or content script */
function handleMessage(
    message: Message,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: object) => void,
) {
    if (message.type === "scriptDetected") {
        handleScriptDetectedMessage(message, sender.tab?.id);
    } else if (
        message.type === "userAction" &&
        message.action === "getStatus"
    ) {
        getTabData(message.tabId)
            .then((tabData) => {
                const response: TabData = tabData ?? {
                    results: [],
                    errors: [],
                };
                sendResponse(response);
            })
            .catch((error: Error) => {
                sendResponse({ status: "error", error });
            });
        return true;
    }
}

/** handler for scripts detected via content script */
async function handleScriptDetectedMessage(
    msg: ScriptDetectedMessage,
    tabId?: number,
) {
    if (!tabId) {
        console.error("No tab ID in scriptDetected message");
        return;
    }

    let content: string | undefined;
    const sourceUrl = "url" in msg ? msg.url : msg.documentUrl;
    if ("content" in msg) {
        content = msg.content;
    } else {
        try {
            debugLog(`Secret Scanner: Fetching script ${msg.url}...`);
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

        updateIcon(tabId, tabData.results.length);
    });
}
