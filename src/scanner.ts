export interface Secret {
    type: SecretType;
    pattern: string;
    match: string; // the found secret
}

export type SecretType = (typeof secretPatterns)[number]["type"];

export function scan(content: string): Secret[] {
    const results: Secret[] = [];

    typedPatterns.forEach((secretPattern) => {
        const matches = content.match(secretPattern.pattern);
        if (!matches) {
            return;
        }
        matches.forEach((match: string) => {
            // Skip if match should be ignored
            if (secretPattern.ignore?.test(match)) {
                return;
            }

            results.push({
                type: secretPattern.type,
                pattern: secretPattern.pattern.source,
                match: match,
            });
        });
    });

    return results;
}

type SecretPattern = {
    type: SecretType;
    pattern: RegExp;
    ignore?: RegExp;
};
const secretPatterns = [
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

const typedPatterns: readonly SecretPattern[] = secretPatterns;
