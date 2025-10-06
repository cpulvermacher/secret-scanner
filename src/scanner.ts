import { secretPatterns, type SecretType } from "./patterns";

export type Secret = {
    type: SecretType;
    pattern: string;
    match: string; // the found secret
};

export function scan(content: string): Secret[] {
    const results: Secret[] = [];
    const matchedRanges: Array<{ start: number; end: number }> = [];

    secretPatterns.forEach((pattern) => {
        //copy pattern to avoid side effects from exec()
        const regex = new RegExp(pattern.pattern.source, pattern.pattern.flags);
        let match: RegExpExecArray | null;

        // biome-ignore lint/suspicious/noAssignInExpressions: idiomatic pattern for regex exec
        while ((match = regex.exec(content)) !== null) {
            // Skip if match should be ignored
            if (pattern.ignore?.test(match[0])) {
                continue;
            }

            // Check if this range overlaps with any already-matched range
            const matchStart = match.index;
            const matchEnd = match.index + match[0].length;
            const hasOverlap = matchedRanges.some(
                (range) => matchStart < range.end && matchEnd > range.start,
            );
            if (hasOverlap) {
                continue;
            }

            matchedRanges.push({ start: matchStart, end: matchEnd });
            results.push({
                type: pattern.type,
                pattern: pattern.pattern.source,
                match: match[0],
            });
        }
    });

    return results;
}
