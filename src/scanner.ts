export interface Secret {
    type: SecretType;
    pattern: string;
    match: string; // the found secret
}

export type SecretType = (typeof secretPatterns)[number]["type"];

export function scan(content: string): Secret[] {
    const results: Secret[] = [];

    secretPatterns.forEach((secretPattern) => {
        const matches = content.match(secretPattern.pattern);
        if (matches) {
            matches.forEach((match: string) => {
                results.push({
                    type: secretPattern.type,
                    pattern: secretPattern.pattern.source,
                    match: match,
                });
            });
        }
    });

    return results;
}

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
    },
    {
        type: "password",
        pattern: /passw(or)?d\s*[:=]\s*['"][^'"]+['"]/gi,
    },
] as const;
