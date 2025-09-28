export interface Secret {
    pattern: string;
    match: string; // the found secret
}

export function scan(content: string): Secret[] {
    const results: Secret[] = [];

    secretPatterns.forEach((pattern: RegExp) => {
        const matches = content.match(pattern);
        if (matches) {
            matches.forEach((match: string) => {
                results.push({
                    pattern: pattern.source,
                    match: match,
                });
            });
        }
    });

    return results;
}

const secretPatterns: RegExp[] = [
    /-----BEGIN .*PRIVATE KEY-----[\s\S]*?-----END .*PRIVATE KEY-----/g,
    /sk_live_[a-zA-Z0-9]{24}/g, // Stripe secret key
    /xoxb-[0-9]{11}-[0-9]{11}-[a-zA-Z0-9]{24}/g, // Slack bot token
    /api[_-]?key\s*[:=]\s*['"][^'"]+['"]/gi,
];
