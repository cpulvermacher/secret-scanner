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
        type: "Private Key",
        pattern:
            /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
    },
    {
        type: "Stripe Access Token",
        pattern: /(?:sk|rk)_(?:test|live|prod)_[a-zA-Z0-9]{24}/g,
    },
    {
        type: "Slack Bot Token",
        pattern: /xoxb-[0-9]{11}-[0-9]{11}-[a-zA-Z0-9]{24}/g,
    },
    {
        type: "AWS Access Key",
        pattern: /(?:A3T[A-Z0-9]|AKIA|ASIA|ABIA|ACCA)[A-Z2-7]{16}/g,
    },
    {
        type: "Google API Key",
        pattern: /AIza[0-9A-Za-z\-_]{35}/g,
    },
    {
        type: "Anthropic API Key",
        pattern: /sk-ant-api[0-9]{2}-[a-zA-Z0-9_-]{94}/g,
    },
    {
        type: "OpenAI API Key",
        pattern: /sk-[a-zA-Z0-9]{20}T3BlbkFJ[a-zA-Z0-9]{20}/g,
    },
    {
        type: "GitHub Token",
        pattern: /(?:ghu|ghs|ghp|gho)_[0-9a-zA-Z]{36}/g,
    },
    {
        type: "GitHub Fine-Grained PAT",
        pattern: /github_pat_\w{82}/g,
    },
    // very generic patterns below
    {
        type: "API Key",
        pattern: /api[_-]?key\s*[:=]\s*['"][^'"]{6,}['"]/gi,
        ignore: /['"]((\))?\.concat\(|.*api[_-]?key)/i,
    },
    {
        type: "Password",
        pattern: /passw(or)?d\s*[:=]\s*['"][^'"\n]{4,60}['"]/gi,
        ignore: /['"]([^'"]*password['"]|(\))?\.concat\()/i,
    },
] as const;

// exported as more generic type
export const secretPatterns: readonly SecretPattern[] = patterns;
