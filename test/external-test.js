// External JavaScript file with embedded secrets for testing

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

console.log("External test secrets loaded");

// Function that might be called dynamically
function loadSecrets() {
    return {
        rsa: rsaKey,
        ec: ecKey,
        slack: slackToken
    };
}