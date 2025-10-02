# ![](/images/icon-32.png) Secret Scanner

[![Latest Release](https://flat.badgen.net/github/release/cpulvermacher/secret-scanner)](https://github.com/cpulvermacher/secret-scanner/releases)
[![Chrome Web Store](https://flat.badgen.net/chrome-web-store/v/jfcojfckgmgepklcdmmjfgjcgfngckbk)](https://chromewebstore.google.com/detail/secret-scanner/jfcojfckgmgepklcdmmjfgjcgfngckbk)
[![Installs](https://flat.badgen.net/chrome-web-store/users/jfcojfckgmgepklcdmmjfgjcgfngckbk)](https://chromewebstore.google.com/detail/secret-scanner/jfcojfckgmgepklcdmmjfgjcgfngckbk)
[![Status](https://flat.badgen.net/github/checks/cpulvermacher/secret-scanner)](https://github.com/cpulvermacher/secret-scanner/actions/workflows/node.js.yml)
[![License](https://flat.badgen.net/github/license/cpulvermacher/secret-scanner)](./LICENSE)

A proof-of-concept Chrome extension that scans JavaScript files loaded by websites for embedded secrets like private keys or passwords.

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

## Installation

This extension is compatible with Chromium-based browsers (version 140+). For Chrome, Opera, Edge, and other Chromium-based browsers, install the extension from the Chrome Web Store: https://chromewebstore.google.com/detail/secret-scanner/jfcojfckgmgepklcdmmjfgjcgfngckbk
