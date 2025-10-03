export type SecretType = (typeof patterns)[number]["type"];
export type SecretPattern = {
    type: SecretType;
    pattern: RegExp;
    ignore?: RegExp;
};

// secret patterns, ordered from specific to generic
// this allows to identify e.g. the type of an API key instead of giving it a generic label
const patterns = [
    {
        type: "privateKey",
        pattern:
            /-----BEGIN .*PRIVATE KEY-----[\s\S]*?-----END .*PRIVATE KEY-----/g,
    },
    {
        type: "stripeAccessToken",
        pattern: /(?:sk|rk)_(?:test|live|prod)_[a-zA-Z0-9]{24}/g,
    },
    {
        type: "slackBotToken",
        pattern: /xoxb-[0-9]{11}-[0-9]{11}-[a-zA-Z0-9]{24}/g,
    },
    {
        type: "apiKey",
        pattern: /api[_-]?key\s*[:=]\s*['"][^'"]+['"]/gi,
        ignore: /['"]\.concat\(/i,
    },
    {
        type: "password",
        pattern: /passw(or)?d\s*[:=]\s*['"][^'"]+['"]/gi,
        ignore: /['"]([^'"]*password['"]|\.concat\()/i,
    },
] as const;

// exported as more generic type
export const secretPatterns: readonly SecretPattern[] = patterns;
