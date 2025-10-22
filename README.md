# ![](/images/icon-32.png) Secret Scanner

[![Latest Release](https://flat.badgen.net/github/release/cpulvermacher/secret-scanner)](https://github.com/cpulvermacher/secret-scanner/releases)
[![Chrome Web Store](https://flat.badgen.net/chrome-web-store/v/jfcojfckgmgepklcdmmjfgjcgfngckbk)](https://chromewebstore.google.com/detail/secret-scanner/jfcojfckgmgepklcdmmjfgjcgfngckbk)
[![Mozilla Add-on Version](https://img.shields.io/amo/v/secret_scanner?style=flat-square)](https://addons.mozilla.org/en-US/firefox/addon/secret_scanner/)
[![Installs](https://flat.badgen.net/chrome-web-store/users/jfcojfckgmgepklcdmmjfgjcgfngckbk)](https://chromewebstore.google.com/detail/secret-scanner/jfcojfckgmgepklcdmmjfgjcgfngckbk)
[![Status](https://flat.badgen.net/github/checks/cpulvermacher/secret-scanner)](https://github.com/cpulvermacher/secret-scanner/actions/workflows/node.js.yml)
[![License](https://flat.badgen.net/github/license/cpulvermacher/secret-scanner)](./LICENSE)

A browser extension that scans JavaScript files loaded by websites for embedded secrets like private keys or passwords.

## Usage

Pages are automatically scanned in the background, and the number of found secrets is shown in the extension icon in the toolbar. Click the extension icon to see details.

## Limitations

- Used bandwidth may increase. Consider only enabling the extension when needed on metered mobile connections.
- Detected secrets may be false positives
- May not catch dynamically constructed or obfuscated secrets.
- Does not scan scripts only loaded by other scripts.

## Installation

For Chrome, Opera, Edge, and other Chromium-based browsers, install the extension from the Chrome Web Store: https://chromewebstore.google.com/detail/secret-scanner/jfcojfckgmgepklcdmmjfgjcgfngckbk

For Firefox (Desktop or Android), install it from: https://addons.mozilla.org/en-US/firefox/addon/secret_scanner/
