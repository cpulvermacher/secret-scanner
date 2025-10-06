import type { SecretResult, TabData } from "./background";
import { getActiveTabId } from "./browser";
import { filterWithReason } from "./filter";
import type { UserActionMessage } from "./messages";
import type { SecretType } from "./patterns";

// Get current tab and initialize UI
const currentTabId = await getActiveTabId();
let isDebuggerActive: boolean = false;
checkStatus(currentTabId);

// UI elements
const statusIndicator = document.getElementById(
    "statusIndicator",
) as HTMLElement;
const statusText = document.getElementById("statusText") as HTMLElement;
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

function startDebugger(tabId: number): void {
    // Start scanning first, then reload to catch all network requests
    chrome.runtime.sendMessage<UserActionMessage>(
        {
            type: "userAction",
            action: "startDebugger",
            tabId,
        },
        (response: { status: string }) => {
            if (response.status === "started") {
                isDebuggerActive = true;
                updateUI();

                pollForResults();

                chrome.tabs.reload(tabId);
            }
        },
    );
}

function stopDebugger(tabId: number): void {
    chrome.runtime.sendMessage<UserActionMessage>(
        {
            type: "userAction",
            action: "stopDebugger",
            tabId,
        },
        (response: { status: string }) => {
            if (response.status === "stopped") {
                isDebuggerActive = false;
                updateUI();
            }
        },
    );
}

function checkStatus(tabId: number): void {
    chrome.runtime.sendMessage<UserActionMessage>(
        {
            type: "userAction",
            action: "getStatus",
            tabId,
        },
        (tab: TabData) => {
            isDebuggerActive = tab.isDebuggerActive;
            updateUI();
            displayResults(tab);
        },
    );
}

function pollForResults(): void {
    if (isDebuggerActive) {
        checkStatus(currentTabId);
        setTimeout(pollForResults, 1000);
    }
}

function updateUI(): void {
    toggleButton.disabled = false;
    if (isDebuggerActive) {
        statusIndicator.className = "status-indicator active";
        statusText.textContent = "Scanning page for secrets...";
        toggleButton.textContent = "Stop Scanning";
    } else {
        statusIndicator.className = "status-indicator inactive";
        statusText.textContent = "Ready to scan";
        toggleButton.textContent = "Reload & Scan Page";
    }
}

function displayResults(tab: TabData): void {
    if (tab.results.length === 0) {
        resultsList.innerHTML =
            '<div class="no-results">No secrets found</div>';
        errorList.innerHTML = "";
        cautionText.className = "invisible";

        return;
    }

    const maxMatchLength = 1000;
    resultsList.innerHTML = tab.results
        .filter((secret) => filterWithReason(secret) === null)
        .map(
            (result: SecretResult) => `
    <div class="result-item">
      <div class="result-type">${escapeHtml(getTypeTitle(result.type))}</div>
      <div class="result-match">${escapeHtml(result.match.substring(0, maxMatchLength))}${result.match.length > maxMatchLength ? "..." : ""}</div>
      <div class="result-source">Source: ${formatSourceLink(result.source)}</div>
    </div>
  `,
        )
        .join("");

    const maxErrorLength = 200;
    errorList.innerHTML = tab.errors
        .map(
            (error) => `
    <div class="result-item">
      <div class="result-type">Error</div>
      <div class="result-match">${escapeHtml(error.error.substring(0, maxErrorLength))}${error.error.length > maxErrorLength ? "..." : ""}</div>
      <div class="result-source">Source: ${escapeHtml(error.scriptUrl)}</div>
    </div>
  `,
        )
        .join("");

    // Add click listeners to source links
    const sourceLinks = resultsList.querySelectorAll(".source-link");
    sourceLinks.forEach((link) => {
        link.addEventListener("click", (e) => {
            e.preventDefault();
            const url = (e.target as HTMLAnchorElement).href;
            if (url && isValidUrl(url)) {
                chrome.tabs.create({ url: `view-source:${url}` });
            }
        });
    });

    cautionText.className = "";
}

function escapeHtml(text: string): string {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

function isValidUrl(string: string): boolean {
    try {
        new URL(string);
        return true;
    } catch {
        return false;
    }
}

function formatSourceLink(source: string): string {
    if (isValidUrl(source)) {
        return `<a class="source-link" href="${encodeURI(source)}">${escapeHtml(source)}</a>`;
    }
    return escapeHtml(source);
}

function getTypeTitle(type: SecretType): string {
    switch (type) {
        case "privateKey":
            return "Private Key";
        case "stripeAccessToken":
            return "Stripe Access Token";
        case "slackBotToken":
            return "Slack Bot Token";
        case "googleApiKey":
            return "Google API Key";
        case "apiKey":
            return "API Key";
        case "password":
            return "Password";
    }
}
