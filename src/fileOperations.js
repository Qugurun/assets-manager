const vscode = require('vscode');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const Utils = require('./utils');

/**
 * Handles all file operations (create, delete, rename, move, copy, etc.)
 */
class FileOperations {
    constructor(workspaceRoot, view, context) {
        this._workspaceRoot = workspaceRoot;
        this._view = view;
        this._context = context;
    }

    /**
     * Update workspace root
     */
    setWorkspaceRoot(root) {
        this._workspaceRoot = root;
    }

    /**
     * Create a new folder
     */
    async createFolder(parentPath) {
        const target = path.join(this._workspaceRoot, parentPath);
        const name = await Utils.getIncrementalName(target, 'New Folder', '');
        await fs.mkdir(path.join(target, name));
    }

    /**
     * Create an empty script file
     */
    async createEmptyScript(folderPath) {
        // Получаем конфигурацию
        const config = vscode.workspace.getConfiguration('assetsManager');
        // Получаем расширение, по умолчанию 'js'
        let ext = config.get('newScriptExtension', 'js');

        // Убеждаемся, что расширение начинается с точки
        if (!ext.startsWith('.')) {
            ext = '.' + ext;
        }

        const target = path.join(this._workspaceRoot, folderPath);
        // Используем полученное расширение (ext) вместо хардкода '.js'
        const name = await Utils.getIncrementalName(target, 'newScript', ext);
        await fs.writeFile(path.join(target, name), '');
    }

    /**
     * Create a scene from template
     */
    async createScene(folderPath) {
        const config = vscode.workspace.getConfiguration('assetsManager');
        const templateRelPath = config.get('fileTemplatePath');
        
        if (!templateRelPath || templateRelPath.trim() === '') {
            const btnOpenSettings = 'Open Settings';
            vscode.window.showErrorMessage(
                'File Template Path is not configured. Please set "assetsManager.fileTemplatePath" in settings.',
                btnOpenSettings
            ).then(selection => {
                if (selection === btnOpenSettings) {
                    vscode.commands.executeCommand('workbench.action.openSettings', 'assetsManager.fileTemplatePath');
                }
            });
            return;
        }

        const fullTemplatePath = path.join(this._workspaceRoot, templateRelPath);
        try {
            await fs.access(fullTemplatePath);
        } catch (e) {
            vscode.window.showErrorMessage(`Template file not found at: "${templateRelPath}". Check your settings.`);
            return;
        }

        const sceneName = await vscode.window.showInputBox({
            prompt: 'Enter File Name',
            placeHolder: 'MainMenu',
            validateInput: (text) => {
                if (!text || text.trim() === '') return 'Name cannot be empty';
                if (!/^[a-zA-Z0-9_-]+$/.test(text)) return 'Invalid characters in name';
                return null;
            }
        });

        if (!sceneName) return;

        try {
            let content = await fs.readFile(fullTemplatePath, 'utf8');
			const replaceKey = config.get('templateReplacementKey', '{{myKey}}');
            content = content.split(replaceKey).join(sceneName);

            const templateExt = path.extname(fullTemplatePath);
            const newFileName = sceneName + templateExt;
            const targetPath = path.join(this._workspaceRoot, folderPath, newFileName);

            try {
                await fs.access(targetPath);
                vscode.window.showErrorMessage(`File "${newFileName}" already exists in this folder.`);
                return;
            } catch (e) {
                // File doesn't exist, proceed
            }

            await fs.writeFile(targetPath, content);
            vscode.window.showInformationMessage(`File "${sceneName}" created successfully.`);

        } catch (error) {
            vscode.window.showErrorMessage(`Failed to create file: ${error.message}`);
        }
    }

    /**
     * Create file from template
     */
    async createFromTemplate(folderPath, templateFile) {
        const config = vscode.workspace.getConfiguration('assetsManager');
        
        const isReplaceEnabled = config.get('enableTemplateReplacement', true);
        const replaceKey = config.get('templateReplacementKey', '{{myKey}}');
        
        const tplDir = config.get('templatesPath', 'templates');
        const fullTplPath = path.join(this._workspaceRoot, tplDir, templateFile);
        const targetDir = path.join(this._workspaceRoot, folderPath);
        const templateExt = path.extname(templateFile);
        const templateBaseName = path.parse(templateFile).name;

        try {
            let content = await fs.readFile(fullTplPath, 'utf8');
            let newFileName;

            if (isReplaceEnabled && content.includes(replaceKey)) {
                const userInput = await vscode.window.showInputBox({
                    prompt: `Enter name for ${templateBaseName} (will replace ${replaceKey})`,
                    placeHolder: templateBaseName,
                    validateInput: (text) => {
                        if (!text || text.trim() === '') return 'Name cannot be empty';
                        if (/[/\\:?*"<>|]/.test(text)) return 'Invalid characters for filename';
                        return null;
                    }
                });

                if (!userInput) return;

                content = content.split(replaceKey).join(userInput);
                newFileName = userInput + templateExt;

                const checkPath = path.join(targetDir, newFileName);
                try {
                    await fs.access(checkPath);
                    vscode.window.showErrorMessage(`File "${newFileName}" already exists.`);
                    return;
                } catch(e) { /* File doesn't exist */ }

            } else {
                newFileName = await Utils.getIncrementalName(targetDir, templateBaseName, templateExt);
            }

            await fs.writeFile(path.join(targetDir, newFileName), content);
        } catch(e) { 
            vscode.window.showErrorMessage(`Template error: ${e.message}`); 
        }
    }

    /**
     * Delete an item
     */
    async deleteItem(rel) {
        await fs.rm(path.join(this._workspaceRoot, rel), {recursive: true, force: true});
    }

    /**
     * Rename an item
     */
    async renameItem(oldP, newN) {
        await fs.rename(
            path.join(this._workspaceRoot, oldP),
            path.join(path.dirname(path.join(this._workspaceRoot, oldP)), newN)
        );
    }

    /**
     * Save uploaded file
     */
    async saveUploadedFile(name, data, targetPath) {
        await fs.writeFile(
            path.join(this._workspaceRoot, targetPath, name),
            Buffer.from(data.split(',')[1], 'base64')
        );
    }

    /**
     * Move an item
     */
    async moveItem(sourceRel, targetRel) {
        const sourcePath = path.join(this._workspaceRoot, sourceRel);
        const targetFolder = path.join(this._workspaceRoot, targetRel);
        const destPath = path.join(targetFolder, path.basename(sourceRel));

        if (sourcePath === destPath) {
            return;
        }

        const relative = path.relative(sourcePath, targetFolder);
        const isInside = relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
        
        let isSourceDir = false;
        try {
            const stat = await fs.stat(sourcePath);
            isSourceDir = stat.isDirectory();
        } catch(e) { return; }

        if (isSourceDir && isInside) {
            vscode.window.showErrorMessage('Cannot move a folder into itself.');
            return;
        }

        try {
            await fs.rename(sourcePath, destPath);
        } catch(e) { 
            vscode.window.showErrorMessage(`Move failed: ${e.message}`); 
        }
    }

    /**
     * Paste item (copy or cut)
     */
    async pasteItem(clipboard, targetRel) {
        if (!clipboard) return;
        const sourcePath = path.join(this._workspaceRoot, clipboard.path);
        
        try {
            const sourceDir = path.dirname(clipboard.path);
            const isSameFolder = (sourceDir === targetRel || sourceDir === targetRel.replace(/\\/g, '/'));
            
            let destName = path.basename(sourcePath);
            let targetPath = path.join(this._workspaceRoot, targetRel, destName);

            if (isSameFolder && clipboard.op === 'copy') {
                destName = await Utils.getSmartCopyName(path.join(this._workspaceRoot, targetRel), destName);
                targetPath = path.join(this._workspaceRoot, targetRel, destName);
            }

            if (clipboard.op === 'cut') {
                await fs.rename(sourcePath, targetPath);
            } else {
                await fs.copyFile(sourcePath, targetPath);
            }
        } catch(e) { 
            vscode.window.showErrorMessage(e.message); 
        }
    }

    /**
     * Handle URI list drop (from VS Code Explorer)
     */
    async handleUriListDrop(uriListString, targetRelPath) {
        if (!uriListString) return;

        const uris = uriListString.split('\r\n');
        const targetDir = path.join(this._workspaceRoot, targetRelPath);

        for (const uriStr of uris) {
            if (!uriStr || uriStr.startsWith('#')) continue;

            try {
                const sourceUri = vscode.Uri.parse(uriStr);
                const sourcePath = sourceUri.fsPath;
                
                try {
                    await fs.access(sourcePath);
                } catch {
                    continue;
                }

                const fileName = path.basename(sourcePath);
                const sourceDir = path.dirname(sourcePath);
                const absoluteTarget = path.join(this._workspaceRoot, targetRelPath);
                
                let destName = fileName;
                if (path.relative(sourceDir, absoluteTarget) === '') {
                    destName = await Utils.getSmartCopyName(absoluteTarget, fileName);
                }

                const destPath = path.join(absoluteTarget, destName);
                await fs.copyFile(sourcePath, destPath);

            } catch (e) {
                console.error('Failed to handle dropped URI:', uriStr, e);
                vscode.window.showErrorMessage(`Failed to import: ${uriStr}`);
            }
        }
    }
}

module.exports = FileOperations;


