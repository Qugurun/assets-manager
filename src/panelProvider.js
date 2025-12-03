const vscode = require('vscode');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const FileOperations = require('./fileOperations');
const TreeOperations = require('./treeOperations');
const PreviewHandler = require('./previewHandler');
const WebviewContent = require('./webviewContent');
const Utils = require('./utils');

/**
 * Main panel provider for the Assets Manager
 */
class AssetsPanelProvider {
    constructor(context) {
        this._context = context;
        this._view = null;
        this._workspaceRoot = null;
        this._fileWatcher = null;
        this._clipboard = null;
        this._currentViewPath = null;
        
        this._defaultState = {
            treeWidth: 200,
            detailsWidth: 250,
            thumbnailSize: 100,
            currentFolderPath: "",
            expandedNodes: []
        };

        // Initialize operations modules
        this._fileOps = null;
        this._treeOps = null;
    }

    resolveWebviewView(webviewView) {
        this._view = webviewView;
        
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._context.extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview();

        webviewView.webview.onDidReceiveMessage(async (data) => {
            await this._handleMessage(data);
        });

        this._setupFileWatcher();
    }

    _getHtmlForWebview() {
        const webview = this._view?.webview;
        const iconsPathOnDisk = vscode.Uri.joinPath(this._context.extensionUri, 'icons');
        const iconsUri = webview.asWebviewUri(iconsPathOnDisk);
        const savedState = this._context.workspaceState.get('phaserAssetsPanelState') || this._defaultState;

        return WebviewContent.generate(webview, this._context, savedState, iconsUri);
    }

    async _handleMessage(data) {
        switch (data.type) {
            case 'handleUriList': 
                if (this._fileOps) {
                    await this._fileOps.handleUriListDrop(data.uriList, data.targetPath);
                    await this._refreshTree();
                    await this._sendFolderContent(data.targetPath);
                }
                break;
            case 'ready': 
                await this._initialize(); 
                break;
            case 'saveState': 
                await this._context.workspaceState.update('phaserAssetsPanelState', data.state); 
                break;
            case 'getFolderContent': 
                this._currentViewPath = data.path;
                await this._sendFolderContent(data.path); 
                break;
            case 'openSettings': 
                vscode.commands.executeCommand('workbench.action.openSettings', 'assetsManager.rootFolders'); 
                break;
            case 'copy': 
                this._clipboard = { op: 'copy', path: data.arg }; 
                this._updateClipboardState(true);
                break;
            case 'cut': 
                this._clipboard = { op: 'cut', path: data.arg }; 
                this._updateClipboardState(true);
                break;
            case 'paste': 
                if (this._fileOps) {
                    await this._fileOps.pasteItem(this._clipboard, data.arg);
                    await this._refreshTree();
                    await this._sendFolderContent(data.arg);
                    if (this._clipboard && this._clipboard.op === 'cut') {
                        this._clipboard = null;
                        this._updateClipboardState(false);
                    }
                }
                break;
            case 'createFolder': 
                if (this._fileOps) {
                    await this._fileOps.createFolder(data.contextPath);
                    await this._refreshTree();
                    await this._sendFolderContent(data.contextPath);
                }
                break;
            case 'createEmptyScript': 
                if (this._fileOps) {
                    await this._fileOps.createEmptyScript(data.contextPath);
                    await this._sendFolderContent(data.contextPath);
                }
                break;
            case 'createScene': 
                if (this._fileOps) {
                    await this._fileOps.createScene(data.contextPath);
                    await this._sendFolderContent(data.contextPath);
                }
                break;
            case 'createFromTemplate': 
                if (this._fileOps) {
                    await this._fileOps.createFromTemplate(data.contextPath, data.arg);
                    await this._sendFolderContent(data.contextPath);
                }
                break;
            case 'delete': 
                if (this._fileOps) {
                    await this._fileOps.deleteItem(data.arg);
                    await this._refreshTree();
                    const parentPath = path.dirname(data.arg).replace(/\\/g, '/');
                    await this._sendFolderContent(parentPath);
                }
                break;
            case 'rename': 
                if (this._fileOps) {
                    await this._fileOps.renameItem(data.oldPath, data.newName);
                    await this._refreshTree();
                    const parentPath = path.dirname(data.oldPath).replace(/\\/g, '/');
                    await this._sendFolderContent(parentPath);
                }
                break;
            case 'uploadFile': 
                if (this._fileOps) {
                    await this._fileOps.saveUploadedFile(data.name, data.data, data.targetPath);
                    await this._sendFolderContent(data.targetPath);
                }
                break;
            case 'openFile': 
                const doc = await vscode.workspace.openTextDocument(
                    vscode.Uri.file(path.join(this._workspaceRoot, data.path))
                );
                vscode.window.showTextDocument(doc); 
                break;
            case 'copyKey': 
                const config = vscode.workspace.getConfiguration('assetsManager');
                const text = config.get('copyKeyIncludeExtension', false) 
                    ? data.arg 
                    : path.parse(data.arg).name;
                vscode.env.clipboard.writeText(text);
                break;
            case 'copyPath': 
                // Copy relative path from project root (data.arg is already relative)
                vscode.env.clipboard.writeText(data.arg); 
                break;
            case 'import':
                const editor = vscode.window.activeTextEditor;
                if(editor) {
                    const ext = path.extname(data.arg);
                    const basename = path.basename(data.arg, ext);
                    editor.edit(e => e.insert(
                        new vscode.Position(0,0), 
                        `import ${basename} from './${data.arg}';\n`
                    ));
                }
                break;
            case 'getAudioData':
                const audioPath = path.join(this._workspaceRoot, data.path);
                try { 
                    const b64 = await fs.readFile(audioPath, {encoding:'base64'}); 
                    this._view.webview.postMessage({ type:'audioData', data: b64 }); 
                } catch(e){}
                break;
            case 'moveItem': 
                if (this._fileOps) {
                    await this._fileOps.moveItem(data.sourcePath, data.targetPath);
                    await this._refreshTree();
                    let parentFolder = path.dirname(data.sourcePath);
                    if (parentFolder === '.') parentFolder = '';
                    const refreshPath = parentFolder.replace(/\\/g, '/');
                    await this._sendFolderContent(refreshPath);
                }
                break;
            case 'revealInExplorer':
                const targetPath = data.arg || '';
                const fullPath = path.join(this._workspaceRoot, targetPath);
                try {
                    const uri = vscode.Uri.file(fullPath);
                    await vscode.commands.executeCommand('revealFileInOS', uri);
                } catch(e) {
                    // Fallback: try to open folder in explorer
                    const folderPath = targetPath ? path.dirname(fullPath) : fullPath;
                    const folderUri = vscode.Uri.file(folderPath);
                    await vscode.commands.executeCommand('revealFileInOS', folderUri);
                }
                break;
        }
    }

    async _initialize() {
        const folders = vscode.workspace.workspaceFolders;
        if (!folders) return;
        
        this._workspaceRoot = folders[0].uri.fsPath;
        this._clipboard = null;

        // Initialize operations modules with workspace root
        this._fileOps = new FileOperations(this._workspaceRoot, this._view, this._context);
        this._treeOps = new TreeOperations(this._workspaceRoot);

        await this._refreshTree();
        await this._scanTemplates();

        await this._sendTemplateConfig(); 
    }

    async _sendTemplateConfig() {
        const config = vscode.workspace.getConfiguration('assetsManager');
        const templateRelPath = config.get('fileTemplatePath');
        
        let templateName = null;
        if (templateRelPath && typeof templateRelPath === 'string' && templateRelPath.trim() !== '') {
            // Получаем имя файла без расширения (например, "Player.js" -> "Player")
            templateName = path.parse(templateRelPath).name;
        }

        this._view.webview.postMessage({ 
            type: 'templateConfig', 
            templateName: templateName 
        });
    }

    async _refreshTree() {
        if (!this._treeOps) return;
        const treeData = await this._treeOps.refreshTree();
        this._view.webview.postMessage({ type: 'treeData', data: treeData });
    }

    async _scanTemplates() {
        if (!this._treeOps) return;
        const list = await this._treeOps.scanTemplates();
        this._view.webview.postMessage({ type: 'templatesList', list: list });
    }

    async _sendFolderContent(relPath) {
        if (!this._workspaceRoot) return;
        const fullPath = path.join(this._workspaceRoot, relPath);
        try {
            const items = await fs.readdir(fullPath, { withFileTypes: true });
            const result = [];
            for (const item of items) {
                const itemRel = path.join(relPath, item.name).replace(/\\/g, '/');
                if (item.isDirectory()) { 
                    result.push({ name: item.name, type: 'folder', path: itemRel }); 
                } else {
                    const ext = path.extname(item.name).toLowerCase();
                    const s = await fs.stat(path.join(fullPath, item.name));
                    let type = 'file';
                    let preview = null;
                    
                    // Only generate preview for images (media files don't have preview in grid)
                    if (Utils.isImage(ext)) {
                        type = 'image';
                        preview = await PreviewHandler.generatePreview(
                            path.join(fullPath, item.name),
                            item.name,
                            ext
                        );
                    } else if (Utils.isMedia(ext)) {
                        type = 'audio';
                        // No preview for media files in grid, only in details panel
                    }
                    // For all other file types, preview remains null
                    
                    result.push({ 
                        name: item.name, 
                        type: type, 
                        path: itemRel, 
                        extension: ext, 
                        preview: preview, 
                        size: (s.size/1024).toFixed(1)+' KB' 
                    });
                }
            }
            this._view.webview.postMessage({ type: 'folderContent', items: result, path: relPath });
        } catch(e) { }
    }

    _updateClipboardState(active) { 
        this._view.webview.postMessage({ type: 'clipboardState', active: active }); 
    }

    _setupFileWatcher() {
        if (this._fileWatcher) {
            this._fileWatcher.dispose();
        }

        this._fileWatcher = vscode.workspace.createFileSystemWatcher('**/*');

        const refreshContent = async (uri) => {
            if (!this._workspaceRoot) return;

            const changedFilePath = uri.fsPath;

            await this._refreshTree();

            const config = vscode.workspace.getConfiguration('assetsManager');
            const tplRelPath = config.get('templatesPath', 'templates');
            const tplAbsPath = path.join(this._workspaceRoot, tplRelPath);

            const relToTpl = path.relative(tplAbsPath, changedFilePath);
            const isInsideTemplates = !relToTpl.startsWith('..') && !path.isAbsolute(relToTpl);

            if (isInsideTemplates) {
                await this._scanTemplates();
            }

            if (this._currentViewPath !== null) {
                const currentViewAbsPath = path.join(this._workspaceRoot, this._currentViewPath);
                const changedFileDir = path.dirname(changedFilePath);
                const relative = path.relative(currentViewAbsPath, changedFileDir);

                if (relative === '') {
                    await this._sendFolderContent(this._currentViewPath);
                }
            }
        };

        this._fileWatcher.onDidCreate(refreshContent);
        this._fileWatcher.onDidDelete(refreshContent);
        this._fileWatcher.onDidChange(refreshContent);
    }
}

module.exports = AssetsPanelProvider;


