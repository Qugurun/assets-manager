const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');

/**
 * Handles tree view operations
 */
class TreeOperations {
    constructor(workspaceRoot) {
        this._workspaceRoot = workspaceRoot;
    }

    /**
     * Update workspace root
     */
    setWorkspaceRoot(root) {
        this._workspaceRoot = root;
    }

    /**
     * Scan directory recursively to build tree structure
     */
    async scanDir(dirPath, relativePath) {
        const name = path.basename(dirPath);
        const children = [];
        const items = await fs.readdir(dirPath, { withFileTypes: true });
        for (const item of items) {
            if (item.isDirectory()) {
                const itemRel = path.join(relativePath, item.name).replace(/\\/g, '/');
                children.push(await this.scanDir(path.join(dirPath, item.name), itemRel));
            }
        }
        return { name, path: relativePath, children };
    }

    /**
     * Refresh tree data based on configured root folders
     */
    async refreshTree() {
        if (!this._workspaceRoot) return [];
        
        const vscode = require('vscode');
        const config = vscode.workspace.getConfiguration('assetsManager');
        const rootDirs = config.get('rootFolders', []);
        const treeData = [];
        
        for (const relativeRoot of rootDirs) {
            const fullPath = path.join(this._workspaceRoot, relativeRoot);
            if (fsSync.existsSync(fullPath)) {
                treeData.push(await this.scanDir(fullPath, relativeRoot));
            }
        }
        
        return treeData;
    }

    /**
     * Scan templates folder
     */
    async scanTemplates() {
        const vscode = require('vscode');
        const config = vscode.workspace.getConfiguration('assetsManager');
        const tplDir = config.get('templatesPath', 'templates');
        const fullPath = path.join(this._workspaceRoot, tplDir);
        let list = [];
        
        if (fsSync.existsSync(fullPath)) {
            const files = await fs.readdir(fullPath);
            list = files.filter(f => !f.startsWith('.')).map(f => ({ name: f, path: f }));
        }
        
        return list;
    }
}

module.exports = TreeOperations;


