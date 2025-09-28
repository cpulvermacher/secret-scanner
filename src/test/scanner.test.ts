import { describe, it, expect } from "vitest";
import { scan } from "../scanner";

describe("scan", () => {
    it("should return empty array for content with no secrets", () => {
        const content = "const greeting = 'hello world';";
        const result = scan(content);
        expect(result).toEqual([]);
    });

    it("should detect private keys", () => {
        const content = `
				const privateKey = \`-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEA4qiXjy1QfUVmphYeT0QKJ4GV6nN5fD6l8LqNVlJGl2p3K5Hp
-----END RSA PRIVATE KEY-----\`;
			`;
        const result = scan(content);

        expect(result).toHaveLength(1);
        expect(result[0].type).toBe("privateKey");
        expect(result[0].match).toContain("-----BEGIN RSA PRIVATE KEY-----");
        expect(result[0].match).toContain("-----END RSA PRIVATE KEY-----");
    });

    it("should detect various PEM format private keys", () => {
        const content = `
				const rsa = \`-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEA4qiXjy1QfUVmphYeT0QKJ4GV6nN5fD6l8LqNVlJGl2p3K5Hp
-----END RSA PRIVATE KEY-----\`;
				const ec = \`-----BEGIN EC PRIVATE KEY-----
MHcCAQEEIBt1YzU1qJ5eQ3p2nGqN3L8QKJ4GV6nN5fD6l8LqNVlJGoAoGCCqGSM49
-----END EC PRIVATE KEY-----\`;
				const plain = \`-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDiqJePLVB9RWam
-----END PRIVATE KEY-----\`;
			`;
        const result = scan(content);

        expect(result).toHaveLength(3);
        expect(result.map((r) => r.type)).toEqual([
            "privateKey",
            "privateKey",
            "privateKey",
        ]);
    });

    it("should detect Stripe access tokens", () => {
        const content = `
				const testKey = 'sk_test_51H8L9fJyKzNmJqS7QkV4Kq3';
				const liveKey = 'sk_live_51H8L9fJyKzNmJqS7QkV4Kq3';
				const restrictedKey = 'rk_test_51H8L9fJyKzNmJqS7QkV4Kq3';
			`;
        const result = scan(content);

        expect(result).toHaveLength(3);
        result.forEach((secret) => {
            expect(secret.type).toBe("stripeAccessToken");
        });
        expect(result[0].match).toBe("sk_test_51H8L9fJyKzNmJqS7QkV4Kq3");
        expect(result[1].match).toBe("sk_live_51H8L9fJyKzNmJqS7QkV4Kq3");
        expect(result[2].match).toBe("rk_test_51H8L9fJyKzNmJqS7QkV4Kq3");
    });

    it("should detect Slack bot tokens", () => {
        const content = `
				const slackToken = 'xoxb-12345678901-12345678901-abcdefghijklmnopqrstuvwx';
			`;
        const result = scan(content);

        expect(result).toHaveLength(1);
        expect(result[0].type).toBe("slackBotToken");
        expect(result[0].match).toBe(
            "xoxb-12345678901-12345678901-abcdefghijklmnopqrstuvwx",
        );
    });

    it("should detect API keys with various formats", () => {
        const content = `
				const config = {
					api_key: "abc123def456",
					apiKey: 'xyz789uvw012',
					api-key = "another-secret-key"
				};
			`;
        const result = scan(content);

        expect(result).toHaveLength(3);
        result.forEach((secret) => {
            expect(secret.type).toBe("apiKey");
        });
    });

    it("should detect passwords with various formats", () => {
        const content = `
				const dbConfig = {
					password: "secretpassword123",
					passwd: 'anotherpass456'
				};
			`;
        const result = scan(content);

        expect(result).toHaveLength(2);
        expect(result[0].type).toBe("password");
        expect(result[0].match).toContain('"secretpassword123"');
        expect(result[1].type).toBe("password");
        expect(result[1].match).toContain("'anotherpass456'");
    });

    it("should detect multiple different secret types in one scan", () => {
        const content = `
				const config = {
					apiKey: "secret-api-key-123",
					password: "mypassword123",
					stripeKey: "sk_test_51H8L9fJyKzNmJqS7QkV4Kq3"
				};
				const privateKey = \`-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEA4qiXjy1QfUVmphYeT0QKJ4GV6nN5fD6l8LqNVlJGl2p3K5Hp
-----END RSA PRIVATE KEY-----\`;
			`;
        const result = scan(content);

        expect(result).toHaveLength(4);
        const types = result.map((r) => r.type).sort();
        expect(types).toEqual([
            "apiKey",
            "password",
            "privateKey",
            "stripeAccessToken",
        ]);
    });

    it("should return correct Secret object structure", () => {
        const content = 'const key = "sk_test_51H8L9fJyKzNmJqS7QkV4Kq3";';
        const result = scan(content);

        expect(result).toHaveLength(1);
        const secret = result[0];

        expect(secret.type).toBe("stripeAccessToken");
        expect(typeof secret.pattern).toBe("string");
        expect(typeof secret.match).toBe("string");
    });

    it("should handle multiline content correctly", () => {
        const content = `
				function getConfig() {
					return {
						database: {
							password: "db-secret-123"
						},
						api: {
							api_key: "api-key-456"
						}
					};
				}
			`;
        const result = scan(content);

        expect(result).toHaveLength(2);
        expect(result.some((s) => s.type === "password")).toBe(true);
        expect(result.some((s) => s.type === "apiKey")).toBe(true);
    });

    it("should be case insensitive for API keys and passwords", () => {
        const content = `
				const config = {
					API_KEY: "uppercase-api-key",
					Password: "mixed-case-password"
				};
			`;
        const result = scan(content);

        expect(result).toHaveLength(2);
        expect(result.some((s) => s.type === "apiKey")).toBe(true);
        expect(result.some((s) => s.type === "password")).toBe(true);
    });
});
