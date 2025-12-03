const vscode = require('vscode');
const AssetsPanelProvider = require('./src/panelProvider');

function activate(context) {
    const provider = new AssetsPanelProvider(context);
    context.subscriptions.push(vscode.window.registerWebviewViewProvider('phaserAssetsPanel', provider));
}

module.exports = { activate };
