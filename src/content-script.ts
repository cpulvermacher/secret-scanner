import type { ScriptDetectedMessage } from "./util/messages";

// about:blank and about:srcdoc frames have no URL of their own, but share the
// origin of their parent, so use the closest ancestor with a real URL
function getDocumentUrl(): string {
    let win: Window = window;
    try {
        while (win.document.URL.startsWith("about:") && win.parent !== win) {
            win = win.parent;
        }
        return win.document.URL;
    } catch {
        // cross-origin ancestor (e.g. sandboxed frame)
        return document.URL;
    }
}

const documentUrl = getDocumentUrl();

async function handleScript(script: HTMLScriptElement) {
    if (script.textContent) {
        const msg: ScriptDetectedMessage = {
            type: "scriptDetected",
            content: script.textContent,
            documentUrl,
        };
        // sendMessage() seems to have a length limit of around ~50MB
        await chrome.runtime.sendMessage(msg);
    } else if (script.src) {
        const msg: ScriptDetectedMessage = {
            type: "scriptDetected",
            url: script.src,
            documentUrl,
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

const observeRoot = document.documentElement ?? document.body;
if (observeRoot) {
    observer.observe(observeRoot, { childList: true, subtree: true });
}
