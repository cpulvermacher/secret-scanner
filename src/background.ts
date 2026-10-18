import { scan } from "./secrets/scan";
import { filterWithReason } from "./util/filter";
import { updateIcon } from "./util/icon";
import {
    getIgnoredHashes,
    getSite,
    hashSecret,
    setIgnored,
} from "./util/ignorelist";
import { debugLog } from "./util/log";
import type {
    Message,
    ScriptDetectedMessage,
    SetIgnoredMessage,
} from "./util/messages";
import {
    deleteTabData,
    getTabData,
    type SecretResult,
    type TabData,
    updateTabData,
} from "./util/tabdata";

// ========================= event handlers =========================

// Message handling from popup / content script
chrome.runtime.onMessage.addListener(handleMessage);

chrome.tabs.onActivated.addListener((activeInfo) => {
    void getTabData(activeInfo.tabId).then((tabData) => {
        updateIcon(activeInfo.tabId, tabData?.results ?? []);
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
        tabData.ignored = [];
        tabData.errors = [];

        updateIcon(tabId, []);
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
    sendResponse: (response?: object) => void
) {
    if (message.type === "scriptDetected") {
        if (sender.tab?.id === undefined) {
            console.error("No tab ID in scriptDetected message");
            return;
        }

        handleScriptDetectedMessage(message, sender.tab.id);
    } else if (message.type === "userAction") {
        //check this is from our popup
        if (sender.id !== chrome.runtime.id || sender.tab !== undefined) {
            return;
        }

        if (message.action === "getStatus") {
            getTabData(message.tabId)
                .then((tabData) => {
                    const response: TabData = tabData ?? {
                        results: [],
                        ignored: [],
                        errors: [],
                    };
                    sendResponse(response);
                })
                .catch((error: Error) => {
                    sendResponse({ status: "error", error });
                });
            return true;
        } else if (message.action === "setIgnored") {
            handleSetIgnoredMessage(message)
                .then(() => sendResponse({}))
                .catch((error: Error) => {
                    sendResponse({ status: "error", error });
                });
            return true;
        }
    }
}

/** handler for marking a secret as ignored (or undoing it) in the popup */
async function handleSetIgnoredMessage(msg: SetIgnoredMessage) {
    await setIgnored(msg.site, msg.match, msg.ignored);

    await updateTabData(msg.tabId, async (tabData) => {
        // move all matching results (possibly from multiple scripts) to the other list
        const isAffected = (result: SecretResult) =>
            result.site === msg.site && result.match === msg.match;
        const all = [...tabData.results, ...tabData.ignored];
        const isIgnored = (result: SecretResult) =>
            isAffected(result) ? msg.ignored : tabData.ignored.includes(result);

        tabData.results = all.filter((result) => !isIgnored(result));
        tabData.ignored = all.filter(isIgnored);

        updateIcon(msg.tabId, tabData.results);
    });
}

/** handler for scripts detected via content script */
async function handleScriptDetectedMessage(
    msg: ScriptDetectedMessage,
    tabId: number
) {
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
                    (e) => e.scriptUrl === msg.url
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
    await scanForSecrets(tabId, content, sourceUrl, getSite(msg.documentUrl));
}

async function scanForSecrets(
    tabId: number,
    content: string,
    source: string,
    site: string
): Promise<void> {
    const results = scan(content);
    if (results.length === 0) {
        return;
    }

    const ignoredHashes = await getIgnoredHashes(site);
    const isIgnored = await Promise.all(
        results.map(async (result) =>
            ignoredHashes.has(await hashSecret(result.match))
        )
    );

    await updateTabData(tabId, async (tabData) => {
        results.forEach((result, index) => {
            const isDuplicate = [...tabData.results, ...tabData.ignored].some(
                (existing) =>
                    existing.match === result.match &&
                    existing.source === source
            );

            if (!isDuplicate) {
                const secretResult = {
                    source: source,
                    site: site,
                    timestamp: new Date().toISOString(),
                    ...result,
                };

                if (filterWithReason(secretResult) === null) {
                    if (isIgnored[index]) {
                        tabData.ignored.push(secretResult);
                    } else {
                        tabData.results.push(secretResult);
                    }
                }
            }
        });

        updateIcon(tabId, tabData.results);
    });
}
