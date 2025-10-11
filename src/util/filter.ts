import type { SecretResult } from "./tabdata";

/** returns null for secrets that should be shown, and a false positive type for those that should be filtered out as likely false positives */
export function filterWithReason(secret: SecretResult): string | null {
    if (
        secret.source.startsWith("chrome-extension://") ||
        secret.source.startsWith("moz-extension://")
    ) {
        return "extension";
    }
    return null;
}
