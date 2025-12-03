const Utils = require('./utils');

/**
 * Generates HTML content for the webview
 */
class WebviewContent {
    static generate(webview, context, savedState, iconsUri) {
        const nonce = Utils.getNonce();
        const cspSource = webview?.cspSource || '';

        // Generate the HTML with all necessary changes:
        // 1. Remove Windows Explorer drag-and-drop support
        // 2. Fix rename to select only filename without extension
        // 3. Preview only for images and media (handled in backend)
        
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${cspSource} data: file: https:; font-src ${cspSource} data:;">
    <title>Assets Manager</title>
    <style>
        .icon-img {
            width: 48px;
            height: 48px;
            object-fit: contain;
            pointer-events: none;
        } 

        :root {
            --tree-width: ${savedState.treeWidth}px;
            --details-width: ${savedState.detailsWidth}px;
            --thumb-size: ${savedState.thumbnailSize}px;
        }

        * { margin: 0; padding: 0; box-sizing: border-box; outline: none; }
        
        body {
            font-family: var(--vscode-font-family);
            background: var(--vscode-editor-background);
            color: var(--vscode-foreground);
            height: 100vh;
            display: flex;
            overflow: hidden;
            user-select: none;
        }

        /* --- LAYOUT --- */
        .tree-panel { width: var(--tree-width); min-width: 150px; display: flex; flex-direction: column; background: var(--vscode-sideBar-background); flex-shrink: 0; }
        .resizer { width: 4px; background: var(--vscode-panel-border); cursor: col-resize; z-index: 100; transition: background 0.2s; }
        .resizer:hover, .resizer.active { background: var(--vscode-focusBorder); }
        .content-panel { flex: 1; display: flex; flex-direction: column; min-width: 200px; position: relative; }
        .details-panel { width: var(--details-width); min-width: 200px; background: var(--vscode-sideBar-background); display: none; flex-direction: column; flex-shrink: 0; border-left: 1px solid var(--vscode-panel-border); }
        .details-panel.visible { display: flex; }

        /* --- TREEVIEW --- */
        .tree-header { padding: 8px 12px; border-bottom: 1px solid var(--vscode-panel-border); display: flex; justify-content: flex-end; gap: 6px; height: 36px; align-items: center; }
        .tree-btn { background: transparent; color: var(--vscode-icon-foreground); border: 1px solid transparent; padding: 2px 6px; cursor: pointer; border-radius: 3px; }
        .tree-btn:hover { background: var(--vscode-toolbar-hoverBackground); }
        .tree-container { flex: 1; overflow-y: auto; padding: 4px 0; }
        .tree-node { cursor: pointer; padding: 3px 0; display: flex; align-items: center; white-space: nowrap; color: var(--vscode-sideBar-foreground); }
        .tree-node:hover { background: var(--vscode-list-hoverBackground); }
        .tree-node.selected { background: var(--vscode-list-activeSelectionBackground); color: var(--vscode-list-activeSelectionForeground); }
        .tree-arrow { width: 16px; height: 16px; display: inline-flex; align-items: center; justify-content: center; font-size: 10px; cursor: pointer; transform: rotate(0deg); }
        .tree-arrow.expanded { transform: rotate(90deg); }
        .tree-arrow.hidden { visibility: hidden; }
        
        .empty-tree-msg { padding: 20px; text-align: center; color: var(--vscode-descriptionForeground); font-size: 13px; }
        .btn-link { background: none; border: none; color: var(--vscode-textLink-foreground); cursor: pointer; text-decoration: underline; font-family: inherit; }

        /* --- CONTENT & BREADCRUMBS --- */
        .breadcrumbs { 
            height: 30px; display: flex; align-items: center; padding: 0 16px; 
            border-bottom: 1px solid var(--vscode-panel-border); 
            background: var(--vscode-breadcrumb-background); 
            overflow-x: auto; white-space: nowrap; 
        }
        .crumb { 
            cursor: pointer; color: var(--vscode-breadcrumb-foreground); font-size: 12px; 
            transition: color 0.1s;
        }
        .crumb:hover { 
            color: var(--vscode-breadcrumb-focusForeground); 
            text-decoration: underline;
        }
        .crumb-separator { margin: 0 6px; opacity: 0.6; color: var(--vscode-breadcrumb-foreground); }

        .content-viewer { flex: 1; overflow-y: auto; padding: 16px; position: relative; }
        .content-viewer:focus { outline: none; } 
        
        .content-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(var(--thumb-size), 1fr)); gap: 12px; }
        .content-item { display: flex; flex-direction: column; align-items: center; padding: 8px; border: 1px solid transparent; border-radius: 4px; cursor: pointer; }
        .content-item:hover { background: var(--vscode-list-hoverBackground); }
        .content-item.selected { background: var(--vscode-list-activeSelectionBackground); border-color: var(--vscode-focusBorder); color: var(--vscode-list-activeSelectionForeground); }
        .content-item > * {pointer-events: none; }

        .preview-box { width: 100%; height: var(--thumb-size); display: flex; align-items: center; justify-content: center; margin-bottom: 6px; background: rgba(128, 128, 128, 0.1); border-radius: 4px; overflow: hidden; }
        .content-preview { max-width: 100%; max-height: 100%; object-fit: contain; pointer-events: none; }
        .content-file-icon { font-size: calc(var(--thumb-size) * 0.5); pointer-events: none; }
        .content-name { font-size: 12px; text-align: center; word-break: break-word; width: 100%; line-height: 1.2; padding: 2px; }

        /* --- DETAILS --- */
        .details-header { padding: 12px; font-weight: bold; border-bottom: 1px solid var(--vscode-panel-border); }
        .details-content { padding: 16px; overflow-y: auto; flex: 1; }
        .details-img-large { width: 100%; max-height: 200px; object-fit: contain; background: rgba(0,0,0,0.2); margin-bottom: 5px; border-radius: 4px; }
        .img-dimensions { font-size: 11px; color: var(--vscode-descriptionForeground); text-align: center; margin-bottom: 12px; }
        
        /* Audio Player */
        .audio-player-container { display: flex; flex-direction: column; gap: 8px; margin-top: 10px; background: var(--vscode-editor-background); padding: 10px; border-radius: 6px; border: 1px solid var(--vscode-panel-border); }
        canvas#waveform { width: 100%; height: 50px; background: #1e1e1e; border-radius: 4px; opacity: 0.8; }
        .audio-controls-row { display: flex; align-items: center; gap: 8px; }
        .audio-btn { background: none; border: none; cursor: pointer; font-size: 18px; color: var(--vscode-button-background); padding: 4px; display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 4px; transition: all 0.2s; }
        .audio-btn:hover { background: var(--vscode-toolbar-hoverBackground); }
        .audio-btn.active { color: #fff; background-color: var(--vscode-button-background); }
        
        .audio-time { font-size: 11px; font-family: monospace; min-width: 80px; text-align: center; color: var(--vscode-descriptionForeground); }
        .audio-progress-container { flex: 1; display: flex; align-items: center; }
        input[type=range].audio-slider { -webkit-appearance: none; width: 100%; background: transparent; }
        input[type=range].audio-slider::-webkit-slider-thumb { -webkit-appearance: none; height: 12px; width: 12px; border-radius: 50%; background: var(--vscode-button-background); cursor: pointer; margin-top: -4px; transition: transform 0.1s; }
        input[type=range].audio-slider::-webkit-slider-thumb:hover { transform: scale(1.2); }
        input[type=range].audio-slider::-webkit-slider-runnable-track { width: 100%; height: 4px; cursor: pointer; background: var(--vscode-scrollbarSlider-background); border-radius: 2px; }

        /* --- CONTEXT MENU --- */
        .context-menu { position: fixed; background: var(--vscode-menu-background); border: 1px solid var(--vscode-menu-border); z-index: 1000; box-shadow: 0 2px 8px rgba(0,0,0,0.3); border-radius: 3px; display: none; min-width: 180px; padding: 4px 0; }
        .menu-item { padding: 6px 20px 6px 12px; cursor: pointer; font-size: 13px; color: var(--vscode-menu-foreground); display: flex; justify-content: space-between; align-items: center; position: relative; }
        .menu-item:hover { background: var(--vscode-menu-selectionBackground); color: var(--vscode-menu-selectionForeground); }
        .menu-item.disabled { color: var(--vscode-disabledForeground); cursor: default; pointer-events: none; }
        .menu-separator { height: 1px; background: var(--vscode-menu-separatorBackground); margin: 3px 0; }
        
        /* Submenu */
        .menu-arrow { font-size: 10px; margin-left: 8px; }
        .context-submenu { display: none; position: absolute; left: 100%; top: -4px; background: var(--vscode-menu-background); border: 1px solid var(--vscode-menu-border); min-width: 160px; box-shadow: 0 2px 8px rgba(0,0,0,0.3); border-radius: 3px; }
        .menu-item:hover > .context-submenu { display: block; }

        /* --- OTHERS --- */
        .drop-overlay.active { display: flex; }
        .slider-container { position: absolute; bottom: 10px; right: 10px; background: var(--vscode-editor-background); border: 1px solid var(--vscode-panel-border); padding: 6px; border-radius: 4px; opacity: 0.8; z-index: 50; }
        .slider-container:hover { opacity: 1; }
        .rename-input { width: 100%; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-focusBorder); padding: 2px 4px; font-family: inherit; font-size: 12px; outline: none; }

        .preview-box, .content-name {
            pointer-events: auto; 
        }
        
        .content-preview, .content-file-icon {
            pointer-events: none;
        }
        
    </style>
</head>
<body>

    <div class="tree-panel" id="treePanel" tabindex="-1">
        <div class="tree-header">
            <button class="tree-btn" id="btnExpandAll" title="Expand All">+</button>
            <button class="tree-btn" id="btnCollapseAll" title="Collapse All">−</button>
        </div>
        <div class="tree-container" id="treeContainer"></div>
    </div>
    <div class="resizer" id="resizer1"></div>

    <div class="content-panel">
        <div class="breadcrumbs" id="breadcrumbs"></div>
        <div class="content-viewer" id="contentViewer" tabindex="0">
            <div class="content-grid" id="contentGrid"></div>
        </div>
        <div class="slider-container">
            <input type="range" id="iconSizeSlider" min="50" max="200" value="${savedState.thumbnailSize}" step="10">
        </div>
    </div>
    <div class="resizer" id="resizer2"></div>

    <div class="details-panel" id="detailsPanel">
        <div class="details-header">Details</div>
        <div class="details-content" id="detailsContent">
            <p style="opacity:0.6; text-align:center; margin-top:20px;">Select an asset</p>
        </div>
    </div>

    <div class="context-menu" id="ctxMenu"></div>

    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        
        const iconsBaseUrl = '${iconsUri}';

        let state = {
            treeWidth: ${savedState.treeWidth},
            detailsWidth: ${savedState.detailsWidth},
            thumbnailSize: ${savedState.thumbnailSize},
            currentFolderPath: '${savedState.currentFolderPath}',
            expandedNodes: new Set(${JSON.stringify(savedState.expandedNodes)})
        };

        let clipboardActive = false; 
        let templatesList = []; 
        let currentSelectedPath = null;
        let currentAudioPath = null;
        let customTemplateName = null; 

        const rootStyles = document.documentElement.style;
        const detailsPanel = document.getElementById('detailsPanel');
        const contentViewer = document.getElementById('contentViewer');
        
        function init() {
            rootStyles.setProperty('--tree-width', state.treeWidth + 'px');
            rootStyles.setProperty('--details-width', state.detailsWidth + 'px');
            rootStyles.setProperty('--thumb-size', state.thumbnailSize + 'px');
            
            setupResizers();
            setupTreeControls();
            setupGridControls();
            setupDnD();
            setupHotkeys();

            document.getElementById('treePanel').oncontextmenu = (e) => showTreeContextMenu(e);
            
            vscode.postMessage({ type: 'ready' });
            if(state.currentFolderPath) {
                vscode.postMessage({ type: 'getFolderContent', path: state.currentFolderPath });
            }
        }

        // --- AUDIO ---
        let audioCtx, audioBuffer, audioSource;
        let isPlaying = false;
        let isLooping = false;
        let startTime = 0;
        let pausedAt = 0;
        let animationId;

        async function setupAudioUI(assetPath) {
            currentAudioPath = assetPath;
            vscode.postMessage({ type: 'getAudioData', path: assetPath });
        }

        function initAudioPlayer(base64Data) {
            try {
                if (audioCtx) audioCtx.close();
                audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                
                const arrayBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0)).buffer;
                audioCtx.decodeAudioData(arrayBuffer, (buffer) => {
                    audioBuffer = buffer;
                    renderAudioControls(buffer.duration);
                    drawWaveform(buffer);
                });
            } catch (e) { console.error(e); }
        }

        function renderAudioControls(duration) {
            const container = document.getElementById('audioUI');
            if(!container) return;
            container.innerHTML = \`
                <canvas id="waveform"></canvas>
                <div class="audio-controls-row">
                    <button id="btnPlay" class="audio-btn" title="Play">▶️</button>
                    <div class="audio-time" id="timeDisplay">00:00 / \${formatTime(duration)}</div>
                    <div class="audio-progress-container">
                        <input type="range" class="audio-slider" id="audioSlider" min="0" max="\${duration}" step="0.01" value="0">
                    </div>
                    <button id="btnLoop" class="audio-btn" title="Loop Playback">🔁</button>
                </div>
            \`;

            const btnPlay = document.getElementById('btnPlay');
            const btnLoop = document.getElementById('btnLoop');
            const slider = document.getElementById('audioSlider');
            
            btnPlay.onclick = () => {
                if (isPlaying) stopAudio(false);
                else playAudio(pausedAt);
            };
            
            btnLoop.onclick = () => {
                isLooping = !isLooping;
                btnLoop.classList.toggle('active', isLooping);
                if(audioSource) audioSource.loop = isLooping;
            };

            slider.oninput = () => updateTimeDisplay(slider.value, duration);
            slider.onchange = () => {
                const wasPlaying = isPlaying;
                stopAudio(false);
                pausedAt = parseFloat(slider.value);
                if(wasPlaying) playAudio(pausedAt);
            };
            slider.onmousedown = () => { if(isPlaying) { if(audioSource) audioSource.stop(); isPlaying=false; cancelAnimationFrame(animationId); } };
            slider.onmouseup = () => { if(audioSource) playAudio(parseFloat(slider.value)); };
        }

        function playAudio(offset) {
            if (!audioBuffer) return;
            audioSource = audioCtx.createBufferSource();
            audioSource.buffer = audioBuffer;
            audioSource.loop = isLooping;
            audioSource.connect(audioCtx.destination);
            
            startTime = audioCtx.currentTime - offset;
            audioSource.start(0, offset);
            isPlaying = true;
            const btn = document.getElementById('btnPlay');
            if(btn) btn.textContent = '⏸️';

            updateProgressLoop();
            
            audioSource.onended = () => {
                if(!isLooping && Math.abs(audioCtx.currentTime - startTime - audioBuffer.duration) < 0.1) {
                    stopAudio(true);
                }
            };
        }

        function stopAudio(fullReset = true) {
            if (audioSource) {
                try { audioSource.stop(); } catch(e){}
                audioSource = null;
            }
            isPlaying = false;
            cancelAnimationFrame(animationId);
            
            const btn = document.getElementById('btnPlay');
            if(btn) btn.textContent = '▶️';
            
            if (fullReset) {
                pausedAt = 0;
                const slider = document.getElementById('audioSlider');
                if(slider) {
                    slider.value = 0;
                    if(audioBuffer) updateTimeDisplay(0, audioBuffer.duration);
                }
            }
        }
        
        function resetAudio() {
             stopAudio(true);
             isLooping = false;
             currentAudioPath = null;
             const ui = document.getElementById('audioUI');
             if(ui) ui.innerHTML = 'Loading...';
        }

        function updateProgressLoop() {
            if (!isPlaying) return;
            const slider = document.getElementById('audioSlider');
            
            let current = audioCtx.currentTime - startTime;
            if (current > audioBuffer.duration) {
                if (isLooping) {
                    while(current > audioBuffer.duration) {
                       startTime += audioBuffer.duration; 
                       current -= audioBuffer.duration;
                    }
                }
            }
            
            if(slider) {
                slider.value = current;
                updateTimeDisplay(current, audioBuffer.duration);
            }
            animationId = requestAnimationFrame(updateProgressLoop);
        }

        function formatTime(seconds) {
            const m = Math.floor(seconds / 60);
            const s = Math.floor(seconds % 60);
            return \`\${m.toString().padStart(2,'0')}:\${s.toString().padStart(2,'0')}\`;
        }
        
        function updateTimeDisplay(current, total) {
            const el = document.getElementById('timeDisplay');
            if(el) el.textContent = \`\${formatTime(current)} / \${formatTime(total)}\`;
        }

        function drawWaveform(buffer) { 
            const canvas = document.getElementById('waveform');
            if(!canvas) return;
            canvas.width = canvas.offsetWidth;
            canvas.height = canvas.offsetHeight;
            const ctx = canvas.getContext('2d');
            const data = buffer.getChannelData(0);
            const step = Math.ceil(data.length / canvas.width);
            const amp = canvas.height / 2;
            ctx.fillStyle = '#3794ff';
            ctx.clearRect(0,0,canvas.width, canvas.height);
            for(let i=0; i < canvas.width; i++){
                let min = 1.0; let max = -1.0;
                for (let j=0; j<step; j++) {
                    const datum = data[(i*step)+j]; 
                    if (datum < min) min = datum;
                    if (datum > max) max = datum;
                }
                ctx.fillRect(i, (1+min)*amp, 1, Math.max(1,(max-min)*amp));
            }
        }

        // --- HOTKEYS ---
        function setupHotkeys() {
            document.addEventListener('keydown', (e) => {
                if (e.target.closest('#treePanel')) return;

                if (e.ctrlKey || e.metaKey) {
                    switch(e.key.toLowerCase()) {
                        case 'c':
                            if (currentSelectedPath) {
                                e.preventDefault();
                                exec('copy', currentSelectedPath);
                            }
                            break;
                        case 'x':
                            if (currentSelectedPath) {
                                e.preventDefault();
                                exec('cut', currentSelectedPath);
                            }
                            break;
                        case 'v':
                            if (clipboardActive) {
                                e.preventDefault();
                                exec('paste', state.currentFolderPath);
                            }
                            break;
                    }
                }
                
                if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

                if (e.key === 'Delete' || e.key === 'Backspace') {
                    if (currentSelectedPath) {
                        e.preventDefault();
                        if(confirm('Delete ' + currentSelectedPath + '?')) {
                           exec('delete', currentSelectedPath);
                        }
                    }
                }
            });
        }

        // --- CONTEXT MENUS & EXEC ---
        function exec(cmd, arg) {
            if (cmd === 'expandAll') {
                document.getElementById('btnExpandAll').click();
                return;
            }
            if (cmd === 'collapseAll') {
                document.getElementById('btnCollapseAll').click();
                return;
            }

            if (cmd === 'triggerRename') {
                const el = document.querySelector(\`[data-path="\${arg}"] .content-name\`);
                if(el) startRename({ path: arg, name: el.textContent }, el);
            } else {
                vscode.postMessage({ type: cmd, arg: arg, contextPath: state.currentFolderPath });
            }
        }

        // --- SELECTION & DETAILS ---
        function selectAsset(asset, element) {
            if (currentAudioPath && currentAudioPath !== asset.path) {
                resetAudio();
            }

            document.querySelectorAll('.content-item').forEach(i => i.classList.remove('selected'));
            element.classList.add('selected');
            currentSelectedPath = asset.path;

            // Only show details panel for images and media files
            if (asset.type === 'image' || asset.type === 'audio') {
                detailsPanel.classList.add('visible');
                const container = document.getElementById('detailsContent');
                
                let html = \`<div><strong>Name:</strong> \${asset.name}</div>\`;
                html += \`<div><strong>Size:</strong> \${asset.size}</div>\`;
                
                if (asset.type === 'image') {
                    html = \`
                        <img src="\${asset.preview}" class="details-img-large" id="detailsImg">
                        <div class="img-dimensions" id="imgDims">Loading dimensions...</div>
                        \${html}
                    \`;
                } else if (asset.type === 'audio') {
                    html += \`<div class="audio-player-container" id="audioUI">Loading...</div>\`;
                }
                
                container.innerHTML = html;

                if (asset.type === 'image') {
                    const img = document.getElementById('detailsImg');
                    img.onload = () => { document.getElementById('imgDims').textContent = \`\${img.naturalWidth} x \${img.naturalHeight}\`; };
                } else if (asset.type === 'audio') {
                    setupAudioUI(asset.path);
                }
            } else {
                // Hide details panel for other file types
                detailsPanel.classList.remove('visible');
                if(audioCtx) { audioCtx.close(); audioCtx = null; }
            }
        }
        
        function highlightFolder(path, element) {
            document.querySelectorAll('.content-item').forEach(i => i.classList.remove('selected'));
            element.classList.add('selected');
            currentSelectedPath = path;
            detailsPanel.classList.remove('visible');
        }
        
        function selectFolder(path) {
            if(typeof isPlaying !== 'undefined' && isPlaying) resetAudio();
            if(typeof audioSource !== 'undefined' && audioSource) resetAudio();
            currentSelectedPath = null;
            
            state.currentFolderPath = path;
            state.expandedNodes.add(path);
            saveState();
            
            const nodes = document.querySelectorAll('.tree-node');
            nodes.forEach(node => {
                if (node.dataset.path === path) {
                    node.classList.add('selected');
                } else {
                    node.classList.remove('selected');
                }
            });

            detailsPanel.classList.remove('visible');
            vscode.postMessage({ type: 'getFolderContent', path: path });
        }

        // --- BREADCRUMBS ---
        function renderBreadcrumbs(pathStr) {
            const bc = document.getElementById('breadcrumbs'); 
            bc.innerHTML='';
            if(!pathStr) return;
            
            const parts = pathStr.split('/');
            let accumulatedPath = '';
            
            parts.forEach((part, index) => {
                if(index > 0) { 
                    const s = document.createElement('span'); 
                    s.className='crumb-separator'; 
                    s.textContent='>'; 
                    bc.appendChild(s); 
                    accumulatedPath += '/'; 
                }
                accumulatedPath += part;
                
                const c = document.createElement('span'); 
                c.className = 'crumb'; 
                c.textContent = part;
                c.title = accumulatedPath;
                
                const targetPath = accumulatedPath;
                c.onclick = () => selectFolder(targetPath);
                
                bc.appendChild(c);
            });
            
            bc.scrollLeft = bc.scrollWidth;
        }

        // --- RENDERERS ---
        function renderContent(items, parentPath) {
            const grid = document.getElementById('contentGrid');
            grid.innerHTML = '';
            
            renderBreadcrumbs(state.currentFolderPath);

            if(items.length === 0) {
                const empty = document.createElement('div');
                empty.style.gridColumn="1/-1"; empty.style.height="100%"; empty.style.minHeight="200px";
                empty.textContent="Empty folder"; empty.style.color="var(--vscode-descriptionForeground)";
                empty.style.display="flex"; empty.style.alignItems="center"; empty.style.justifyContent="center";
                empty.onclick = () => { 
                    currentSelectedPath = null; 
                    document.querySelectorAll('.content-item').forEach(i=>i.classList.remove('selected')); 
                    detailsPanel.classList.remove('visible');
                };
                empty.oncontextmenu = (e) => showGlobalContextMenu(e);
                grid.appendChild(empty);
                return;
            }

            document.getElementById('contentViewer').onclick = (e) => {
                 if(e.target.id === 'contentViewer' || e.target.id === 'contentGrid') {
                     currentSelectedPath = null;
                     document.querySelectorAll('.content-item').forEach(i=>i.classList.remove('selected'));
                     detailsPanel.classList.remove('visible');
                 }
            };

            document.getElementById('contentViewer').oncontextmenu = (e) => {
                 if(e.target.id === 'contentViewer' || e.target.id === 'contentGrid') {
                     currentSelectedPath = null;
                     document.querySelectorAll('.content-item').forEach(i=>i.classList.remove('selected'));
                     showGlobalContextMenu(e);
                 }
            };

            // Add parent folder navigation item "..." if not in root
            if (state.currentFolderPath) {
                const parentPath = state.currentFolderPath.split('/').slice(0, -1).join('/') || '';
                
                const parentDiv = document.createElement('div');
                parentDiv.className = 'content-item';
                parentDiv.draggable = false; // Cannot drag parent navigation
                parentDiv.dataset.path = '..';
                parentDiv.tabIndex = 0;
                
                const iconSrc = \`\${iconsBaseUrl}/folder.svg\`;
                
                parentDiv.innerHTML = \`
                    <div class="preview-box"><img src="\${iconSrc}" class="icon-img"></div>
                    <div class="content-name">...</div>
                \`;
                
                const parentPreviewBox = parentDiv.querySelector('.preview-box');
                parentPreviewBox.ondblclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    selectFolder(parentPath);
                };
                
                parentDiv.onclick = (e) => {
                    e.stopPropagation();
                    highlightFolder('..', parentDiv);
                };
                
                parentDiv.ondblclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    selectFolder(parentPath);
                };
                
                // No context menu and no rename for parent navigation
                parentDiv.oncontextmenu = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                };
                
                grid.appendChild(parentDiv);
            }

            items.forEach(item => {
                const div = document.createElement('div');
                div.className = 'content-item';
                div.draggable = true; 
                div.dataset.path = item.path;
                div.tabIndex = 0;
                
                div.ondragstart = (e) => {
                    const dragData = JSON.stringify({ type: item.type, path: item.path });
                    e.dataTransfer.setData('text/plain', dragData);
                    e.dataTransfer.effectAllowed = 'copyMove'; 
                };
                
                if (item.type === 'folder') {
                    div.ondragover = (e) => {
                        e.preventDefault(); e.stopPropagation();
                        e.dataTransfer.dropEffect = 'copy';
                    };
                    div.ondrop = async (e) => {
                        e.preventDefault(); e.stopPropagation();
                        const plainText = e.dataTransfer.getData('text/plain');
                        if (plainText && plainText.startsWith('{')) {
                            try {
                                const data = JSON.parse(plainText);
                                if (data.path === item.path) return;
                            } catch(err) {}
                        }
                        await handleDroppedData(e, item.path);
                    };
                }
                
                let iconSrc = \`\${iconsBaseUrl}/default.svg\`;
                
                if (item.extension === '.js') iconSrc = \`\${iconsBaseUrl}/js.svg\`;
                if (item.extension === '.ts') iconSrc = \`\${iconsBaseUrl}/ts.svg\`;
                if (item.extension === '.json') iconSrc = \`\${iconsBaseUrl}/json.svg\`;
                if (item.extension === '.html') iconSrc = \`\${iconsBaseUrl}/html.svg\`;
                if (item.extension === '.css') iconSrc = \`\${iconsBaseUrl}/css.svg\`;

                if (item.type === 'folder') {
                    iconSrc = \`\${iconsBaseUrl}/folder.svg\`;
                } 
                else if (item.type === 'audio') {
                    iconSrc = \`\${iconsBaseUrl}/audio.svg\`;
                }
                
                let icon = \`<img src="\${iconSrc}" class="icon-img">\`;

                // Only show preview for images (no preview for other file types)
                if (item.type === 'image' && item.preview) {
                    icon = \`<img src="\${item.preview}" class="content-preview">\`;
                }
                // Media files and all other file types show icon only, no preview
                
                div.innerHTML = \`
                    <div class="preview-box">\${icon}</div>
                    <div class="content-name">\${item.name}</div>
                \`;
                
                const previewBox = div.querySelector('.preview-box');
                previewBox.ondblclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if(item.type === 'folder') {
                        selectFolder(item.path);
                    } else {
                        vscode.postMessage({ type: 'openFile', path: item.path });
                    }
                };

                const nameBox = div.querySelector('.content-name');
                nameBox.ondblclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    startRename(item, nameBox);
                };
                
                div.onclick = (e) => {
                    e.stopPropagation();
                    if (item.type === 'folder') {
                        highlightFolder(item.path, div);
                    } else {
                        selectAsset(item, div);
                    }
                };
                
                div.ondblclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (item.type === 'folder') {
                        selectFolder(item.path);
                    } else {
                        vscode.postMessage({ type: 'openFile', path: item.path });
                    }
                };

                div.oncontextmenu = (e) => { 
                    currentSelectedPath = item.path; 
                    showItemContextMenu(e, item); 
                };
                
                grid.appendChild(div);
            });
        }

        function showTreeContextMenu(e) {
            e.preventDefault();
            e.stopPropagation(); // Чтобы не всплывало глобальное меню
            
            const items = [
                { label: 'Expand All', action: 'expandAll' },
                { label: 'Collapse All', action: 'collapseAll' }
            ];
            
            renderContextMenu(e.pageX, e.pageY, items);
        }
        
        function showGlobalContextMenu(e) {
            e.preventDefault();
            let templateItems = [];
            if (templatesList.length > 0) {
                templateItems = templatesList.map(t => ({ label: t.name, action: 'createFromTemplate', arg: t.path }));
            } else {
                templateItems = [{ label: 'No templates available', disabled: true }];
            }

            // Формируем первый пункт меню динамически
            let createSceneItem;
            if (customTemplateName) {
                createSceneItem = { label: \`Create \${customTemplateName}\`, action: 'createScene' };
            } else {
                // Если путь в настройках не указан, можно либо ничего не показывать, 
                // либо оставить старый пункт (на ваше усмотрение). 
                // В данном коде мы его просто скрываем или делаем disabled, если нужно убрать совсем.
                createSceneItem = { label: 'Create File (Not Configured)', disabled: true };
            }

            const items = [
                { label: 'Create Empty Script', action: 'createEmptyScript' },
                createSceneItem, // Вставляем наш динамический пункт
                { label: 'Create from Template', submenu: templateItems },
                { separator: true },
                { label: 'Create Folder', action: 'createFolder' },
                { separator: true },
                { label: 'Paste', action: 'paste', arg: state.currentFolderPath, disabled: !clipboardActive },
                { separator: true },
                { label: 'Reveal in File Explorer', action: 'revealInExplorer', arg: state.currentFolderPath || '' }
            ];
            
            // Фильтруем disabled пункты, если хотим совсем скрыть не настроенный Create File
            // const finalItems = items.filter(i => !i.disabled || i.label !== 'Create File (Not Configured)');
            
            renderContextMenu(e.pageX, e.pageY, items);
        }

        function showItemContextMenu(e, item) {
            e.preventDefault(); e.stopPropagation();
            const items = [];

            const addCutCopy = () => {
                items.push(
                    { label: 'Cut', action: 'cut', arg: item.path },
                    { label: 'Copy', action: 'copy', arg: item.path }
                );
            };

            const addCopyRelative = () => {
                items.push({ label: 'Copy Relative Path', action: 'copyPath', arg: item.path });
            };

            const addReveal = () => {
                items.push({ label: 'Reveal in File Explorer', action: 'revealInExplorer', arg: item.path });
            };

            const addRenameDelete = () => {
                items.push(
                    { label: 'Rename...', action: 'triggerRename', arg: item.path },
                    { label: 'Delete', action: 'delete', arg: item.path }
                );
            };

            const isScript = item.extension === '.js' || item.extension === '.ts';
            const isMedia = item.type === 'audio' || item.type === 'image';

            if (isScript) {
                items.push({ label: 'Import', action: 'import', arg: item.path });
                items.push({ separator: true });
                addCutCopy();
                items.push({ separator: true });
                addCopyRelative();
                items.push({ separator: true });
                addReveal();
                items.push({ separator: true });
                addRenameDelete();
            } else if (isMedia) {
                addCutCopy();
                items.push({ separator: true });
                items.push({ label: 'Copy Key', action: 'copyKey', arg: item.name });
                items.push({ label: 'Copy Relative Path', action: 'copyPath', arg: item.path });
                items.push({ separator: true });
                addReveal();
                items.push({ separator: true });
                addRenameDelete();
            } else {
                addCutCopy();
                items.push({ separator: true });
                addCopyRelative();
                items.push({ separator: true });
                addReveal();
                items.push({ separator: true });
                addRenameDelete();
            }

            renderContextMenu(e.pageX, e.pageY, items);
        }

        function renderContextMenu(x, y, items, parentEl = null) {
            const container = parentEl || document.getElementById('ctxMenu');
            container.innerHTML = '';
            items.forEach(i => {
                if (i.separator) {
                    const sep = document.createElement('div'); sep.className = 'menu-separator'; container.appendChild(sep);
                } else {
                    const el = document.createElement('div'); el.className = 'menu-item';
                    if(i.disabled) el.classList.add('disabled');
                    const span = document.createElement('span'); span.textContent = i.label; el.appendChild(span);
                    if (i.submenu) {
                        const arrow = document.createElement('span'); arrow.className = 'menu-arrow'; arrow.textContent = '▶'; el.appendChild(arrow);
                        const sub = document.createElement('div'); sub.className = 'context-submenu'; el.appendChild(sub);
                        i.submenu.forEach(subItem => {
                            const subEl = document.createElement('div'); subEl.className = 'menu-item';
                            if(subItem.disabled) subEl.classList.add('disabled');
                            subEl.textContent = subItem.label;
                            subEl.onclick = (e) => { e.stopPropagation(); if(!subItem.disabled) { exec(subItem.action, subItem.arg); document.getElementById('ctxMenu').style.display = 'none'; } };
                            sub.appendChild(subEl);
                        });
                    }
                    if (!i.submenu && !i.disabled) {
                        el.onclick = () => { exec(i.action, i.arg); container.style.display = 'none'; };
                    }
                    container.appendChild(el);
                }
            });
            if (!parentEl) {
                container.style.display = 'block';
                if (x + 180 > window.innerWidth) x = window.innerWidth - 180;
                if (y + container.offsetHeight > window.innerHeight) y = window.innerHeight - container.offsetHeight;
                container.style.left = x + 'px'; container.style.top = y + 'px';
                const hide = () => { container.style.display = 'none'; document.removeEventListener('click', hide); };
                setTimeout(() => document.addEventListener('click', hide), 10);
            }
        }

        function renderTree(folders) {
            const container = document.getElementById('treeContainer'); container.innerHTML = '';
            if (folders.length === 0) { container.innerHTML = \`<div class="empty-tree-msg">No folders configured.<br><button class="btn-link" onclick="vscode.postMessage({type:'openSettings'})">Configure</button></div>\`; return; }
            const buildNode = (item, level = 0) => {
                const wrapper = document.createElement('div');
                const nodeRow = document.createElement('div');
                nodeRow.className = 'tree-node'; nodeRow.dataset.path = item.path;
                if(item.path === state.currentFolderPath) nodeRow.classList.add('selected');
                const indent = document.createElement('span'); indent.style.width = (level * 12 + 8) + 'px'; indent.style.display = 'inline-block'; nodeRow.appendChild(indent);
                const arrow = document.createElement('span'); arrow.className = 'tree-arrow';
                if (!item.children || item.children.length === 0) arrow.classList.add('hidden');
                arrow.textContent = '▶'; 
                if (state.expandedNodes.has(item.path)) arrow.classList.add('expanded');
                nodeRow.appendChild(arrow);
                const icon = document.createElement('span'); icon.style.marginRight = '6px'; icon.textContent = '📁'; nodeRow.appendChild(icon);
                const label = document.createElement('span'); label.className = 'tree-label'; label.textContent = item.name; nodeRow.appendChild(label);
                wrapper.appendChild(nodeRow);
                if (item.children && item.children.length > 0) {
                    const childrenContainer = document.createElement('div');
                    childrenContainer.style.display = state.expandedNodes.has(item.path) ? 'block' : 'none';
                    item.children.forEach(child => childrenContainer.appendChild(buildNode(child, level + 1)));
                    wrapper.appendChild(childrenContainer);
                    const toggle = (e) => {
                        e.stopPropagation(); const expanding = childrenContainer.style.display === 'none';
                        childrenContainer.style.display = expanding ? 'block' : 'none';
                        arrow.classList.toggle('expanded', expanding);
                        expanding ? state.expandedNodes.add(item.path) : state.expandedNodes.delete(item.path);
                        saveState();
                    };
                    arrow.onclick = toggle; nodeRow.ondblclick = toggle;
                }
                nodeRow.onclick = (e) => { if (e.target !== arrow) selectFolder(item.path); };
                nodeRow.ondragover = (e) => e.preventDefault();
                nodeRow.ondrop = (e) => { e.preventDefault(); e.stopPropagation(); const d = JSON.parse(e.dataTransfer.getData('text/plain') || '{}'); if (d.path) vscode.postMessage({ type: 'moveItem', sourcePath: d.path, targetPath: item.path }); };
                return wrapper;
            };
            folders.forEach(f => container.appendChild(buildNode(f)));
        }

        function setupResizers() {
             const r1 = document.getElementById('resizer1'); const r2 = document.getElementById('resizer2');
             const handle = (r, p, right) => {
                 r.onmousedown = (e) => {
                     e.preventDefault(); r.classList.add('active'); const startX=e.clientX; const startW=parseInt(getComputedStyle(p).width);
                     const move = (ev) => { const w = right ? startW-(ev.clientX-startX) : startW+(ev.clientX-startX); if(w>100 && w<600) { right?state.detailsWidth=w:state.treeWidth=w; rootStyles.setProperty(right?'--details-width':'--tree-width', w+'px'); } };
                     const up = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); r.classList.remove('active'); saveState(); };
                     document.addEventListener('mousemove', move); document.addEventListener('mouseup', up);
                 };
             };
             handle(r1, document.getElementById('treePanel'), false); handle(r2, detailsPanel, true);
        }
        function setupTreeControls() { document.getElementById('btnExpandAll').onclick=()=>{ document.querySelectorAll('.tree-arrow').forEach(a=>{a.classList.add('expanded'); if(a.parentElement.nextElementSibling) a.parentElement.nextElementSibling.style.display='block'; state.expandedNodes.add(a.parentElement.dataset.path); }); saveState(); }; document.getElementById('btnCollapseAll').onclick=()=>{ document.querySelectorAll('.tree-arrow').forEach(a=>{a.classList.remove('expanded'); if(a.parentElement.nextElementSibling) a.parentElement.nextElementSibling.style.display='none'; }); state.expandedNodes.clear(); saveState(); }; }
        function setupGridControls() { const s=document.getElementById('iconSizeSlider'); s.oninput=(e)=>{state.thumbnailSize=e.target.value; rootStyles.setProperty('--thumb-size', e.target.value+'px');}; s.onchange=()=>saveState(); }
        function saveState() { vscode.postMessage({ type: 'saveState', state: { ...state, expandedNodes: Array.from(state.expandedNodes) } }); }
        
        // MODIFIED: Removed Windows Explorer drag-and-drop support (files handling)
        async function handleDroppedData(e, specificTargetPath) {
             const finalTarget = specificTargetPath || state.currentFolderPath;
             
             if (!finalTarget) {
                 return;
             }

             const plainText = e.dataTransfer.getData('text/plain');
             const uriList = e.dataTransfer.getData('text/uri-list');

             // 1. Internal move (JSON)
             if (plainText && plainText.trim().startsWith('{')) {
                 try {
                     const data = JSON.parse(plainText);
                     if (data.path && data.type) {
                        if(data.path !== finalTarget) {
                            vscode.postMessage({ 
                                type: 'moveItem', 
                                sourcePath: data.path, 
                                targetPath: finalTarget 
                            });
                        }
                        return;
                     }
                 } catch(err) {
                     // Not internal move
                 }
             }

             // 2. VS Code Explorer (text/uri-list) - Only this, no Windows Explorer files
             if (uriList) {
                 vscode.postMessage({ type: 'handleUriList', uriList: uriList, targetPath: finalTarget });
                 return;
             }
             
             // 3. Fallback: Text as path
             if (plainText) {
                 if (plainText.indexOf('file://') === 0 || plainText.indexOf(':') === 1 || plainText.indexOf('/') === 0) {
                     vscode.postMessage({ type: 'handleUriList', uriList: plainText, targetPath: finalTarget });
                 }
             }
        }
        
        function setupDnD() {
             const onDragActivity = (e) => {
                 e.preventDefault();
                 e.stopPropagation();
                 e.dataTransfer.dropEffect = 'copy';
             };

             document.addEventListener('dragenter', onDragActivity, true);
             document.addEventListener('dragover', onDragActivity, true);

             document.addEventListener('drop', async (e) => {
                 e.preventDefault();
                 await handleDroppedData(e, state.currentFolderPath);
             });
        }

        // MODIFIED: Select only filename without extension when renaming
        function startRename(item, nameSpan) { 
            const oldName = item.name;
            const input = document.createElement('input');
            input.type = 'text';
            input.value = oldName;
            input.className = 'rename-input';
            nameSpan.style.display = 'none';
            nameSpan.parentNode.insertBefore(input, nameSpan);
            
            // Select only the filename without extension
            const lastDotIndex = oldName.lastIndexOf('.');
            const selectRange = () => {
                if (lastDotIndex > 0 && item.type !== 'folder') {
                    // File has extension, select only the name part
                    input.setSelectionRange(0, lastDotIndex);
                } else {
                    // No extension or folder, select all
                    input.select();
                }
            };
            
            input.focus();
            // Use setTimeout to ensure selection happens after focus
            setTimeout(selectRange, 0);
            
            const finish = () => { 
                const newName = input.value.trim(); 
                if (newName && newName !== oldName) {
                    vscode.postMessage({ type: 'rename', oldPath: item.path, newName: newName }); 
                }
                if(input.parentNode) input.parentNode.removeChild(input); 
                nameSpan.style.display = 'block'; 
            };
            input.onblur = finish;
            input.onkeydown = (e) => { 
                if(e.key === 'Enter') finish(); 
                if(e.key === 'Escape') { 
                    if(input.parentNode) input.parentNode.removeChild(input); 
                    nameSpan.style.display = 'block'; 
                } 
            };
            input.onclick = (e) => e.stopPropagation(); 
            input.ondblclick = (e) => e.stopPropagation();
        }

        window.addEventListener('message', e => {
            const msg = e.data;
            switch(msg.type) {
                case 'treeData': renderTree(msg.data); break;
                case 'folderContent': renderContent(msg.items, msg.path); break;
                case 'audioData': initAudioPlayer(msg.data); break;
                case 'clipboardState': clipboardActive = msg.active; break;
                case 'templatesList': templatesList = msg.list; break;
                case 'templateConfig': customTemplateName = msg.templateName; break;
            }
        });
        
        init();
    </script>
</body>
</html>`;
    }
}

module.exports = WebviewContent;


