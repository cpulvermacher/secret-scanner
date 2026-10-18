import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    getIgnoredHashes,
    getSite,
    hashSecret,
    setIgnored,
} from "../../util/ignorelist";

describe("getSite", () => {
    it("returns host for http(s) URLs", () => {
        expect(getSite("https://example.com/some/page?x=1")).toBe(
            "example.com"
        );
        expect(getSite("http://localhost:3000/")).toBe("localhost:3000");
    });

    it("returns protocol for URLs without host", () => {
        expect(getSite("file:///home/user/test.html")).toBe("file:");
    });

    it("returns input for invalid URLs", () => {
        expect(getSite("not a url")).toBe("not a url");
    });
});

describe("hashSecret", () => {
    it("returns hex SHA-256 hash", async () => {
        expect(await hashSecret("abc")).toBe(
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        );
    });
});

describe("setIgnored", () => {
    let storage: Record<string, unknown>;

    beforeEach(() => {
        storage = {};
        vi.stubGlobal("chrome", {
            storage: {
                local: {
                    get: async (key: string) =>
                        key in storage ? { [key]: storage[key] } : {},
                    set: async (items: Record<string, unknown>) => {
                        Object.assign(storage, items);
                    },
                    remove: async (key: string) => {
                        delete storage[key];
                    },
                },
            },
        });
        vi.stubGlobal("navigator", {
            locks: {
                request: (_name: string, callback: () => Promise<void>) =>
                    callback(),
            },
        });
    });

    it("adds and removes secrets per site", async () => {
        await setIgnored("example.com", "secret1", true);
        await setIgnored("example.com", "secret2", true);
        await setIgnored("other.com", "secret3", true);

        const hashes = await getIgnoredHashes("example.com");
        expect(hashes).toEqual(
            new Set([await hashSecret("secret1"), await hashSecret("secret2")])
        );
        expect(await getIgnoredHashes("other.com")).toEqual(
            new Set([await hashSecret("secret3")])
        );
        expect(await getIgnoredHashes("unknown.com")).toEqual(new Set());

        await setIgnored("example.com", "secret1", false);
        expect(await getIgnoredHashes("example.com")).toEqual(
            new Set([await hashSecret("secret2")])
        );
    });

    it("does not store secrets in plain text", async () => {
        await setIgnored("example.com", "secret1", true);
        expect(JSON.stringify(storage)).not.toContain("secret1");
    });

    it("removes storage key once list is empty", async () => {
        await setIgnored("example.com", "secret1", true);
        await setIgnored("example.com", "secret1", false);
        expect(storage).toEqual({});
    });
});
