/**
 * Map Renderer
 * Renders 2D map using Three.js
 */

import * as THREE from 'three';

export class MapRenderer {
    constructor(canvasElement, mapViewManager) {
        this.canvas = canvasElement;
        this.mapView = mapViewManager;

        // Three.js setup
        this.scene = new THREE.Scene();
        this.camera = new THREE.OrthographicCamera(
            -window.innerWidth / 2,
            window.innerWidth / 2,
            window.innerHeight / 2,
            -window.innerHeight / 2,
            0.1,
            1000
        );
        this.camera.position.z = 100;

        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            preserveDrawingBuffer: false,
        });

        this.tileMeshes = new Map();
        this.textureLoader = new THREE.TextureLoader();

        // Performance optimization: tile loading queue
        this.tileLoadQueue = [];
        this.loadingTiles = new Set();
        this.maxConcurrentLoads = 4; // Limit concurrent tile loads
        this.lastZoomLevel = 8;

        this.setupRenderer();
        this.setupLighting();

        window.addEventListener('resize', () => this.onWindowResize());
        this.onWindowResize();
    }

    setupRenderer() {
        // Use lower pixel ratio on high-DPI devices for performance
        const pixelRatio = Math.min(window.devicePixelRatio, 2);
        this.renderer.setPixelRatio(pixelRatio);
        this.renderer.setClearColor(0x87ceeb, 1);
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        
        // Disable shadows and post-processing for better performance
        this.renderer.shadowMap.enabled = false;
    }

    setupLighting() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);
    }

    onWindowResize() {
        const width = window.innerWidth;
        const height = window.innerHeight;

        this.camera.left = -width / 2;
        this.camera.right = width / 2;
        this.camera.top = height / 2;
        this.camera.bottom = -height / 2;
        this.camera.updateProjectionMatrix();

        this.renderer.setSize(width, height);
        this.mapView.init(width, height);
    }

    /**
     * Update and render map
     */
    updateMap() {
        const currentZoom = Math.round(this.mapView.zoomLevel);

        // If zoom level changed significantly, aggressively unload out-of-view tiles
        if (Math.abs(currentZoom - this.lastZoomLevel) > 2) {
            // Clear queue and abort pending loads for old zoom level
            this.tileLoadQueue = this.tileLoadQueue.filter(tile => tile.z === currentZoom);
        }
        this.lastZoomLevel = currentZoom;

        // Get visible tiles
        const visibleTiles = this.mapView.getVisibleTiles();

        // Track which tiles are visible now
        const visibleKeys = new Set();

        // Sort tiles by distance from center for priority loading
        const centerTileX = this.mapView.coordinateTransform.latlon_to_tile_x(
            this.mapView.centerLon,
            currentZoom
        );
        const centerTileY = this.mapView.coordinateTransform.latlon_to_tile_y(
            this.mapView.centerLat,
            currentZoom
        );

        const tilesWithDistance = visibleTiles.map(tile => ({
            ...tile,
            distance: Math.sqrt(
                Math.pow(tile.x - centerTileX, 2) + 
                Math.pow(tile.y - centerTileY, 2)
            )
        }));

        // Sort by distance (closest first)
        tilesWithDistance.sort((a, b) => a.distance - b.distance);

        // Load and position tiles
        tilesWithDistance.forEach((tile) => {
            const key = `${tile.z}/${tile.x}/${tile.y}`;
            visibleKeys.add(key);

            if (!this.tileMeshes.has(key) && !this.loadingTiles.has(key)) {
                // Add to queue if not already loading
                this.tileLoadQueue.push(tile);
            } else if (this.tileMeshes.has(key)) {
                // Update position in case zoom changed
                this.updateTilePosition(key, tile);
            }
        });

        // Process tile load queue
        this.processTileLoadQueue();

        // Remove non-visible tiles (but keep some for smoother transitions)
        for (const key of this.tileMeshes.keys()) {
            if (!visibleKeys.has(key)) {
                const mesh = this.tileMeshes.get(key);
                this.scene.remove(mesh);
                if (mesh.geometry) mesh.geometry.dispose();
                if (mesh.material) {
                    if (mesh.material.map) mesh.material.map.dispose();
                    mesh.material.dispose();
                }
                this.tileMeshes.delete(key);
            }
        }
    }

    /**
     * Process tile load queue with concurrency limit
     */
    processTileLoadQueue() {
        while (this.tileLoadQueue.length > 0 && this.loadingTiles.size < this.maxConcurrentLoads) {
            const tile = this.tileLoadQueue.shift();
            const key = `${tile.z}/${tile.x}/${tile.y}`;
            
            if (!this.tileMeshes.has(key)) {
                this.loadingTiles.add(key);
                this.loadTile(tile, () => {
                    this.loadingTiles.delete(key);
                    // Process next tile in queue
                    this.processTileLoadQueue();
                });
            }
        }
    }

    /**
     * Update tile position (called when zoom changes)
     */
    updateTilePosition(key, tile) {
        const mesh = this.tileMeshes.get(key);
        if (!mesh) return;

        const zoomLevel = Math.round(this.mapView.zoomLevel);
        const centerTileX = this.mapView.coordinateTransform.latlon_to_tile_x(
            this.mapView.centerLon,
            zoomLevel
        );
        const centerTileY = this.mapView.coordinateTransform.latlon_to_tile_y(
            this.mapView.centerLat,
            zoomLevel
        );

        const tileOffsetX = (tile.x - centerTileX) * 256;
        const tileOffsetY = (tile.y - centerTileY) * 256;

        mesh.position.x = tileOffsetX;
        mesh.position.y = -tileOffsetY;
    }

    /**
     * Load and display a tile
     */
    /**
     * Load and display a tile
     */
    loadTile(tile, onComplete) {
        const key = `${tile.z}/${tile.x}/${tile.y}`;
        const url = this.mapView.getTileUrl(tile.z, tile.x, tile.y);

        // Use a timeout to abort tile loading if it takes too long
        let loadTimeout = setTimeout(() => {
            console.warn(`Tile ${key} load timeout`);
            this.loadingTiles.delete(key);
            if (onComplete) onComplete();
        }, 10000); // 10 second timeout

        this.textureLoader.load(
            url,
            (texture) => {
                clearTimeout(loadTimeout);

                // Create plane geometry (256x256 px)
                const geometry = new THREE.PlaneGeometry(256, 256);

                // Create material with texture
                const material = new THREE.MeshBasicMaterial({
                    map: texture,
                    side: THREE.FrontSide,
                });

                // Create mesh
                const mesh = new THREE.Mesh(geometry, material);

                // Position tile based on center
                const zoomLevel = Math.round(this.mapView.zoomLevel);
                const centerTileX = this.mapView.coordinateTransform.latlon_to_tile_x(
                    this.mapView.centerLon,
                    zoomLevel
                );
                const centerTileY = this.mapView.coordinateTransform.latlon_to_tile_y(
                    this.mapView.centerLat,
                    zoomLevel
                );

                // Calculate offset from center tile
                const tileOffsetX = (tile.x - centerTileX) * 256;
                const tileOffsetY = (tile.y - centerTileY) * 256;

                mesh.position.x = tileOffsetX;
                mesh.position.y = -tileOffsetY;
                mesh.position.z = 0;

                // Only add if still visible
                const visibleTiles = this.mapView.getVisibleTiles();
                const isVisible = visibleTiles.some(t => 
                    t.z === tile.z && t.x === tile.x && t.y === tile.y
                );

                if (isVisible) {
                    this.scene.add(mesh);
                    this.tileMeshes.set(key, mesh);
                    console.log(`Loaded tile ${key}`);
                } else {
                    // Tile is no longer visible, dispose immediately
                    geometry.dispose();
                    material.dispose();
                    if (texture) texture.dispose();
                }

                if (onComplete) onComplete();
            },
            undefined,
            (error) => {
                clearTimeout(loadTimeout);
                console.warn(`Failed to load tile ${key}:`, error);
                if (onComplete) onComplete();
            }
        );
    }

    /**
     * Animate render loop
     */
    animate(callback) {
        const loop = () => {
            requestAnimationFrame(loop);

            // Update map display
            this.updateMap();

            if (callback) callback();
            this.render();
        };
        loop();
    }

    /**
     * Render scene
     */
    render() {
        this.renderer.render(this.scene, this.camera);
    }

    /**
     * Get lat/lon at screen position
     */
    getTileAtPixel(pixelX, pixelY) {
        try {
            const { lat, lon } = this.mapView.pixelToLatLon(pixelX, pixelY);
            return { lat, lon };
        } catch (error) {
            console.error('Failed to get tile at pixel:', error);
            return { lat: 36.5, lon: 138.0 }; // Return default if error
        }
    }

    /**
     * Get state for debugging
     */
    getState() {
        return {
            mapState: this.mapView.getState(),
            loadedTiles: this.tileMeshes.size,
        };
    }
}
