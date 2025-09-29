/** get id for current tab, or throw */
export async function getActiveTabId(): Promise<number> {
    const queryOptions = { active: true, currentWindow: true };
    // `tab` will either be a `tabs.Tab` instance or `undefined`.
    const [tab] = await chrome.tabs.query(queryOptions);
    if (tab.id === undefined) {
        throw new Error("Couldn't get active tab");
    }

    return tab.id;
}
