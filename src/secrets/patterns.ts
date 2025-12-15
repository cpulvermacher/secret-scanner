export type SecretType = (typeof patterns)[number]["type"];
export type Severity = "high" | "medium";
export type SecretPattern = {
    type: SecretType;
    pattern: RegExp;
    severity: Severity;
    ignore?: RegExp;
};

// secret patterns, ordered from specific to generic
// this allows to identify e.g. the type of an API key instead of giving it a generic label
const patterns = [
    {
        type: "Private Key",
        pattern:
            /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]{120,7000}?-----END [A-Z ]*PRIVATE KEY-----/g,
        severity: "high",
    },
    {
        type: "Stripe Access Token",
        // excludes pk (publishable key) prefix
        pattern: /\b(?:sk|rk)_(?:test|live|prod)_[a-zA-Z0-9]{24}\b/g,
        severity: "high",
    },
    {
        type: "Slack Bot Token",
        pattern: /\bxoxb-[0-9]{11}-[0-9]{11}-[a-zA-Z0-9]{24}\b/g,
        severity: "high",
    },
    {
        type: "AWS Access Key",
        pattern: /\b(?:A3T[A-Z0-9]|AKIA|ASIA|ABIA|ACCA)[A-Z2-7]{16}\b/g,
        severity: "high",
    },
    {
        type: "Google API Key",
        pattern: /\bAIza[0-9A-Za-z\-_]{35}\b/g,
        severity: "medium", // Many types of API keys are meant to be public
    },
    {
        type: "Anthropic API Key",
        pattern: /\bsk-ant-api[0-9]{2}-[a-zA-Z0-9_-]{94}\b/g,
        severity: "high",
    },
    {
        type: "OpenAI API Key",
        pattern: /\bsk-[a-zA-Z0-9]{20}T3BlbkFJ[a-zA-Z0-9]{20}\b/g,
        severity: "high",
    },
    {
        type: "GitHub Token",
        pattern: /\b(?:ghu|ghs|ghp|gho)_[0-9a-zA-Z]{36}\b/g,
        severity: "high",
    },
    {
        type: "GitHub Fine-Grained PAT",
        pattern: /github_pat_\w{82}/g,
        severity: "high",
    },
    // very generic patterns below
    {
        type: "API Key",
        pattern: /\b[\w-]{0,50}?api[_-]?key\s*[:=]\s*['"][^'"]{10,180}['"]/gi,
        ignore: /['"]((\))?\.concat\(|.*api[_-]?key)/i,
        severity: "high",
    },
    {
        type: "Password",
        pattern: /passw(or)?d\s*[:=]\s*['"][^'"\n]{6,60}['"]/gi,
        ignore: /['"]([^'"]*password['"]|(\))?\.concat\()/i,
        severity: "medium", // frequently matches translation strings
    },
] as const;

// exported as more generic type
export const secretPatterns: readonly SecretPattern[] = patterns;
