import { getActiveTabId } from "./util/browser";
import type { GetStatusMessage, SetIgnoredMessage } from "./util/messages";
import type { ScriptFetchError, SecretResult, TabData } from "./util/tabdata";

const maxMatchLength = 1000;
const maxErrorLength = 200;
const maxUrlLength = 120;

// UI elements
const loading = document.getElementById("loading") as HTMLElement;
const resultsList = document.getElementById("resultsList") as HTMLElement;
const errorList = document.getElementById("errorList") as HTMLElement;
const ignoredSection = document.getElementById("ignoredSection") as HTMLElement;
const ignoredSummary = document.getElementById("ignoredSummary") as HTMLElement;
const ignoredList = document.getElementById("ignoredList") as HTMLElement;
const cautionText = document.getElementById("caution") as HTMLElement;

// Get current tab and initialize UI
const currentTabId = await getActiveTabId();
checkStatus(currentTabId);

chrome.storage.session.onChanged.addListener((changes) => {
    const tabKey = `tab_${currentTabId}`;
    if (changes[tabKey]) {
        const tabData = changes[tabKey].newValue as TabData;

        displayResults(tabData.results);
        displayIgnored(tabData.ignored ?? []);
        displayErrors(tabData.errors);
    }
});

async function checkStatus(tabId: number) {
    const tab = await chrome.runtime.sendMessage<GetStatusMessage, TabData>({
        type: "userAction",
        action: "getStatus",
        tabId,
    });

    loading.className = "invisible";
    displayResults(tab.results);
    displayIgnored(tab.ignored ?? []);
    displayErrors(tab.errors);
}

async function setIgnored(result: SecretResult, ignored: boolean) {
    await chrome.runtime.sendMessage<SetIgnoredMessage>({
        type: "userAction",
        action: "setIgnored",
        tabId: currentTabId,
        site: result.site,
        match: result.match,
        ignored,
    });
    // UI is updated via storage.session.onChanged
}

function displayResults(results: SecretResult[]): void {
    // Clear existing content
    resultsList.replaceChildren();

    if (results.length === 0) {
        const noResults = document.createElement("div");
        noResults.className = "no-results";
        noResults.textContent = "No secrets found on this page.";
        resultsList.appendChild(noResults);
        cautionText.className = "invisible";

        return;
    }

    for (const result of results) {
        resultsList.appendChild(createResultItem(result, false));
    }

    cautionText.className = "";
}

function displayIgnored(ignored: SecretResult[]): void {
    ignoredList.replaceChildren();
    ignoredSection.classList.toggle("invisible", ignored.length === 0);
    ignoredSummary.textContent = `Ignored (${ignored.length})`;

    for (const result of ignored) {
        ignoredList.appendChild(createResultItem(result, true));
    }
}

function createResultItem(
    result: SecretResult,
    isIgnored: boolean
): HTMLElement {
    const resultItem = document.createElement("div");
    resultItem.className = `result-item result-item--${result.severity}`;

    const typeDiv = document.createElement("div");
    typeDiv.className = "result-type";

    const typeText = document.createElement("span");
    typeText.textContent = result.type;
    typeDiv.appendChild(typeText);

    const severityBadge = document.createElement("span");
    severityBadge.className = `severity-badge severity-${result.severity}`;
    severityBadge.textContent = result.severity;
    typeDiv.appendChild(severityBadge);

    resultItem.appendChild(typeDiv);

    const matchDiv = document.createElement("div");
    matchDiv.className = "result-match";
    matchDiv.textContent = truncateString(result.match, maxMatchLength);
    resultItem.appendChild(matchDiv);

    const sourceDiv = document.createElement("div");
    sourceDiv.className = "result-source";

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
        sourceDiv.appendChild(
            document.createTextNode(truncateString(result.source, maxUrlLength))
        );
    }

    resultItem.appendChild(sourceDiv);

    if (result.site) {
        const ignoreButton = document.createElement("button");
        ignoreButton.className = "link-button";
        ignoreButton.textContent = isIgnored
            ? "Stop ignoring"
            : result.site === "file:"
              ? "Ignore for file URLs"
              : `Ignore on ${result.site}`;
        ignoreButton.addEventListener("click", () => {
            ignoreButton.disabled = true;
            void setIgnored(result, !isIgnored);
        });
        resultItem.appendChild(ignoreButton);
    }

    return resultItem;
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

const linkableProtocols = new Set(["http:", "https:", "file:"]);

function isValidUrl(string: string): boolean {
    try {
        return linkableProtocols.has(new URL(string).protocol);
    } catch {
        return false;
    }
}

function truncateString(str: string, maxLength: number): string {
    return str.substring(0, maxLength) + (str.length > maxLength ? "..." : "");
}
