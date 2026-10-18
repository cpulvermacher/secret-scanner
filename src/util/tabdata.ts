import type { Secret } from "../secrets/scan";

export type TabData = {
    results: SecretResult[];
    ignored: SecretResult[]; // results the user marked as "known public, ignore"
    errors: ScriptFetchError[];
};

export type ScriptFetchError = {
    scriptUrl: string;
    error: string;
};

export type SecretResult = Secret & {
    source: string; // source URL
    site: string; // site of the page the secret was found on, see getSite()
    timestamp: string;
};

const tabDataLockName = "tabDataLock";

function getTabKey(tabId: number) {
    return `tab_${tabId}`;
}

// Use chrome.storage.session to persist state across service worker restarts
export async function getTabData(tabId: number): Promise<TabData | undefined> {
    const key = getTabKey(tabId);
    const result = await chrome.storage.session.get(key);
    const tabData = result[key] as TabData | undefined;
    if (tabData) {
        tabData.ignored ??= []; // missing in data stored by older versions
    }
    return tabData;
}

export async function deleteTabData(tabId: number): Promise<void> {
    await navigator.locks.request(tabDataLockName, async () => {
        const key = getTabKey(tabId);
        await chrome.storage.session.remove(key);
    });
}

/** Update tab data with locking to prevent race conditions.
 *
 * Returns a copy of the updated tab data. (should be used read-only)
 */
export async function updateTabData(
    tabId: number,
    update: (data: TabData) => Promise<void>
): Promise<TabData> {
    return await navigator.locks.request(tabDataLockName, async () => {
        let tabData = await getTabData(tabId);
        if (!tabData) {
            tabData = {
                results: [],
                ignored: [],
                errors: [],
            };
        }

        await update(tabData);

        await chrome.storage.session.set({ [getTabKey(tabId)]: tabData });
        return tabData;
    });
}
