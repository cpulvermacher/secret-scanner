# ![](/images/icon-32.png) Secret Scanner

[![Latest Release](https://flat.badgen.net/github/release/cpulvermacher/secret-scanner)](https://github.com/cpulvermacher/secret-scanner/releases)
[![Chrome Web Store](https://flat.badgen.net/chrome-web-store/v/jfcojfckgmgepklcdmmjfgjcgfngckbk)](https://chromewebstore.google.com/detail/secret-scanner/jfcojfckgmgepklcdmmjfgjcgfngckbk)
[![Installs](https://flat.badgen.net/chrome-web-store/users/jfcojfckgmgepklcdmmjfgjcgfngckbk)](https://chromewebstore.google.com/detail/secret-scanner/jfcojfckgmgepklcdmmjfgjcgfngckbk)
[![Status](https://flat.badgen.net/github/checks/cpulvermacher/secret-scanner)](https://github.com/cpulvermacher/secret-scanner/actions/workflows/node.js.yml)
[![License](https://flat.badgen.net/github/license/cpulvermacher/secret-scanner)](./LICENSE)

A browser extension that scans JavaScript files loaded by websites for embedded secrets like private keys or passwords.

## Usage

Pages are automatically scanned in the background, and the number of found secrets is shown in the extension icon in the toolbar. Click the extension icon to see details.

Page security settings may prevent the extension from scanning some scripts. Optionally, you can click the extension icon and press "Enable Debugger & Reload". (only shown if needed)

## Limitations

- Detected secrets may be false positives
- May not catch dynamically constructed or obfuscated secrets
- Scanning pages in the background does not read pages only referred to by other scripts. Use a full scan to scan all scripts.
- Full scanning requires debugger permissions. (shows "'Secret Scanner' started debugging this browser" banner)

## Installation

This extension is compatible with Chromium-based browsers (version 140+). For Chrome, Opera, Edge, and other Chromium-based browsers, install the extension from the Chrome Web Store: https://chromewebstore.google.com/detail/secret-scanner/jfcojfckgmgepklcdmmjfgjcgfngckbk
