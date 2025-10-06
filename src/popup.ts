import type { ScriptFetchError, SecretResult, TabData } from "./background";
import { getActiveTabId } from "./browser";
import { filterWithReason } from "./filter";
import type { Message, UserActionMessage } from "./messages";
import type { SecretType } from "./patterns";

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

chrome.runtime.onMessage.addListener((message: Message, sender): void => {
    if (message.type === "secretsDetected" && sender.tab?.id === currentTabId) {
        displayResults(message.results);
    } else if (
        message.type === "errorWhenFetchingScript" &&
        sender.tab?.id === currentTabId
    ) {
        displayErrors(message.errors);
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

                checkStatus(currentTabId);

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
            errorsFound = tab.errors.length > 0;

            updateUI();
            displayResults(tab.results);
            displayErrors(tab.errors);
        },
    );
}

function updateUI(): void {
    loading.className = "invisible";

    if (isDebuggerActive) {
        debuggerStatus.className = "";
        toggleButton.textContent = "Stop Debugger";
    } else if ("debugger" in chrome && errorsFound) {
        debuggerStatus.className = "";
        toggleButton.textContent = "Enable Debugger & Reload";
    }
}

function displayResults(results: SecretResult[]): void {
    if (results.length === 0) {
        resultsList.innerHTML =
            '<div class="no-results">No secrets found</div>';
        cautionText.className = "invisible";

        return;
    }

    resultsList.innerHTML = results
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

function displayErrors(errors: ScriptFetchError[]) {
    if (errors.length === 0) {
        errorList.innerHTML = "";
        return;
    }

    errorList.innerHTML = errors
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
        const displayedUrl =
            source.substring(0, maxUrlLength) +
            (source.length > maxUrlLength ? "..." : "");
        return `<a class="source-link" href="${encodeURI(source)}">${escapeHtml(displayedUrl)}</a>`;
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
