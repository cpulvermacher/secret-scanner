import { secretPatterns, type SecretType } from "./patterns";

export interface Secret {
    type: SecretType;
    pattern: string;
    match: string; // the found secret
}

export function scan(content: string): Secret[] {
    const results: Secret[] = [];

    secretPatterns.forEach((secretPattern) => {
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
