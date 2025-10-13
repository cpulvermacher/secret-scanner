import type { ScriptFetchError, SecretResult, TabData } from "./util/tabdata";
import { getActiveTabId } from "./util/browser";
import { filterWithReason } from "./util/filter";
import type { UserActionMessage } from "./util/messages";

const maxMatchLength = 1000;
const maxErrorLength = 200;
const maxUrlLength = 200;

// Get current tab and initialize UI
const currentTabId = await getActiveTabId();
let errorsFound = false;
let isDebuggerActive: boolean = false;
checkStatus(currentTabId);

// UI elements
const loading = document.getElementById("loading") as HTMLElement;
const debuggerStatus = document.getElementById("debuggerStatus") as HTMLElement;
const toggleButton = document.getElementById(
    "toggleButton",
) as HTMLButtonElement;
const resultsList = document.getElementById("resultsList") as HTMLElement;
const errorList = document.getElementById("errorList") as HTMLElement;
const cautionText = document.getElementById("caution") as HTMLElement;

toggleButton.addEventListener("click", (): void => {
    if (isDebuggerActive) {
        stopDebugger(currentTabId);
    } else {
        startDebugger(currentTabId);
    }
});

chrome.storage.session.onChanged.addListener((changes) => {
    const tabKey = `tab_${currentTabId}`;
    if (changes[tabKey]) {
        const tabData: TabData = changes[tabKey].newValue;

        displayResults(tabData.results);
        displayErrors(tabData.errors);
    }
});

async function startDebugger(tabId: number) {
    // Start scanning first, then reload to catch all network requests
    const response = await chrome.runtime.sendMessage<
        UserActionMessage,
        { status: string }
    >({
        type: "userAction",
        action: "startDebugger",
        tabId,
    });

    if (response.status === "started") {
        isDebuggerActive = true;
        updateUI();

        checkStatus(currentTabId);

        chrome.tabs.reload(tabId);
    }
}

async function stopDebugger(tabId: number) {
    const response = await chrome.runtime.sendMessage<
        UserActionMessage,
        { status: string }
    >({
        type: "userAction",
        action: "stopDebugger",
        tabId,
    });

    if (response.status === "stopped") {
        isDebuggerActive = false;
        updateUI();
    }
}

async function checkStatus(tabId: number) {
    const tab = await chrome.runtime.sendMessage<UserActionMessage, TabData>({
        type: "userAction",
        action: "getStatus",
        tabId,
    });

    isDebuggerActive = tab.isDebuggerActive;
    errorsFound = tab.errors.length > 0;

    updateUI();
    displayResults(tab.results);
    displayErrors(tab.errors);
}

function updateUI(): void {
    loading.className = "invisible";

    if (isDebuggerActive) {
        debuggerStatus.className = "";
        toggleButton.textContent = "Stop Full Scan";
    } else if ("debugger" in chrome && errorsFound) {
        debuggerStatus.className = "";
        toggleButton.textContent = "Start Full Scan & Reload";
    }
}

function displayResults(results: SecretResult[]): void {
    // Clear existing content
    resultsList.replaceChildren();

    if (results.length === 0) {
        const noResults = document.createElement("div");
        noResults.className = "no-results";
        noResults.textContent =
            "No secrets found. Any secrets detected will be listed here.";
        resultsList.appendChild(noResults);
        cautionText.className = "invisible";

        return;
    }

    const filteredResults = results.filter(
        (secret) => filterWithReason(secret) === null,
    );

    for (const result of filteredResults) {
        const resultItem = document.createElement("div");
        resultItem.className = "result-item";

        const typeDiv = document.createElement("div");
        typeDiv.className = "result-type";
        typeDiv.textContent = result.type;
        resultItem.appendChild(typeDiv);

        const matchDiv = document.createElement("div");
        matchDiv.className = "result-match";
        matchDiv.textContent = truncateString(result.match, maxMatchLength);
        resultItem.appendChild(matchDiv);

        const sourceDiv = document.createElement("div");
        sourceDiv.className = "result-source";
        sourceDiv.textContent = "Source: ";

        if (isValidUrl(result.source)) {
            const link = document.createElement("a");
            link.className = "source-link";
            link.href = encodeURI(result.source);
            link.textContent = truncateString(result.source, maxUrlLength);
            link.addEventListener("click", (e) => {
                e.preventDefault();
                const url = (e.target as HTMLAnchorElement).href;
                if (url && isValidUrl(url)) {
                    chrome.tabs.create({ url: `view-source:${url}` });
                }
            });
            sourceDiv.appendChild(link);
        } else {
            sourceDiv.appendChild(document.createTextNode(result.source));
        }

        resultItem.appendChild(sourceDiv);
        resultsList.appendChild(resultItem);
    }

    cautionText.className = "";
}

function displayErrors(errors: ScriptFetchError[]) {
    // Clear existing content
    errorList.replaceChildren();

    for (const error of errors) {
        const resultItem = document.createElement("div");
        resultItem.className = "result-item";

        const typeDiv = document.createElement("div");
        typeDiv.className = "result-type";
        typeDiv.textContent = "Error";
        resultItem.appendChild(typeDiv);

        const matchDiv = document.createElement("div");
        matchDiv.className = "result-match";
        matchDiv.textContent = truncateString(error.error, maxErrorLength);
        resultItem.appendChild(matchDiv);

        const sourceDiv = document.createElement("div");
        sourceDiv.className = "result-source";
        sourceDiv.textContent = `Source: ${error.scriptUrl}`;
        resultItem.appendChild(sourceDiv);

        errorList.appendChild(resultItem);
    }
}

function isValidUrl(string: string): boolean {
    try {
        new URL(string);
        return true;
    } catch {
        return false;
    }
}

function truncateString(str: string, maxLength: number): string {
    return str.substring(0, maxLength) + (str.length > maxLength ? "..." : "");
}
