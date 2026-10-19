import { beforeEach, describe, expect, it, vi } from "vitest";
import { updateIcon } from "../util/icon";
import { getIgnoredHashes, hashSecret } from "../util/ignorelist";
import type { Message } from "../util/messages";
import type { SecretResult, TabData } from "../util/tabdata";

vi.mock("../util/icon", () => ({ updateIcon: vi.fn() }));

type Listener = (
    message: Message,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: object) => void
) => boolean | undefined;

const extensionId = "secret-scanner-id";
const tabId = 1;

function makeResult(
    match: string,
    source: string,
    site = "example.com"
): SecretResult {
    return {
        type: "Private Key",
        pattern: "pattern",
        match,
        severity: "high",
        source,
        site,
        timestamp: "2026-01-01T00:00:00.000Z",
    };
}

describe("setIgnored message", () => {
    let localStorage: Record<string, unknown>;
    let sessionStorage: Record<string, unknown>;
    let onMessage: Listener;

    function storageArea(storage: Record<string, unknown>) {
        return {
            get: async (key: string) =>
                key in storage ? { [key]: storage[key] } : {},
            set: async (items: Record<string, unknown>) => {
                Object.assign(storage, items);
            },
            remove: async (key: string) => {
                delete storage[key];
            },
        };
    }

    function setIgnored(match: string, ignored: boolean, site = "example.com") {
        return new Promise((resolve) => {
            onMessage(
                {
                    type: "userAction",
                    action: "setIgnored",
                    tabId,
                    site,
                    match,
                    ignored,
                },
                { id: extensionId },
                resolve
            );
        });
    }

    function tabData() {
        return sessionStorage[`tab_${tabId}`] as TabData;
    }

    beforeEach(async () => {
        localStorage = {};
        sessionStorage = {};
        vi.stubGlobal("chrome", {
            runtime: {
                id: extensionId,
                onMessage: {
                    addListener: (listener: Listener) => {
                        onMessage = listener;
                    },
                },
            },
            tabs: {
                onActivated: { addListener: () => {} },
                onUpdated: { addListener: () => {} },
                onRemoved: { addListener: () => {} },
            },
            storage: {
                local: storageArea(localStorage),
                session: storageArea(sessionStorage),
            },
        });
        vi.stubGlobal("navigator", {
            locks: {
                request: (_name: string, callback: () => Promise<unknown>) =>
                    callback(),
            },
        });
        vi.mocked(updateIcon).mockClear();

        vi.resetModules();
        await import("../background");
    });

    it("moves all matching results to ignored list and back", async () => {
        const secretA1 = makeResult("secretA", "https://example.com/1.js");
        const secretA2 = makeResult("secretA", "https://example.com/2.js");
        const secretB = makeResult("secretB", "https://example.com/1.js");
        sessionStorage[`tab_${tabId}`] = {
            results: [secretA1, secretB, secretA2],
            ignored: [],
            errors: [],
        };

        expect(await setIgnored("secretA", true)).toEqual({});
        expect(tabData().results).toEqual([secretB]);
        expect(tabData().ignored).toEqual([secretA1, secretA2]);
        expect(await getIgnoredHashes("example.com")).toEqual(
            new Set([await hashSecret("secretA")])
        );
        expect(updateIcon).toHaveBeenLastCalledWith(tabId, [secretB]);

        expect(await setIgnored("secretA", false)).toEqual({});
        // restored results are appended after the remaining ones
        expect(tabData().results).toEqual([secretB, secretA1, secretA2]);
        expect(tabData().ignored).toEqual([]);
        expect(await getIgnoredHashes("example.com")).toEqual(new Set());
        expect(updateIcon).toHaveBeenLastCalledWith(tabId, [
            secretB,
            secretA1,
            secretA2,
        ]);
    });

    it("leaves other ignored results and other sites alone", async () => {
        const secretA = makeResult("secretA", "https://example.com/1.js");
        const secretB = makeResult("secretB", "https://example.com/1.js");
        const otherSiteA = makeResult(
            "secretA",
            "https://other.com/1.js",
            "other.com"
        );
        sessionStorage[`tab_${tabId}`] = {
            results: [secretA, otherSiteA],
            ignored: [secretB],
            errors: [],
        };

        await setIgnored("secretA", true);
        expect(tabData().results).toEqual([otherSiteA]);
        expect(tabData().ignored).toEqual([secretA, secretB]);
        expect(await getIgnoredHashes("other.com")).toEqual(new Set());
    });
});
