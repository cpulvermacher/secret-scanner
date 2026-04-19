// External JavaScript file with embedded secrets for testing

// google API key
const googleKey = "AIza11111111111111111111111111111111111";

// RSA private key
const rsaKey = `-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEAwK1YzUGjbCVqcI1LMGhSNZb0nZNRoZwqL5zO8fVNXp2JvOKX
2gFpQj6y3m5wLjyGGkLIZWJTQ4LzS1ZzJMQTgWoGqWJbwKjbMLB6V8JlcGqL9eo
xN5JjKgMFhUl3QFRFJGBQHzf2OoJsKl3wYeX6QWp2gJzRSZPFhNZzJGcFJlFHGbW
-----END RSA PRIVATE KEY-----`;

// EC private key
const ecKey = `-----BEGIN EC PRIVATE KEY-----
MHcCAQEEIBNwQfNJgOoBZSB0MxD9QFqZBjzrP7OoozYJZJFbZGcNoAoGCCqGSM49
AwEHoUQDQgAE0nKqQ9YjL8X/gJzPQlZUhR4ZbQRwEGH0lFcIx5RkZZzJ3k5z9QhL
qWJrHlZzNJMbQLJWJqgJzQgHzGQJzLJRFQ==
-----END EC PRIVATE KEY-----`;

// Slack bot token
const slackToken = "xoxb-12345678901-12345678901-abcdefghijklmnopqrstuvwx";

// Generic API key
const apiKey = "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0";

// Password
const password = "Sup3rS3cr3tP@ssw0rd!";

console.log("External test secrets loaded");

// Function that might be called dynamically
function loadSecrets() {
    return {
        googleKey,
        rsaKey,
        ecKey,
        slackToken,
        apiKey,
        password,
    };
}
