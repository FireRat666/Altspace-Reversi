(function () {
    // One game per copy of this script, so several boards on a page don't share a game.
    let reversiGame = null;
    /**
     * Banter Reversi (Othello) Embed Script
     * A fully synced multiplayer Reversi game for Banter.
     */

    // --- Configuration ---
    const config = {
        boardPosition: [0, 1.1, -2],
        boardRotation: [0, 0, 0],
        boardScale: [1, 1, 1],
        resetPosition: [0, 0, 2.5],
        resetRotation: [0, 0, 0],
        resetScale: [1, 1, 1],
        instance: window.location.href.split('?')[0],
        hideUI: false,
        turnCooldown: 5, // Seconds before the same person can move for the other side; 0 = off
        volume: 0.4, // Sound effect volume, 0-1; 0 = no sounds
        soundNear: 2.5, // Metres from the game where sounds are at full volume
        soundFar: 10, // Metres from the game where sounds fade out completely
        mutePosition: null, // null (0 0 0) = automatic: beside the Reset button
        muteRotation: [0, 0, 0],
        muteScale: [1, 1, 1],
        hideBoard: false,
        useCustomModels: true,
        lighting: 'lit',
        addLights: false
    };

    const PIECE_MODELS = {
        1: 'DiscDarkestGrey.glb', // Black
        2: 'DiscGrey.glb',        // White
        'highlight': 'DiscGreen.glb' // Valid move hint potentially? Or just tile highlight.
    };

    // Helper to parse Vector3 from string
    const parseVector3 = (str, defaultVal) => {
        if (!str) return defaultVal;
        const s = str.trim();
        if (s.includes(' ')) {
            const parts = s.split(' ').map(Number);
            if (parts.length === 3) return [parts[0], parts[1], parts[2]];
        } else {
            const val = parseFloat(s);
            if (!isNaN(val)) return [val, val, val];
        }
        return defaultVal;
    };

    // Parse URL params or script attributes from this script tag immediately
    const currentScript = document.currentScript;
    const scriptSrc = currentScript ? currentScript.src : null;

    if (currentScript) {
        const getParam = (name, defaultValue) => {
            if (!currentScript) return defaultValue;
            
            const getFromURL = (key) => {
                try {
                    const base = typeof window !== 'undefined' ? window.location.href : 'http://localhost';
                    const url = new URL(currentScript.src, base);
                    const params = new URLSearchParams(url.search);
                    if (params.has(key)) return params.get(key);
                    const lowerKey = key.toLowerCase();
                    for (const [pKey, pVal] of params.entries()) {
                        if (pKey.toLowerCase() === lowerKey) {
                            return pVal;
                        }
                    }
                } catch (e) {}
                return null;
            };

            const getFromScriptTag = (key) => {
                try {
                    if (currentScript.hasAttribute(key)) {
                        return currentScript.getAttribute(key);
                    }
                    const lowerKey = key.toLowerCase();
                    if (currentScript.hasAttribute(lowerKey)) {
                        return currentScript.getAttribute(lowerKey);
                    }
                    const datasetKey = key.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
                    if (currentScript.dataset && currentScript.dataset[datasetKey] !== undefined) {
                        return currentScript.dataset[datasetKey];
                    }
                } catch (e) {}
                return null;
            };

            const keys = [name];
            const aliases = {
                boardPosition: ['position', 'board-position'],
                boardRotation: ['rotation', 'board-rotation'],
                boardScale: ['scale', 'board-scale'],
                hideUI: ['hide-ui'],
                turnCooldown: ['turn-cooldown'],
                volume: ['sound-volume'],
                soundNear: ['sound-near'],
                soundFar: ['sound-far'],
                mutePosition: ['mute-position'],
                muteRotation: ['mute-rotation'],
                muteScale: ['mute-scale'],
                hideBoard: ['hide-board'],
                useCustomModels: ['use-custom-models'],
                addLights: ['add-lights'],
                useAOBaking: ['use-ao-baking'],
                boardSize: ['board-size'],
                piecesOpacity: ['pieces-opacity'],
                scoreboardPosition: ['scoreboard-position'],
                scoreboardRotation: ['scoreboard-rotation'],
                scoreboardScale: ['scoreboard-scale'],
                resetPosition: ['reset-position'],
                resetRotation: ['reset-rotation'],
                resetScale: ['reset-scale'],
                passPosition: ['pass-position'],
                passRotation: ['pass-rotation'],
                passScale: ['pass-scale']
            };

            if (aliases[name]) {
                aliases[name].forEach(alias => {
                    if (!keys.includes(alias)) keys.push(alias);
                });
            }

            for (const key of keys) {
                const val = getFromURL(key);
                if (val !== null) return val;
            }
            for (const key of keys) {
                const val = getFromScriptTag(key);
                if (val !== null) return val;
            }

            return defaultValue;
        };

        config.hideUI = getParam('hideUI', String(config.hideUI)) === 'true';
        config.turnCooldown = parseFloat(getParam('turnCooldown', String(config.turnCooldown)));
        if (isNaN(config.turnCooldown)) config.turnCooldown = 5;
        config.volume = parseFloat(getParam('volume', String(config.volume)));
        if (isNaN(config.volume)) config.volume = 0.4;
        config.soundNear = parseFloat(getParam('soundNear', String(config.soundNear)));
        if (isNaN(config.soundNear)) config.soundNear = 2.5;
        config.soundFar = parseFloat(getParam('soundFar', String(config.soundFar)));
        if (isNaN(config.soundFar)) config.soundFar = 10;
        // 0 0 0 means automatic (beside the Reset button)
        config.mutePosition = parseVector3(getParam('mutePosition'), null);
        if (config.mutePosition && config.mutePosition.every(n => n === 0)) config.mutePosition = null;
        config.muteRotation = parseVector3(getParam('muteRotation'), config.muteRotation);
        config.muteScale = parseVector3(getParam('muteScale'), config.muteScale);
        config.hideBoard = getParam('hideBoard', String(config.hideBoard)) === 'true';
        config.instance = getParam('instance', config.instance);
        config.useCustomModels = getParam('useCustomModels', String(config.useCustomModels)) === 'true';
        config.lighting = getParam('lighting', config.lighting);
        // 'lit' is a true/false switch (a checkbox in the snippet editor); it overrides 'lighting'.
        const litParam = getParam('lit', null);
        if (litParam !== null) config.lighting = litParam === 'true' ? 'lit' : 'unlit';
        config.addLights = getParam('addLights', String(config.addLights)) !== 'false';

        config.boardScale = parseVector3(getParam('boardScale'), config.boardScale);
        config.boardPosition = parseVector3(getParam('boardPosition'), config.boardPosition);
        config.boardRotation = parseVector3(getParam('boardRotation'), config.boardRotation);

        config.resetPosition = parseVector3(getParam('resetPosition'), config.resetPosition);
        config.resetRotation = parseVector3(getParam('resetRotation'), config.resetRotation);
        config.scoreboardPosition = parseVector3(getParam('scoreboardPosition'), null);
        // 0 0 0 means automatic (the turn sign's default spot)
        if (config.scoreboardPosition && config.scoreboardPosition.every(n => n === 0)) config.scoreboardPosition = null;
        config.scoreboardRotation = parseVector3(getParam('scoreboardRotation'), null);
        config.scoreboardScale = parseVector3(getParam('scoreboardScale'), null);
        config.resetScale = parseVector3(getParam('resetScale'), config.resetScale);
    }

    function getModelUrl(modelName) {
        try {
            if (scriptSrc) {
                return new URL(`../Models/${modelName}`, scriptSrc).href;
            }
        } catch (e) { console.error("Error resolving model URL:", e); }
        return `../Models/${modelName}`;
    }

    // --- Reversi Game Logic ---
    class ReversiGame {
        constructor() {
            this.rows = 8;
            this.cols = 8;
            this.reset();
        }

        reset() {
            // 0 = Empty, 1 = Black, 2 = White
            this.board = Array(this.rows).fill(null).map(() => Array(this.cols).fill(0));
            
            // Initial setup: Center 4 pieces
            this.board[3][3] = 2; // White
            this.board[3][4] = 1; // Black
            this.board[4][3] = 1; // Black
            this.board[4][4] = 2; // White

            this.currentPlayer = 1; // Black moves first
            this.winner = null;
            this.gameOver = false;
            this.skippedTurn = false;
        }

        // Check if a move at (row, col) captures any opponent pieces
        getCaptures(row, col, player) {
            if (this.board[row][col] !== 0) return [];

            const opponent = player === 1 ? 2 : 1;
            const captures = [];
            const directions = [
                [-1, -1], [-1, 0], [-1, 1],
                [0, -1],           [0, 1],
                [1, -1],  [1, 0],  [1, 1]
            ];

            for (const [dr, dc] of directions) {
                let r = row + dr;
                let c = col + dc;
                const potential = [];

                // Walk in direction while we see opponent pieces
                while (r >= 0 && r < this.rows && c >= 0 && c < this.cols && this.board[r][c] === opponent) {
                    potential.push([r, c]);
                    r += dr;
                    c += dc;
                }

                // If we ended on our own piece and captured something in between
                if (r >= 0 && r < this.rows && c >= 0 && c < this.cols && this.board[r][c] === player && potential.length > 0) {
                    captures.push(...potential);
                }
            }
            return captures;
        }

        hasValidMoves(player) {
            for (let r = 0; r < this.rows; r++) {
                for (let c = 0; c < this.cols; c++) {
                    if (this.getCaptures(r, c, player).length > 0) return true;
                }
            }
            return false;
        }

        makeMove(row, col) {
            if (this.gameOver) return false;

            const captures = this.getCaptures(row, col, this.currentPlayer);
            if (captures.length === 0) return false;

            // Place piece
            this.board[row][col] = this.currentPlayer;

            // Flip captured pieces
            for (const [r, c] of captures) {
                this.board[r][c] = this.currentPlayer;
            }

            this.endTurn();
            return true;
        }

        endTurn() {
            const nextPlayer = this.currentPlayer === 1 ? 2 : 1;

            if (this.hasValidMoves(nextPlayer)) {
                this.currentPlayer = nextPlayer;
                this.skippedTurn = false;
            } else {
                // Next player has no moves
                if (this.hasValidMoves(this.currentPlayer)) {
                    // Current player goes again
                    console.log(`Player ${nextPlayer} has no moves. Player ${this.currentPlayer} goes again.`);
                    this.skippedTurn = true;
                } else {
                    // Neither player can move -> Game Over
                    this.gameOver = true;
                    this.calculateWinner();
                }
            }

            // Also check if board is full
            if (!this.gameOver) {
                let full = true;
                for (let r = 0; r < this.rows; r++) {
                    for (let c = 0; c < this.cols; c++) {
                        if (this.board[r][c] === 0) {
                            full = false;
                            break;
                        }
                    }
                }
                if (full) {
                    this.gameOver = true;
                    this.calculateWinner();
                }
            }
        }

        calculateWinner() {
            let black = 0, white = 0;
            for (let r = 0; r < this.rows; r++) {
                for (let c = 0; c < this.cols; c++) {
                    if (this.board[r][c] === 1) black++;
                    else if (this.board[r][c] === 2) white++;
                }
            }
            if (black > white) this.winner = 1;
            else if (white > black) this.winner = 2;
            else this.winner = 'draw';
            console.log(`Game Over. Black: ${black}, White: ${white}. Winner: ${this.winner}`);
        }

        getState() {
            return {
                board: this.board,
                currentPlayer: this.currentPlayer,
                winner: this.winner,
                gameOver: this.gameOver
            };
        }

        loadState(state) {
            this.board = state.board;
            this.currentPlayer = state.currentPlayer;
            this.winner = state.winner;
            this.gameOver = state.gameOver;
        }
    }

    // --- Banter Visuals ---
    const COLORS = {
        board: '#1E7A46',    // Felt green squares
        boardBase: '#0E2016', // Shows through the gaps between squares as grid lines
        frame: '#4A2C16',    // Wooden frame round the board
        crown: '#F2C230',    // Gold crown on the winner's discs
        black: '#111111',
        white: '#EEEEEE',
        valid: '#50ABF2',    // Blue hint for valid moves
        selected: '#76F250'  // Green highlight (not strictly used in Reversi click-to-place)
    };

    function hexToVector4(hex, alpha = 1.0) {
        let c = hex.substring(1);
        if (c.length === 3) c = c.split('').map(x => x + x).join('');
        const num = parseInt(c, 16);
        return new BS.Vector4(((num >> 16) & 255) / 255, ((num >> 8) & 255) / 255, (num & 255) / 255, alpha);
    }

    const state = {
        tiles: {},
        pieces: {}, // Map "row_col" -> GameObject
        crowns: {},
        boardRoot: null,
        piecesRoot: null,
        isSyncing: false,
        tileSize: 0.5,
        boardSize: 8,
        offset: 0,
        syncLock: false,
        pendingSync: false
    };
    state.offset = (state.boardSize * state.tileSize) / 2 - (state.tileSize / 2);

    async function setupScene() {
        console.log("Reversi: Setup Scene Started");

        state.boardRoot = await new BS.GameObject("ReversiBoardRoot").Async();
        
        let t = await state.boardRoot.AddComponent(new BS.Transform());
        t.position = config.boardPosition;
        t.localEulerAngles = config.boardRotation;
        t.localScale = config.boardScale;

        // Add lights if lit
        if (config.lighting === 'lit' && config.addLights) {
            const lightGO = await new BS.GameObject("Reversi_DirectionalLight");
            await lightGO.SetParent(state.boardRoot, false);
            let lightTrans = await lightGO.AddComponent(new BS.Transform());
            lightTrans.localPosition = new BS.Vector3(0, 5, -5);
            lightTrans.localEulerAngles = new BS.Vector3(45, 0, 0);
            await lightGO.AddComponent(new BS.Light(1, new BS.Vector4(1, 1, 1, 1), 1, 0.1));
        }

        // Create Pieces Root
        state.piecesRoot = await new BS.GameObject("PiecesRoot").Async();
        await state.piecesRoot.SetParent(state.boardRoot, false);
        await state.piecesRoot.AddComponent(new BS.Transform());

        // Create Board Tiles (Lazy setup for pieces)
        await setupGrid();

        // Create Reset Button
        // With hideUI the reset button is invisible but still clickable, with its label showing (as in Go)
        await createResetButton();
        await createTurnBoard(state.boardRoot, config.scoreboardPosition || [0, 1.5, 0], config.scoreboardRotation || [0, 0, 0], config.scoreboardScale || [1, 1, 1], 2.4, 0.4, true);

        setupListeners();
        
        // Initial Sync
        await checkForExistingState();
        // If no existing state, sync the initial board
        syncBoard();
    }

    // A dark base under the squares (the gaps between them read as grid lines), a wooden frame,
    // and the four small dots of a classic Othello board.
    async function createBoardBase() {
        const span = state.boardSize * state.tileSize;
        const rail = 0.18;
        const box = (dims, color, pos) => createBanterObject(state.boardRoot, BS.GeometryType.BoxGeometry, dims, color, pos);
        await box({ width: span, height: 0.1, depth: span }, COLORS.boardBase, new BS.Vector3(0, -0.012, 0));
        const edge = span / 2 + rail / 2;
        await box({ width: span + rail * 2, height: 0.14, depth: rail }, COLORS.frame, new BS.Vector3(0, 0, edge));
        await box({ width: span + rail * 2, height: 0.14, depth: rail }, COLORS.frame, new BS.Vector3(0, 0, -edge));
        await box({ width: rail, height: 0.14, depth: span }, COLORS.frame, new BS.Vector3(edge, 0, 0));
        await box({ width: rail, height: 0.14, depth: span }, COLORS.frame, new BS.Vector3(-edge, 0, 0));
        const dot = state.tileSize * 2;
        for (const x of [-dot, dot]) {
            for (const z of [-dot, dot]) {
                await createBanterObject(state.boardRoot, BS.GeometryType.CylinderGeometry,
                    { radius: 0.045, height: 0.104 }, COLORS.boardBase, new BS.Vector3(x, 0, z));
            }
        }
    }

    // A small gold crown: an open band with five points round its top edge.
    async function createCrown(pos) {
        const crown = await new BS.GameObject("Crown").Async();
        await crown.SetParent(state.piecesRoot, false);
        const t = await crown.AddComponent(new BS.Transform());
        t.localPosition = pos;

        const radius = 0.12;
        const band = await new BS.GameObject("Band").Async();
        await band.SetParent(crown, false);
        const bt = await band.AddComponent(new BS.Transform());
        bt.localPosition = new BS.Vector3(0, 0.025, 0);
        await band.AddComponent(new BS.BanterGeometry(
            BS.GeometryType.CylinderGeometry, null, 1, 0.05, 1, 1, 1, 1,
            radius, 32, 0, 6.283185, 0, 6.283185, 8, true, radius, radius
        ));
        const shader = config.lighting === 'lit' ? "Standard" : "Unlit/Diffuse";
        await band.AddComponent(new BS.BanterMaterial(shader, "", hexToVector4(COLORS.crown), BS.MaterialSide.Double, false));

        // Each point is a thin square turned 45 degrees into a diamond, facing outwards
        for (let i = 0; i < 5; i++) {
            const a = (i / 5) * Math.PI * 2;
            const point = await createBanterObject(crown, BS.GeometryType.BoxGeometry,
                { width: 0.05, height: 0.05, depth: 0.012 }, COLORS.crown,
                new BS.Vector3(Math.sin(a) * radius, 0.06, Math.cos(a) * radius));
            point.GetComponent(BS.ComponentType.Transform).localEulerAngles = new BS.Vector3(0, a * 180 / Math.PI, 45);
        }
        return crown;
    }

    async function setupGrid() {
        const size = state.tileSize;
        if (!config.hideBoard) await createBoardBase();
        // Parallelize tile creation
        const tilePromises = [];
        
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                tilePromises.push((async () => {
                    const squareId = `${r}_${c}`;
                    const xPos = (c * size) - state.offset;
                    const zPos = (r * size) - state.offset;

                    // Tile needs unique material for valid move highlighting
                    if (!config.hideBoard) {
                        const tile = await createBanterObject(
                            state.boardRoot,
                            BS.GeometryType.BoxGeometry,
                            { width: 0.48, height: 0.1, depth: 0.48 }, // visual dims
                            COLORS.board,
                            new BS.Vector3(xPos, 0, zPos),
                            true, // hasCollider
                            1.0, // opacity
                            { width: 0.5, height: 0.1, depth: 0.5 }, // collider dims
                            `tile_${squareId}` // cacheBust
                        );
                        tile.name = `Tile_${squareId}`;
                        tile.On('click', () => handleSquareClick(r, c));
                        state.tiles[squareId] = tile;
                    } else {
                        // Invisible collider if board invisible
                        const tile = await createBanterObject(
                            state.boardRoot,
                            BS.GeometryType.BoxGeometry,
                            { width: 0.5, height: 0.1, depth: 0.5 }, 
                            COLORS.board,
                            new BS.Vector3(xPos, 0, zPos),
                            true, 
                            0.0, // Invisible
                            null,
                            `tile_${squareId}`
                        );
                        tile.On('click', () => handleSquareClick(r, c));
                        state.tiles[squareId] = tile;
                    }

                    // Lazy Instantiation: don't create pieces yet
                    state.pieces[squareId] = null; 
                    state.crowns[squareId] = null;
                })());
            }
        }
        await Promise.all(tilePromises);
    }

    // Puts a text label on a button's face (same approach as Go's buttons). `w` and `h` are the
    // face size in metres; text is sized to fit it. `pos`/`rot` place the label on that face.
    async function addButtonLabel(btn, text, w, h, pos, rot) {
        const label = await new BS.GameObject("Label").Async();
        await label.SetParent(btn, false);
        const lt = await label.AddComponent(new BS.Transform());
        lt.localPosition = pos;
        lt.localEulerAngles = rot;
        await label.AddComponent(new BS.BanterText(
            text, new BS.Vector4(1, 1, 1, 1), BS.HorizontalAlignment.Center, BS.VerticalAlignment.Center,
            h * 5, false, false, new BS.Vector2(w * 10, h * 10)
        ));
    }

    async function createResetButton() {
        const btn = await createBanterObject(
            state.boardRoot,
            BS.GeometryType.BoxGeometry,
            { width: 1.0, height: 0.2, depth: 0.4 },
            '#D50000',
            config.resetPosition,
            true,
            config.hideUI ? 0.0 : 1.0
        );
        btn.name = "ResetButton";
        
        let t = btn.GetComponent(BS.ComponentType.Transform);
        t.localEulerAngles = config.resetRotation;
        t.localScale = config.resetScale;
        await addButtonLabel(btn, "RESET", 1.0, 0.4, new BS.Vector3(0, 0.105, 0), new BS.Vector3(90, 180, 0));
        await createMuteButton(btn, state.boardRoot, [1.0, 0.2, 0.4], true);

        btn.On('click', () => {
            console.log("Reversi: Reset clicked");
            reversiGame.reset();
            syncState();
        });
    }

    function getGeoArgs(type, dims) {
        // Defaults: width=1, height=1, depth=1, segments=24, radius=0.5
        const w = dims.width || 1;
        const h = dims.height || 1;
        const d = dims.depth || 1;
        const r = dims.radius || 0.5;

        // We only need to pass arguments up to what is required for the specific geometry.
        // Box: type, null, w, h, d (5 args)
        // Circle/Sphere: need radius (9th arg)

        if (type === BS.GeometryType.BoxGeometry) {
            return [type, null, w, h, d];
        } else if (type === BS.GeometryType.SphereGeometry) {
            // Sphere specific args for smoothness (based on CheckersExample)
            const PI2 = 6.283185;
            return [
                type, null, w, h, d,
                24, 16, 1, // widthSeg, heightSeg, depthSeg
                r, 24, // radius, segments
                0, PI2, 0, PI2,
                8, false,
                r, r
            ];
        } else {
            // For Cylinder, Sphere, Circle, etc that likely need radius or segments.
            // Arguments: type, param, w, h, d, wSeg, hSeg, dSeg, radius, segments
            // Cylinder needs radiusTop/Bottom (args 16, 17) to respect size.
            const PI2 = 6.283185;
            return [
                type, null, w, h, d,
                1, 1, 1,
                r, 24,
                0, PI2, 0, PI2,
                8, false,
                r, r // radiusTop, radiusBottom
            ];
        }
    }

    async function createBanterObject(parent, type, dims, colorHex, pos, hasCollider = false, opacity = 1.0, colliderDims = null, cacheBust = null) {
        const obj = await new BS.GameObject("Geo").Async();
        await obj.SetParent(parent, false);

        let t = await obj.AddComponent(new BS.Transform());
        if (pos) t.localPosition = pos;

        const fullArgs = getGeoArgs(type, dims);
        await obj.AddComponent(new BS.BanterGeometry(...fullArgs));

        const color = hexToVector4(colorHex, opacity);

        const shader = opacity < 1.0 ? "Unlit/DiffuseTransparent" : (config.lighting === 'lit' ? "Standard" : "Unlit/Diffuse");
        // Use cacheBust to create unique material instance for objects that need dynamic colors
        await obj.AddComponent(new BS.BanterMaterial(shader, "", color, BS.MaterialSide.Front, false, cacheBust || ""));

        if (hasCollider) {
            const cDims = colliderDims || dims;
            let colSize = new BS.Vector3(cDims.width || 1, cDims.height || 1, cDims.depth || 1);
            await obj.AddComponent(new BS.BoxCollider(true, new BS.Vector3(0, 0, 0), colSize));
            await obj.SetLayer(5);
        }

        return obj;
    }

    async function createCustomPiece(parent, player, pos) {
        let modelName;
        if (player === 1) modelName = PIECE_MODELS[1];
        else if (player === 2) modelName = PIECE_MODELS[2];
        else modelName = 'Crown.glb';

        if (!modelName) return null;

        const piece = await new BS.GameObject(`CustomPiece_${player}`).Async();
        await piece.SetParent(parent, false);

        let t = await piece.AddComponent(new BS.Transform());
        if (pos) t.localPosition = pos;
        
        const url = getModelUrl(modelName);
        
        try {
            await piece.AddComponent(new BS.BanterGLTF(url, false, false, false, false, false, false));

            // Add material for interactivity/lighting (though we might not change color of GLB directly if textured)
            // But we can.
            const shader = config.lighting === 'lit' ? "Standard" : "Unlit/Diffuse";
            
            // Reversi pieces: Black is Black, White is White.
            // If using custom models, they should be textured.
            // We can add a material to affect them if needed, or rely on GLB textures.
            // BUt we want 'lit' shader if config says so.
            // Since we can't easily replace shaders on GLB without traversing, maybe we just trust the GLB or add simple mat.
            // Let's force a material if we want to control lighting, but keep white color so texture shows?
            // Actually, for BanterGLTF, adding a material usually applies to the whole object.
            
            // For simple discs (Black/White), we can just set the color if we want.
            const colorHex = (player === 1) ? COLORS.black : COLORS.white;
            await piece.AddComponent(new BS.BanterMaterial(shader, "", hexToVector4(colorHex), BS.MaterialSide.Front, false));

            t.localScale = new BS.Vector3(0.18, 0.18, 0.18); // Matches Checkers for 0.5 grid
            t.localEulerAngles = new BS.Vector3(0, 0, 0);    // Flat rotation 
            
            piece.currentType = player; // Tag immediately on creation 
        } catch (glbErr) {
            console.error(`Failed to load GLTF for player ${player}:`, glbErr);
        }

        return piece;
    }

    const SOUND_FILES = { place: 3, flip: 3, pass: 1, win: 1, draw: 1, reset: 1 }; // name: number of takes

    // --- Sounds ---
    // Short sound effects for moves, captures, wins and resets. Each client works out what changed
    // between two game states and plays the matching sound, so everyone hears every move. Joining is
    // silent, and our own move echoed back by the space only plays once. The files are in Sounds/
    // next to this script (made by sound-tools/make_sounds.py). `volume` (0-1) sets the level;
    // 0 turns sounds off.
    const MUTE_KEY = 'banterGames_muted_reversi';
    const sounds = { files: SOUND_FILES, cache: {}, live: false, prev: null, prevKey: null, muted: false };
    try { sounds.muted = localStorage.getItem(MUTE_KEY) === '1'; } catch (e) { }

    function soundAudio(file) {
        let a = sounds.cache[file];
        if (!a) {
            a = sounds.cache[file] = new Audio(new URL(`Sounds/${file}.ogg`, scriptSrc || window.location.href).href);
            a.preload = 'auto';
        }
        return a;
    }

    // `name` is a key of SOUND_FILES; ones with several takes pick one at random.
    function playSound(name, delayMs = 0) {
        if (!(config.volume > 0) || sounds.muted) return;
        const volume = config.volume * distanceGain(config.boardPosition, config.soundNear, config.soundFar);
        if (volume < 0.005) return; // too far away to hear
        const takes = sounds.files[name] || 1;
        const file = takes > 1 ? name + (1 + Math.floor(Math.random() * takes)) : name;
        setTimeout(() => {
            try {
                const audio = soundAudio(file).cloneNode();
                audio.volume = Math.min(1, volume);
                audio.play().catch(() => {});
            } catch (e) { }
        }, delayMs);
    }

    // Call after every state change; repeats of the same state are ignored.
    function soundForState() {
        let next;
        try { next = soundSnapshot(); } catch (e) { return; }
        if (!next) return;
        const key = JSON.stringify(next);
        if (key === sounds.prevKey) return;
        const prev = sounds.prev;
        sounds.prev = JSON.parse(key);
        sounds.prevKey = key;
        if (sounds.live && prev) {
            try { chooseSounds(prev, sounds.prev); } catch (e) { console.warn("Sound error", e); }
        }
    }

    // Call once the saved game (if any) has loaded; sounds play from then on.
    function startSounds() {
        soundForState();
        sounds.live = true;
        headTracker();
        if (config.volume > 0) {
            for (const [name, takes] of Object.entries(sounds.files)) {
                if (takes > 1) for (let i = 1; i <= takes; i++) soundAudio(name + i);
                else soundAudio(name);
            }
        }
    }

    // --- Hearing distance ---
    // Sounds fade with the local player's distance from the game: full volume within `near` metres,
    // silent from `far` metres, so people elsewhere in the world aren't disturbed. The head position
    // comes from an empty object attached to the player's head (Unity reports where it is), or from
    // pose-update until that works. All the games on a page share one tracker.
    function headTracker() {
        if (window.BanterGamesHead) return window.BanterGamesHead;
        const head = window.BanterGamesHead = { marker: null, attaching: false, markerPos: null, posePos: null };
        const scene = BS.BanterScene.GetInstance();
        scene.On('pose-update', e => {
            const h = e && e.detail && e.detail.head;
            if (h && h.position) head.posePos = h.position;
        });
        const attach = async () => {
            const uid = scene.localUser && scene.localUser.uid;
            if (!uid || head.marker || head.attaching) return;
            head.attaching = true;
            try {
                const go = await new BS.GameObject("GameSoundsHead").Async();
                head.marker = go;
                if (typeof BS.AttachedObject === 'function') {
                    const point = BS.AvatarBoneName ? BS.AvatarBoneName.HEAD : 0;
                    const attached = await go.AddComponent(new BS.AttachedObject({ uid, avatarAttachmentPoint: point }));
                    await attached.Attach(uid);
                } else if (typeof scene.LegacyAttachObject === 'function' && BS.LegacyAttachmentPosition) {
                    await scene.LegacyAttachObject(go, uid, BS.LegacyAttachmentPosition.HEAD);
                } else {
                    return; // no way to attach here: pose-update only
                }
                const PN = BS.PN || BS.PropertyName;
                if (typeof go.WatchTransform === 'function' && PN) {
                    await go.WatchTransform([PN.position], t => {
                        if (head.marker === go && t && t.position) head.markerPos = t.position;
                    });
                }
            } finally {
                head.attaching = false;
            }
        };
        const tryAttach = () => attach().catch(e => console.warn("Game sounds: could not follow the head", e));
        // The SDK drops attachments when the player leaves, so the marker is made again when they
        // come back (a moment later, so the SDK is ready).
        scene.On('user-left', e => {
            if (!(e && e.detail && e.detail.isLocal)) return;
            try { if (head.marker) head.marker.Destroy(); } catch (err) { }
            head.marker = null;
            head.markerPos = null;
        });
        scene.On('user-joined', e => {
            if (e && e.detail && e.detail.isLocal && !head.marker) setTimeout(tryAttach, 5000);
        });
        (async () => {
            while (!scene.localUser || scene.localUser.uid === undefined) await new Promise(r => setTimeout(r, 500));
            await tryAttach();
        })();
        return head;
    }

    // 0-1: how loud a sound from `centre` (a world position) is for the local player.
    function distanceGain(centre, near, far) {
        const head = headTracker();
        const p = head.markerPos || head.posePos;
        if (!p || !centre) return 1; // not known yet, so play it
        const d = Math.hypot(p.x - centre.x, p.y - centre.y, p.z - centre.z);
        if (d <= near) return 1;
        if (!(far > near) || d >= far) return 0;
        const f = 1 - (d - near) / (far - near);
        return f * f;
    }

    // The mute button only mutes this game's sounds for you, and is remembered on this device. By
    // default it sits beside the Reset button, attached to it so it follows it; set mutePosition
    // (relative to the board) to place it on its own. `size` is the Reset button's
    // [width, height, depth], and `flat` is true when it lies flat with its label on top.
    async function createMuteButton(reset, parent, size, flat) {
        if (!reset) return;
        const v3 = a => Array.isArray(a) ? new BS.Vector3(...a) : a;
        const [rw, h, d] = size;
        const w = rw * 0.8;
        const btn = await new BS.GameObject("MuteButton").Async();
        const custom = !!config.mutePosition;
        await btn.SetParent(custom ? parent : reset, false);
        const t = await btn.AddComponent(new BS.Transform());
        if (custom) {
            t.localPosition = v3(config.mutePosition);
        } else {
            // Beside Reset, on the side away from the middle of the board
            const side = config.resetPosition && config.resetPosition.x < 0 ? -1 : 1;
            t.localPosition = new BS.Vector3(side * (rw / 2 + rw * 0.08 + w / 2), 0, 0);
        }
        t.localEulerAngles = v3(config.muteRotation);
        t.localScale = v3(config.muteScale);
        await btn.AddComponent(new BS.BanterGeometry(BS.GeometryType.BoxGeometry, null, w, h, d));
        // With hideUI it's invisible but still clickable, with its label showing (like Reset)
        const alpha = config.hideUI ? 0 : 1;
        const shader = config.hideUI ? 'Unlit/DiffuseTransparent' : (config.lighting === 'lit' ? 'Standard' : 'Unlit/Diffuse');
        const colour = () => sounds.muted ? new BS.Vector4(0.8, 0.42, 0.05, alpha) : new BS.Vector4(0.25, 0.25, 0.28, alpha);
        const mat = await btn.AddComponent(new BS.BanterMaterial(shader, "", colour(), BS.MaterialSide.Front, false));
        await btn.AddComponent(new BS.BoxCollider(true, new BS.Vector3(0, 0, 0), new BS.Vector3(w, h, d)));
        await btn.SetLayer(5);
        const label = await new BS.GameObject("Label").Async();
        await label.SetParent(btn, false);
        const lt = await label.AddComponent(new BS.Transform());
        lt.localPosition = flat ? new BS.Vector3(0, h / 2 + 0.005, 0) : new BS.Vector3(0, 0, d / 2 + 0.005);
        lt.localEulerAngles = flat ? new BS.Vector3(90, 180, 0) : new BS.Vector3(0, 180, 0);
        const lh = flat ? d : h;
        const text = await label.AddComponent(new BS.BanterText(
            "", new BS.Vector4(1, 1, 1, 1), BS.HorizontalAlignment.Center, BS.VerticalAlignment.Center,
            lh * 3.5, false, false, new BS.Vector2(w * 10, lh * 10)
        ));
        const update = () => {
            text.text = sounds.muted ? "UNMUTE" : "MUTE";
            mat.color = colour();
        };
        update();
        btn.On('click', () => {
            sounds.muted = !sounds.muted;
            try { localStorage.setItem(MUTE_KEY, sounds.muted ? '1' : '0'); } catch (e) { }
            update();
        });
    }

    // Cells (of a 2D board) that differ between two boards.
    function boardDiff(a, b) {
        const out = [];
        for (let r = 0; r < b.length; r++) {
            for (let c = 0; c < b[r].length; c++) {
                const was = a[r] ? a[r][c] : undefined;
                if (was !== b[r][c]) out.push({ r, c, was, now: b[r][c] });
            }
        }
        return out;
    }

    function soundSnapshot() {
        const g = reversiGame;
        return { board: g.board, currentPlayer: g.currentPlayer, winner: g.winner || null, gameOver: !!g.gameOver };
    }

    function chooseSounds(prev, next) {
        const changes = boardDiff(prev.board, next.board);
        const added = changes.filter(d => !d.was && d.now);
        const flipped = changes.filter(d => d.was && d.now).length;
        const count = next.board.flat().filter(v => v).length;
        if (changes.length && count === 4 && added.length !== 1) return playSound('reset');
        if (added.length !== 1) return;
        playSound('place');
        // One tick per flipped disc, rippling outward
        const shown = Math.min(flipped, 10);
        for (let i = 0; i < shown; i++) playSound('flip', 110 + i * 65);
        let t = 110 + shown * 65 + 120;
        if (next.gameOver && !prev.gameOver) {
            playSound(next.winner === 'draw' ? 'draw' : 'win', t);
        } else if (next.currentPlayer === added[0].now) {
            playSound('pass', t); // the other side had no move, so the same player goes again
        }
    }

    // --- Turn cooldown ---
    // Stops one person from taking both sides' turns by accident (a double click, or moving again
    // before the other player has had a chance). After you move, if it is now the other side's
    // turn, you must wait `turnCooldown` seconds before you can move for them. Someone playing on
    // their own can still play both sides; they just wait. Extra turns for the same side are not
    // affected. The time is only ever compared on the mover's own clock.
    const turnGuard = { lastMove: null, notice: '', noticeTimer: null, texts: [] };

    function localUid() {
        const user = BS.BanterScene.GetInstance().localUser;
        return user && user.uid !== undefined ? String(user.uid) : null;
    }

    // True (and shows a notice) if the local user has to wait before moving for `side`.
    function turnOnCooldown(side) {
        const m = turnGuard.lastMove;
        const uid = localUid();
        if (!m || !uid || !(config.turnCooldown > 0) || m.uid !== uid || m.side === side) return false;
        const left = config.turnCooldown * 1000 - (Date.now() - m.at);
        if (left <= 0) return false;
        showTurnNotice(`Other player's turn (${Math.ceil(left / 1000)}s)`);
        return true;
    }

    // Marks outgoing state as a move by the local user for `side`.
    function stampMove(data, side) {
        turnGuard.lastMove = { uid: localUid(), side, at: Date.now() };
        data.lastMove = turnGuard.lastMove;
        return data;
    }

    // Call with every state loaded from the space. A reset has no lastMove, which clears it.
    function loadLastMove(data) {
        turnGuard.lastMove = (data && data.lastMove) || null;
    }

    function showTurnNotice(text) {
        turnGuard.notice = text;
        clearTimeout(turnGuard.noticeTimer);
        turnGuard.noticeTimer = setTimeout(() => {
            turnGuard.notice = '';
            updateTurnBoard();
        }, 2500);
        updateTurnBoard();
    }

    function updateTurnBoard() {
        const text = turnGuard.notice || turnStatusText();
        turnGuard.texts.forEach(t => { t.text = text; });
    }

    // A small sign showing whose turn it is. Not created when hideUI is on. `twoSided` puts the
    // text on both faces, for table games played from both sides.
    async function createTurnBoard(parent, pos, rot, scale, w, h, twoSided) {
        if (config.hideUI) return;
        const v3 = a => Array.isArray(a) ? new BS.Vector3(...a) : a;
        const board = await new BS.GameObject("TurnBoard").Async();
        await board.SetParent(parent, false);
        const t = await board.AddComponent(new BS.Transform());
        t.localPosition = v3(pos);
        t.localEulerAngles = v3(rot);
        t.localScale = v3(scale);
        await board.AddComponent(new BS.BanterGeometry(BS.GeometryType.BoxGeometry, null, w, h, 0.02));
        const shader = config.lighting === 'lit' ? "Standard" : "Unlit/Diffuse";
        await board.AddComponent(new BS.BanterMaterial(shader, "", new BS.Vector4(0.96, 0.96, 0.86, 1), BS.MaterialSide.Front, false));

        const faces = twoSided ? [[0.012, 180], [-0.012, 0]] : [[0.012, 180]];
        for (const [z, yRot] of faces) {
            const textObj = await new BS.GameObject("TurnText").Async();
            await textObj.SetParent(board, false);
            const tt = await textObj.AddComponent(new BS.Transform());
            tt.localPosition = new BS.Vector3(0, 0, z);
            tt.localEulerAngles = new BS.Vector3(0, yRot, 0);
            turnGuard.texts.push(await textObj.AddComponent(new BS.BanterText(
                "", new BS.Vector4(0, 0, 0, 1), BS.HorizontalAlignment.Center, BS.VerticalAlignment.Center,
                h * 3, false, true, new BS.Vector2(w * 10, h * 10)
            )));
        }
        updateTurnBoard();
    }

    function turnStatusText() {
        const g = reversiGame;
        const names = { 1: 'Black', 2: 'White' };
        let black = 0, white = 0;
        g.board.forEach(row => row.forEach(c => { if (c === 1) black++; else if (c === 2) white++; }));
        const score = `Black ${black} - ${white} White`;
        if (g.winner === 'draw') return `Draw!  ${score}`;
        if (g.winner) return `${names[g.winner]} wins!  ${score}`;
        return `${names[g.currentPlayer]}'s turn  ${score}`;
    }

    function handleSquareClick(row, col) {
        const game = reversiGame;
        console.log(`Clicked: (${row}, ${col})`);
        console.log(`Current Player: ${game.currentPlayer}`);
        console.log(`Game Over: ${game.gameOver}, Is Syncing: ${state.isSyncing}`);
        
        if (game.gameOver || state.isSyncing) return;
        if (turnOnCooldown(game.currentPlayer)) return;
        const side = game.currentPlayer;

        const captures = game.getCaptures(row, col, game.currentPlayer);
        console.log(`Captures length for (${row}, ${col}): ${captures.length}`);

        // Check if move is valid locally first
        if (captures.length > 0) {
            state.isSyncing = true; // Lock
            if (game.makeMove(row, col)) {
                syncState(side);
            } else {
                state.isSyncing = false; // Unlock on failed move
            }
        } else {
            console.log("Invalid Move");
        }
    }

    // `side` is the player who just moved; leave it out for a reset.
    function syncState(side) {
        const key = `reversi_game_${config.instance}`;
        const data = reversiGame.getState();
        if (side !== undefined) stampMove(data, side);
        BS.BanterScene.GetInstance().SetPublicSpaceProps({ [key]: JSON.stringify(data) });
        // Optimistic update
        syncBoard();
    }

    async function syncBoard() {
        soundForState();
        if (state.syncLock) {
            state.pendingSync = true;
            return;
        }
        state.syncLock = true;

        try {
            const game = reversiGame;
            const size = state.tileSize;
            const syncPromises = [];

            for (let r = 0; r < 8; r++) {
                for (let c = 0; c < 8; c++) {
                    syncPromises.push((async () => {
                        const cell = game.board[r][c]; // 0, 1, or 2
                        const key = `${r}_${c}`;
                        
                        const xPos = (c * size) - state.offset;
                        const zPos = (r * size) - state.offset;
                        
                        if (cell === 0) {
                            // Hide existing
                            if (state.pieces[key]) state.pieces[key].SetActive(false);
                            if (state.crowns[key]) state.crowns[key].SetActive(false);
                        } else {
                            // 1. Handle Piece Destuction/Creation for Custom Models
                            let piece = state.pieces[key];
                            if (piece && config.useCustomModels) {
                                // If type mismatch, destroy it
                                if (piece.currentType !== cell) {
                                    piece.Destroy();
                                    state.pieces[key] = null;
                                    piece = null;
                                }
                            }

                            // 2. Create if missing
                            if (!piece) {
                                if (config.useCustomModels) {
                                    piece = await createCustomPiece(state.piecesRoot, cell, new BS.Vector3(xPos, 0.1, zPos));
                                } else {
                                    piece = await createBanterObject(
                                        state.piecesRoot,
                                        BS.GeometryType.SphereGeometry,
                                        { radius: 0.2, height: 0.1 },
                                        COLORS.black, 
                                        new BS.Vector3(xPos, 0.11, zPos), // Resting on the square
                                        false,
                                        1.0,
                                        null,
                                        `piece_${key}`
                                    );
                                    const pt = piece.GetComponent(BS.ComponentType.Transform);
                                    pt.localScale = new BS.Vector3(1, 0.3, 1);
                                }
                                state.pieces[key] = piece;
                            }

                            // 3. Update Appearance
                            if (piece) {
                                piece.SetActive(true);
                                if (!config.useCustomModels) {
                                     // Standard: update color
                                    const colorHex = (cell === 1) ? COLORS.black : COLORS.white;
                                    const mat = piece.GetComponent((BS.ComponentType.Material ?? BS.ComponentType.BanterMaterial));
                                    if (mat) mat.color = hexToVector4(colorHex);
                                } else {
                                     // Custom Models: Ensure type tag is set
                                     piece.currentType = cell;
                                }
                            }

                            // 2. Crown (Game Over winner highlight)
                            const showCrown = game.gameOver && game.winner && game.winner !== 'draw' && cell === game.winner;
                            if (showCrown) {
                                if (!state.crowns[key]) {
                                    // Sits on top of the disc
                                    const crownY = config.useCustomModels ? 0.22 : 0.17;
                                    state.crowns[key] = await createCrown(new BS.Vector3(xPos, crownY, zPos));
                                }
                                state.crowns[key].SetActive(true);
                            } else {
                                if (state.crowns[key]) state.crowns[key].SetActive(false);
                            }
                        }
                    })());
                }
            }
            await Promise.all(syncPromises);
            updateTurnBoard();

            // Highlight Valid Moves
            for (let r = 0; r < 8; r++) {
                for (let c = 0; c < 8; c++) {
                    const key = `${r}_${c}`;
                    const tile = state.tiles[key];
                    if (tile) {
                        const mat = tile.GetComponent((BS.ComponentType.Material ?? BS.ComponentType.BanterMaterial));
                        if (mat) {
                            const isValid = !config.hideBoard && !game.gameOver && game.getCaptures(r, c, game.currentPlayer).length > 0;
                            mat.color = hexToVector4(isValid ? COLORS.valid : COLORS.board);
                            if (config.hideBoard) mat.color.w = 0;
                        }
                    }
                }
            }
        } finally {
            state.syncLock = false;
            if (state.pendingSync) {
                state.pendingSync = false;
                syncBoard();
            } else {
                state.isSyncing = false; // Unlock input only when fully synced and no pending calls
            }
        }
    }

    async function checkForExistingState() {
        const key = `reversi_game_${config.instance}`;
        const scene = BS.BanterScene.GetInstance();
        
        // Wait for user
        while (!scene.localUser || scene.localUser.uid === undefined) {
            await new Promise(resolve => setTimeout(resolve, 200));
        }

        const s = scene.spaceState;
        const val = (s.public && s.public[key]) || (s.protected && s.protected[key]);

        if (val) {
            try {
                const data = JSON.parse(val);
                loadLastMove(data);
                reversiGame.loadState(data);
                syncBoard();
            } catch (e) {
                console.error("Failed to parse reversi state", e);
            }
        }
        startSounds();
    }

    function setupListeners() {
        const key = `reversi_game_${config.instance}`;
        BS.BanterScene.GetInstance().On("space-state-changed", e => {
            const changes = e.detail.changes;
            if (changes && changes.find(c => c.property === key)) {
                state.isSyncing = true; // Lock on remote change
                const s = BS.BanterScene.GetInstance().spaceState;
                const val = (s.public && s.public[key]) || (s.protected && s.protected[key]);
                if (val) {
                    try {
                        const data = JSON.parse(val);
                        loadLastMove(data);
                        reversiGame.loadState(data);
                        syncBoard(); // This will unlock at the end
                    } catch (e) { 
                        console.error(e);
                        state.isSyncing = false; // Unlock on error
                    }
                } else {
                    state.isSyncing = false; // Unlock if no value
                }
            }
        });
    }

    // --- Main Initializer ---
    let initialized = false;
    const initGame = async () => {
        if (initialized) return;
        initialized = true;
        console.log("Reversi: Initializing Game...");

        // Initialize game logic
        if (!reversiGame) {
            reversiGame = new ReversiGame();
        }

        // Convert config arrays to BS.Vector3 now that BS is available
        config.boardPosition = new BS.Vector3(...config.boardPosition);
        config.boardRotation = new BS.Vector3(...config.boardRotation);
        config.boardScale = new BS.Vector3(...config.boardScale);
        config.resetPosition = new BS.Vector3(...config.resetPosition);
        config.resetRotation = new BS.Vector3(...config.resetRotation);
        config.resetScale = new BS.Vector3(...config.resetScale);

        await setupScene();
    };

    // --- Check for BS availability ---
    if (window.BS) {
        initGame();
    } else {
        window.addEventListener("unity-loaded", initGame);
        window.addEventListener("bs-loaded", initGame);
    }

})();