import type { ScriptDetectedMessage } from "./messages";

async function handleScript(script: HTMLScriptElement) {
    if (script.textContent) {
        const msg: ScriptDetectedMessage = {
            type: "scriptDetected",
            content: script.textContent,
            documentUrl: document.URL,
        };
        // sendMessage() seems to have a length limit of around ~50MB
        await chrome.runtime.sendMessage(msg);
    } else if (script.src) {
        const msg: ScriptDetectedMessage = {
            type: "scriptDetected",
            url: script.src,
            documentUrl: document.URL,
        };
        await chrome.runtime.sendMessage(msg);
    }
}

Array.from(document.scripts).forEach((script) => {
    handleScript(script);
});

const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
            if (node.nodeName === "SCRIPT") {
                handleScript(node as HTMLScriptElement);
            }
        });
    });
});

observer.observe(document.body, { childList: true, subtree: true });
