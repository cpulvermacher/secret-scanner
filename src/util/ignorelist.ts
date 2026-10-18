// Per-site list of secrets the user marked as "known public, ignore".
// Only SHA-256 hashes of the secrets are stored, in chrome.storage.local.

const ignoreListLockName = "ignoreListLock";

function getSiteKey(site: string) {
    return `ignored_${site}`;
}

/** get the site (host incl. port) for a document URL, used to scope the ignore list */
export function getSite(documentUrl: string): string {
    try {
        const url = new URL(documentUrl);
        // e.g. file: URLs have no host
        return url.host || url.protocol;
    } catch {
        return documentUrl;
    }
}

export async function hashSecret(match: string): Promise<string> {
    const data = new TextEncoder().encode(match);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
}

/** returns hashes of all secrets ignored for the given site */
export async function getIgnoredHashes(site: string): Promise<Set<string>> {
    const key = getSiteKey(site);
    const result = await chrome.storage.local.get(key);
    return new Set((result[key] as string[] | undefined) ?? []);
}

/** add or remove a secret from the ignore list of the given site */
export async function setIgnored(
    site: string,
    match: string,
    ignored: boolean
): Promise<void> {
    const hash = await hashSecret(match);
    await navigator.locks.request(ignoreListLockName, async () => {
        const hashes = await getIgnoredHashes(site);
        if (ignored) {
            hashes.add(hash);
        } else {
            hashes.delete(hash);
        }

        const key = getSiteKey(site);
        if (hashes.size > 0) {
            await chrome.storage.local.set({ [key]: Array.from(hashes) });
        } else {
            await chrome.storage.local.remove(key);
        }
    });
}
