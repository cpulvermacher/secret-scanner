# Secret Scanner

A proof-of-concept Chrome extension that uses the `chrome.debugger` API to scan JavaScript files loaded by websites for embedded secrets like private keys.

## Usage

1. Navigate to a webpage you want to scan.
2. Click the Secret Scanner extension icon in the toolbar.
3. Click "Reload & Scan Page" to scan the page.
4. Any detected secrets will appear in the popup.
5. Click "Stop Scanning" when finished

## Limitations

- Only scans the current tab when manually activated
- Requires debugger permissions (shows "'Secret Scanner' started debugging this browser" banner)
- Detected secrets may be false positives
- May not catch dynamically constructed or obfuscated secrets
