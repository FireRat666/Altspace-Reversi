(function () {
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
        hideBoard: false,
        useCustomModels: false,
        lighting: 'unlit',
        addLights: true
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
        config.hideBoard = getParam('hideBoard', String(config.hideBoard)) === 'true';
        config.instance = getParam('instance', config.instance);
        config.useCustomModels = getParam('useCustomModels', String(config.useCustomModels)) === 'true';
        config.lighting = getParam('lighting', config.lighting);
        config.addLights = getParam('addLights', String(config.addLights)) !== 'false';

        config.boardScale = parseVector3(getParam('boardScale'), config.boardScale);
        config.boardPosition = parseVector3(getParam('boardPosition'), config.boardPosition);
        config.boardRotation = parseVector3(getParam('boardRotation'), config.boardRotation);

        config.resetPosition = parseVector3(getParam('resetPosition'), config.resetPosition);
        config.resetRotation = parseVector3(getParam('resetRotation'), config.resetRotation);
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
        board: '#2E8B57',    // SeaGreen
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
        if (!config.hideUI) {
            await createResetButton();
        }

        setupListeners();
        
        // Initial Sync
        await checkForExistingState();
        // If no existing state, sync the initial board
        syncBoard();
    }

    async function setupGrid() {
        const size = state.tileSize;
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

    async function createResetButton() {
        const btn = await createBanterObject(
            state.boardRoot,
            BS.GeometryType.BoxGeometry,
            { width: 1.0, height: 0.2, depth: 0.4 },
            '#D50000',
            config.resetPosition,
            true
        );
        btn.name = "ResetButton";
        
        let t = btn.GetComponent(BS.ComponentType.Transform);
        t.localEulerAngles = config.resetRotation;
        t.localScale = config.resetScale;

        btn.On('click', () => {
            console.log("Reversi: Reset clicked");
            window.reversiGame.reset();
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

    function handleSquareClick(row, col) {
        const game = window.reversiGame;
        console.log(`Clicked: (${row}, ${col})`);
        console.log(`Current Player: ${game.currentPlayer}`);
        console.log(`Game Over: ${game.gameOver}, Is Syncing: ${state.isSyncing}`);
        
        if (game.gameOver || state.isSyncing) return;

        const captures = game.getCaptures(row, col, game.currentPlayer);
        console.log(`Captures length for (${row}, ${col}): ${captures.length}`);

        // Check if move is valid locally first
        if (captures.length > 0) {
            state.isSyncing = true; // Lock
            if (game.makeMove(row, col)) {
                syncState();
            } else {
                state.isSyncing = false; // Unlock on failed move
            }
        } else {
            console.log("Invalid Move");
        }
    }

    function syncState() {
        const key = `reversi_game_${config.instance}`;
        const data = window.reversiGame.getState();
        BS.BanterScene.GetInstance().SetPublicSpaceProps({ [key]: JSON.stringify(data) });
        // Optimistic update
        syncBoard();
    }

    async function syncBoard() {
        if (state.syncLock) {
            state.pendingSync = true;
            return;
        }
        state.syncLock = true;

        try {
            const game = window.reversiGame;
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
                                        new BS.Vector3(xPos, 0.15, zPos),
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
                                    const mat = piece.GetComponent(BS.ComponentType.BanterMaterial);
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
                                    const crown = await createBanterObject(
                                        state.piecesRoot,
                                        BS.GeometryType.CylinderGeometry,
                                        { radius: 0.15, height: 0.1 },
                                        '#FFD700', // Gold color
                                        new BS.Vector3(xPos, 0.25, zPos),
                                        false
                                    );
                                    const ct = crown.GetComponent(BS.ComponentType.Transform);
                                    ct.localScale = new BS.Vector3(1, 0.5, 1);
                                    state.crowns[key] = crown;
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

            // Highlight Valid Moves
            for (let r = 0; r < 8; r++) {
                for (let c = 0; c < 8; c++) {
                    const key = `${r}_${c}`;
                    const tile = state.tiles[key];
                    if (tile) {
                        const mat = tile.GetComponent(BS.ComponentType.BanterMaterial);
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
                window.reversiGame.loadState(data);
                syncBoard();
            } catch (e) {
                console.error("Failed to parse reversi state", e);
            }
        }
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
                        window.reversiGame.loadState(data);
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
        if (!window.reversiGame) {
            window.reversiGame = new ReversiGame();
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