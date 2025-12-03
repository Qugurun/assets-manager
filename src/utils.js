const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');

/**
 * Utility functions for the extension
 */
class Utils {
    /**
     * Generate a nonce for CSP
     */
    static getNonce() {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }

    /**
     * Get incremental name for new files/folders
     */
    static async getIncrementalName(dir, base, ext) {
        let name = base + ext;
        let i = 1;
        while (fsSync.existsSync(path.join(dir, name))) {
            name = `${base}${i}${ext}`;
            i++;
        }
        return name;
    }

    /**
     * Get smart copy name (handles _copy suffix)
     */
    static async getSmartCopyName(dir, filename) {
        const ext = path.extname(filename);
        let base = path.basename(filename, ext);
        
        // Check if ends with _copy or _copyN
        const match = base.match(/^(.*)_copy(\d*)$/);
        if (match) {
            base = match[1]; // original base
        }
        
        let attempt = 0;
        let newName = `${base}_copy${ext}`; // First attempt: name_copy.ext
        
        if (fsSync.existsSync(path.join(dir, newName))) {
            attempt = 1;
            newName = `${base}_copy${attempt}${ext}`;
            while (fsSync.existsSync(path.join(dir, newName))) {
                attempt++;
                newName = `${base}_copy${attempt}${ext}`;
            }
        }
        
        return newName;
    }

    /**
     * Check if file extension is an image
     */
    static isImage(ext) {
        return ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg'].includes(ext.toLowerCase());
    }

    /**
     * Check if file extension is audio/video media
     */
    static isMedia(ext) {
        return ['.mp3', '.ogg', '.wav', '.mp4', '.webm', '.avi'].includes(ext.toLowerCase());
    }

    /**
     * Check if file should have preview (only images and media)
     */
    static shouldShowPreview(ext) {
        return this.isImage(ext) || this.isMedia(ext);
    }
}

module.exports = Utils;


