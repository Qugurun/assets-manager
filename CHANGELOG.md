# Changelog

## [0.0.4] - 2025-12-05
### Improved
- **Smart Imports**: Refactored the file import functionality.
    - Import paths are now generated **relative to the currently open file** (e.g., `./scenes/Player`) instead of the project root.
    - File extensions are automatically removed from the generated import path.
    - improved insertion logic: new imports are placed after the last existing import statement.
    - Added duplicate detection: prevents adding the same module twice by checking against existing `import`, `require`, and dynamic import statements.

## [0.0.3] - 2025-12-05
### Changed
- **Script Creation**: Creating an empty script now always prompts for a filename instead of auto-generating `newScript`.
- **Template Logic**: Improved replacement logic. If a template file contains the replacement key (e.g., `{{myKey}}`), the extension will now **always** prompt for a name, regardless of the user settings.
- **Settings**: The `assetsManager.enableTemplateReplacement` setting now controls whether to prompt for a filename for templates *without* replacement keys (toggles between manual naming and auto-incremental naming).

## [0.0.2] - 2025-12-04
### Added
- Fixed a bug where multiple key replacements didn't work.

## [0.0.1] - 2025-12-04
### Added
- Initial version: visual tree/grid asset browser, audio player with waveforms, smart file templates with variable substitution.
- Core functionality for browsing and managing asset files inside VS Code.
- Visual representation of assets as a tree or grid.
- Audio playback with waveform visualization.
- Smart file templates with automatic variable replacement.