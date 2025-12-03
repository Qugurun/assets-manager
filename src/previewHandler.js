const path = require('path');
const fs = require('fs').promises;
const Utils = require('./utils');

/**
 * Handles preview generation for files
 */
class PreviewHandler {
    /**
     * Generate preview data for a file
     * Only generates previews for images and media files
     */
    static async generatePreview(filePath, fileName, extension) {
        const ext = extension.toLowerCase();
        
        // Only generate preview for images and media
        if (!Utils.shouldShowPreview(ext)) {
            return null;
        }

        // Generate preview for images
        if (Utils.isImage(ext)) {
            try {
                const b64 = await fs.readFile(filePath, { encoding: 'base64' });
                const mimeType = ext === '.svg' ? 'image/svg+xml' : `image/${ext.replace('.', '')}`;
                return `data:${mimeType};base64,${b64}`;
            } catch (e) {
                return null;
            }
        }

        // For media files, we don't generate preview in the grid
        // They will be handled in the details panel
        return null;
    }
}

module.exports = PreviewHandler;


