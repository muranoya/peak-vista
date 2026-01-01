import { TerrainRenderer } from './renderer.js';
import { NetworkFetcher } from './network-fetcher.js';
import { TileCacheManager } from './tile-cache.js';
import { TerrainViewManager } from './terrain-view.js';
import { UIController } from './ui-controller.js';
import { PerformanceMonitor } from './performance-monitor.js';
import { DeviceDetector } from './device-detector.js';
import { MapViewManager } from './map-view.js';
import { MapRenderer } from './map-renderer.js';
import { ElevationLookup } from './elevation-lookup.js';
import { ViewModeManager, VIEW_MODE } from './view-mode-manager.js';

// Import WASM module
import init, {
    ElevationParser,
    MeshGenerator,
    CoordinateTransform,
    get_version,
} from '../wasm/peak_vista_wasm.js';

class PeakVistaApp {
    constructor() {
        // Device detection (must be first)
        this.deviceDetector = new DeviceDetector();
        this.optimizationProfile = this.deviceDetector.getOptimizationProfile();

        this.canvas = document.getElementById('canvas');

        // Initialize renderers
        this.terrainRenderer = new TerrainRenderer(this.canvas);
        this.mapRenderer = null; // Will be initialized later

        // Networking and caching
        this.fetcher = new NetworkFetcher({ format: 'dem_png' });
        this.tileCache = new TileCacheManager();

        // View managers
        this.terrainView = null;
        this.mapView = null;
        this.elevationLookup = null;
        this.viewModeManager = null;

        // WASM module
        this.wasmModule = null;
        this.elevationParser = null;

        // UI and monitoring
        this.uiController = null;
        this.perfMonitor = new PerformanceMonitor();

        this.statusDiv = document.getElementById('status');
        this.locationForm = document.getElementById('location-form');

        this.currentViewpoint = null;
        this.loadedTiles = new Set();
        this.isLoading = false;

        // Legacy reference for backward compatibility
        this.renderer = this.terrainRenderer;

        this.setupEventListeners();

        // Make utilities accessible from console for debugging
        window.perfMonitor = this.perfMonitor;
        window.deviceDetector = this.deviceDetector;
        window.app = this;
    }

    async init() {
        try {
            // Log device information
            const deviceInfo = this.deviceDetector.getDeviceInfo();
            console.group('Device Detection');
            console.log('Device:', deviceInfo.isMobile ? 'Mobile' : 'Desktop');
            console.log('GPU:', this.deviceDetector.gpuInfo.renderer);
            console.log('Memory:', this.deviceDetector.memory + 'GB');
            console.log('Optimization Profile:', this.optimizationProfile);
            console.groupEnd();

            // Show device status
            let deviceStatus = this.deviceDetector.isMobile ? 'Mobile' : 'Desktop';
            if (this.deviceDetector.isTablet) {
                deviceStatus = 'Tablet';
            }
            this.updateStatus(
                `Device: ${deviceStatus} | Memory: ${this.deviceDetector.memory}GB | Max Tiles: ${this.optimizationProfile.maxTiles}`,
                'info'
            );

            // Initialize WASM module
            this.updateStatus('Initializing WASM module...', 'loading');
            await init();
            const version = get_version();
            console.log('WASM module loaded:', version);

            // Store ElevationParser reference
            this.elevationParser = ElevationParser;

            // Initialize tile cache
            this.updateStatus('Initializing tile cache...', 'loading');
            await this.tileCache.init();

            // Initialize map view and renderer
            this.updateStatus('Initializing map view...', 'loading');
            this.mapView = new MapViewManager(CoordinateTransform);
            this.mapRenderer = new MapRenderer(this.canvas, this.mapView);

            // Initialize elevation lookup
            this.elevationLookup = new ElevationLookup(
                this.fetcher,
                ElevationParser,
                CoordinateTransform
            );

            // Initialize terrain view manager
            this.terrainView = new TerrainViewManager(CoordinateTransform);

            // Initialize view mode manager
            this.viewModeManager = new ViewModeManager(this);

            // Initialize UI controller
            this.uiController = new UIController(this);

            // Setup view mode switch callback
            this.viewModeManager.onModeChanged((mode) => {
                this.updateUIForMode(mode);
            });

            this.updateStatus(`Ready - ${version}`, 'success');
        } catch (error) {
            this.updateStatus(`Failed to initialize: ${error.message}`, 'error');
            console.error('Initialization failed:', error);
        }
    }

    setupEventListeners() {
        // Basic form submission - now handled by UIController
        // Keep this for backward compatibility
        this.locationForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const lat = parseFloat(document.getElementById('lat-input').value);
            const lon = parseFloat(document.getElementById('lon-input').value);
            const angle = parseFloat(document.getElementById('angle-input').value);
            const distance = parseFloat(document.getElementById('distance-input').value);

            this.loadView(lat, lon, angle, distance);
        });

        // Map canvas click handling
        this.canvas.addEventListener('click', (e) => {
            if (this.viewModeManager && this.viewModeManager.isMapMode()) {
                this.handleMapClick(e);
            }
        });

        // Map canvas mouse wheel for zoom
        this.canvas.addEventListener('wheel', (e) => {
            if (this.viewModeManager && this.viewModeManager.isMapMode()) {
                e.preventDefault();
                e.stopPropagation();
                this.handleMapZoom(e);
            }
        }, { passive: false });

        // Map canvas drag for pan
        let isPanning = false;
        let panLastX = 0;
        let panLastY = 0;

        this.canvas.addEventListener('mousedown', (e) => {
            if (this.viewModeManager && this.viewModeManager.isMapMode()) {
                isPanning = true;
                panLastX = e.clientX;
                panLastY = e.clientY;
                e.preventDefault();
            }
        });

        this.canvas.addEventListener('mousemove', (e) => {
            if (this.viewModeManager && this.viewModeManager.isMapMode() && isPanning) {
                const deltaX = e.clientX - panLastX;
                const deltaY = e.clientY - panLastY;

                // Pan the map in the opposite direction (user drags right = map moves left)
                if (this.mapView) {
                    this.mapView.panByPixels(deltaX, deltaY);
                }

                panLastX = e.clientX;
                panLastY = e.clientY;
                e.preventDefault();
            }
        });

        document.addEventListener('mouseup', () => {
            isPanning = false;
        });
    }

    /**
     * Handle map click - load 3D view at clicked location
     */
    async handleMapClick(event) {
        if (!this.mapRenderer) return;

        const rect = this.canvas.getBoundingClientRect();
        const pixelX = event.clientX - rect.left;
        const pixelY = event.clientY - rect.top;

        // Get lat/lon at click point
        const { lat, lon } = this.mapRenderer.getTileAtPixel(pixelX, pixelY);

        console.log(`Map clicked at ${lat.toFixed(4)}°, ${lon.toFixed(4)}°`);

        // Get elevation at point
        this.updateStatus(`Loading elevation data at ${lat.toFixed(4)}°, ${lon.toFixed(4)}°...`, 'loading');

        const elevation = await this.elevationLookup.getElevation(lat, lon);

        if (elevation !== null) {
            console.log(`Elevation at point: ${elevation.toFixed(1)}m`);
            this.updateStatus(`Elevation: ${elevation.toFixed(1)}m | Loading 3D view...`, 'loading');

            // Update form values
            document.getElementById('lat-input').value = lat.toFixed(6);
            document.getElementById('lon-input').value = lon.toFixed(6);
            document.getElementById('angle-input').value = '0';
            document.getElementById('distance-input').value = '10';

            // Switch to terrain mode and load view
            await this.viewModeManager.switchMode(VIEW_MODE.TERRAIN);
            await this.loadView(lat, lon, 0, 10);
        } else {
            this.updateStatus(`Failed to get elevation data`, 'error');
        }
    }

    /**
     * Handle map zoom
     */
    handleMapZoom(event) {
        // Use smaller increments for smoother zoom
        const zoomDelta = event.deltaY > 0 ? -0.5 : 0.5;
        this.mapView.changeZoom(zoomDelta);

        // Log for debugging
        console.log(`Zoom level: ${this.mapView.zoomLevel.toFixed(2)}`);
    }

    /**
     * Update UI based on view mode
     */
    updateUIForMode(mode) {
        if (mode === VIEW_MODE.MAP) {
            // Hide 3D controls, show map hint
            const controlsDiv = document.getElementById('controls');
            if (controlsDiv) {
                controlsDiv.style.display = 'none';
            }
            this.updateStatus('Map view active. Scroll to zoom, drag to pan, click to view terrain.', 'info');
        } else if (mode === VIEW_MODE.TERRAIN) {
            // Show 3D controls
            const controlsDiv = document.getElementById('controls');
            if (controlsDiv) {
                controlsDiv.style.display = 'block';
            }
            this.updateStatus('3D view active. Click and drag to rotate, scroll to zoom.', 'info');
        }
    }

    async loadView(lat, lon, angle, distance) {
        if (this.isLoading) {
            this.updateStatus('Already loading...', 'loading');
            return;
        }

        this.isLoading = true;
        this.currentViewpoint = { lat, lon, angle, distance };

        try {
            this.updateStatus(
                `Loading view from ${lat.toFixed(4)}°, ${lon.toFixed(4)}°...`,
                'loading'
            );

            // Set viewpoint in terrain manager
            this.terrainView.setViewpoint(lat, lon, angle, distance);

            // Calculate required tiles based on viewpoint and distance
            let requiredTiles = this.terrainView.calculateRequiredTiles(14);

            // Apply device constraints
            const maxTiles = this.optimizationProfile.maxTiles;
            const maxLodLevel = this.optimizationProfile.maxLodLevel;

            // Limit tile count and LOD based on device capability
            if (requiredTiles.length > maxTiles) {
                // Sort by distance and keep closest tiles
                requiredTiles = requiredTiles.slice(0, maxTiles);
                this.updateStatus(
                    `Device limit: ${maxTiles} tiles (calculated ${requiredTiles.length + maxTiles})`,
                    'info'
                );
            }

            // Apply LOD limit
            requiredTiles = requiredTiles.map((tile) => ({
                ...tile,
                lod: Math.min(tile.lod, maxLodLevel),
            }));

            this.updateStatus(
                `Calculated ${requiredTiles.length} tiles. Checking cache...`,
                'loading'
            );

            // Separate cached and network tiles
            const tilesToFetch = [];
            const meshGenerator = new MeshGenerator(2.0);

            for (const tileInfo of requiredTiles) {
                const cachedData = await this.tileCache.getTile(tileInfo.z, tileInfo.x, tileInfo.y);

                if (cachedData) {
                    // Process cached tile
                    this.processTileData(tileInfo, cachedData, meshGenerator);
                } else {
                    // Need to fetch from network
                    tilesToFetch.push(tileInfo);
                }
            }

            if (tilesToFetch.length > 0) {
                this.updateStatus(
                    `Fetching ${tilesToFetch.length} tiles from network...`,
                    'loading'
                );

                // Fetch network tiles with error handling
                const fetchResults = await Promise.allSettled(
                    tilesToFetch.map((tile) => this.fetcher.fetchTile(tile.z, tile.x, tile.y))
                );

                let successCount = 0;
                let failureCount = 0;

                // Process fetched tiles
                for (let i = 0; i < fetchResults.length; i++) {
                    const result = fetchResults[i];
                    const tileInfo = tilesToFetch[i];

                    if (result.status === 'fulfilled') {
                        try {
                            // Cache the raw data
                            await this.tileCache.storeTile(
                                tileInfo.z,
                                tileInfo.x,
                                tileInfo.y,
                                result.value
                            );

                            // Process tile
                            const tileData = { ...tileInfo, data: result.value };
                            this.processTileData(tileData, result.value, meshGenerator);
                            successCount++;
                        } catch (error) {
                            console.error(
                                `Failed to process network tile ${tileInfo.z}/${tileInfo.x}/${tileInfo.y}:`,
                                error
                            );
                            failureCount++;
                        }
                    } else {
                        console.warn(
                            `Failed to fetch tile ${tileInfo.z}/${tileInfo.x}/${tileInfo.y}:`,
                            result.reason
                        );
                        failureCount++;
                    }
                }

                if (failureCount > 0) {
                    this.updateStatus(
                        `Warning: ${failureCount} tiles failed to load (${successCount}/${tilesToFetch.length} success)`,
                        'info'
                    );
                }
            }

            // Evict LRU tiles if memory is getting full
            this.renderer.evictLRUTiles(this.optimizationProfile.maxTiles);

            // Get camera position from terrain view manager
            const cameraPos = this.terrainView.getCameraPosition();
            this.renderer.setCameraPosition(cameraPos.x, cameraPos.y, cameraPos.z);

            // Get cache stats and memory stats
            const cacheStats = this.tileCache.getStats();
            const memStats = this.renderer.getMemoryStats();

            this.updateStatus(
                `Loaded ${this.loadedTiles.size} tiles | Memory: ${memStats.geometryMemory}MB | Triangles: ${memStats.totalTriangles.toLocaleString()}`,
                'success'
            );
        } catch (error) {
            this.updateStatus(`Error: ${error.message}`, 'error');
            console.error('Failed to load view:', error);
        } finally {
            this.isLoading = false;
        }
    }

    processTileData(tileInfo, data, meshGenerator) {
        try {
            const tileKey = `${tileInfo.z}/${tileInfo.x}/${tileInfo.y}`;
            console.log(`Processing tile ${tileKey} (LOD ${tileInfo.lod})`);

            // Profile PNG parsing
            this.perfMonitor.startTiming('png-parse');
            const elevations = ElevationParser.parse_png(new Uint8Array(data));
            const parseDuration = this.perfMonitor.endTiming('png-parse');
            console.log(`✓ PNG parsed in ${parseDuration.toFixed(2)}ms: ${elevations.length} elevation values`);

            // Profile mesh generation
            this.perfMonitor.startTiming('mesh-generation');
            const meshData = meshGenerator.generate(elevations, 1000, tileInfo.lod);
            const meshDuration = this.perfMonitor.endTiming('mesh-generation');

            const vertexCount = meshData.get_vertices().length / 3;
            const indexCount = meshData.get_indices().length;
            const triangleCount = indexCount / 3;
            console.log(
                `✓ Mesh generated in ${meshDuration.toFixed(2)}ms: vertices=${vertexCount}, triangles=${triangleCount}`
            );

            // Use absolute coordinates for relative positioning
            const baseTileX = Math.floor(CoordinateTransform.latlon_to_tile_x(this.currentViewpoint.lon, 14));
            const baseTileY = Math.floor(CoordinateTransform.latlon_to_tile_y(this.currentViewpoint.lat, 14));

            const relTileX = tileInfo.x - baseTileX;
            const relTileY = tileInfo.y - baseTileY;

            // Profile mesh creation in Three.js
            this.perfMonitor.startTiming('threejs-mesh-create');
            const success = this.renderer.createTerrainMesh(tileInfo.z, relTileX, relTileY, meshData);
            const createDuration = this.perfMonitor.endTiming('threejs-mesh-create');
            console.log(`✓ Mesh created in Three.js in ${createDuration.toFixed(2)}ms: ${success}`);

            this.loadedTiles.add(tileKey);

            // Log tile statistics
            this.perfMonitor.measurements[`tile-${tileInfo.lod}`] =
                this.perfMonitor.measurements[`tile-${tileInfo.lod}`] || [];
            this.perfMonitor.measurements[`tile-${tileInfo.lod}`].push(parseDuration + meshDuration + createDuration);
        } catch (error) {
            console.error(`Failed to process tile ${tileInfo.z}/${tileInfo.x}/${tileInfo.y}:`, error);
        }
    }

    updateStatus(message, className = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const newLine = `[${timestamp}] ${message}`;

        if (className === 'info') {
            this.statusDiv.classList.remove('loading', 'error');
        } else {
            this.statusDiv.classList.remove('loading', 'error');
            if (className === 'loading' || className === 'success') {
                this.statusDiv.classList.add('loading');
            } else if (className === 'error') {
                this.statusDiv.classList.add('error');
            }
        }

        // Keep last 20 lines
        const lines = this.statusDiv.textContent.split('\n').slice(-19);
        lines.push(newLine);
        this.statusDiv.textContent = lines.join('\n');

        // Auto-scroll to bottom
        this.statusDiv.scrollTop = this.statusDiv.scrollHeight;
    }

    start() {
        // Start render loop
        let frameCount = 0;
        const updateInfoInterval = 10; // Update info every 10 frames

        // Start terrain renderer with animation loop
        this.terrainRenderer.animate(() => {
            // Record frame for performance monitoring
            this.perfMonitor.recordFrame();

            // If in map mode, update map renderer
            if (this.viewModeManager && this.viewModeManager.isMapMode() && this.mapRenderer) {
                // Map rendering is handled by its own animate loop
            }

            // Animation frame callback
            frameCount++;
            if (frameCount % updateInfoInterval === 0) {
                // Update camera info and performance stats periodically (3D mode only)
                if (
                    this.viewModeManager &&
                    this.viewModeManager.isTerrainMode() &&
                    this.uiController &&
                    this.terrainRenderer.cameraController
                ) {
                    this.uiController.updateCameraInfo(
                        this.terrainRenderer.cameraController,
                        this.loadedTiles,
                        this.terrainRenderer,
                        this.perfMonitor
                    );
                }
            }
        });

        // Start map renderer animation loop
        if (this.mapRenderer) {
            this.mapRenderer.animate(() => {
                // Map update happens in the loop
            });
        }

        console.log('Peak Vista initialized and running');

        // Switch to map mode initially
        this.viewModeManager.switchMode(VIEW_MODE.MAP).then(() => {
            this.updateStatus('Map view ready. Scroll to zoom, drag to pan, click to view terrain.', 'success');
        });

        // Log device info to console
        this.deviceDetector.logDeviceInfo();
    }
}

// Initialize and start app
async function main() {
    const app = new PeakVistaApp();
    await app.init();
    app.start();
    window.app = app; // For debugging
}

// Start when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
} else {
    main();
}
