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

        this.setupRenderer();
        this.setupLighting();

        window.addEventListener('resize', () => this.onWindowResize());
        this.onWindowResize();
    }

    setupRenderer() {
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setClearColor(0x87ceeb, 1);
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
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
        // Get visible tiles
        const visibleTiles = this.mapView.getVisibleTiles();

        // Track which tiles are visible now
        const visibleKeys = new Set();

        // Load and position tiles
        visibleTiles.forEach((tile) => {
            const key = `${tile.z}/${tile.x}/${tile.y}`;
            visibleKeys.add(key);

            if (!this.tileMeshes.has(key)) {
                this.loadTile(tile);
            } else {
                // Update position in case zoom changed
                this.updateTilePosition(key, tile);
            }
        });

        // Remove non-visible tiles
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
     * Update tile position (called when zoom changes)
     */
    updateTilePosition(key, tile) {
        const mesh = this.tileMeshes.get(key);
        if (!mesh) return;

        const centerTileX = this.mapView.coordinateTransform.latlon_to_tile_x(
            this.mapView.centerLon,
            this.mapView.zoomLevel
        );
        const centerTileY = this.mapView.coordinateTransform.latlon_to_tile_y(
            this.mapView.centerLat,
            this.mapView.zoomLevel
        );

        const tileOffsetX = (tile.x - centerTileX) * 256;
        const tileOffsetY = (tile.y - centerTileY) * 256;

        mesh.position.x = tileOffsetX;
        mesh.position.y = -tileOffsetY;
    }

    /**
     * Load and display a tile
     */
    loadTile(tile) {
        const key = `${tile.z}/${tile.x}/${tile.y}`;
        const url = this.mapView.getTileUrl(tile.z, tile.x, tile.y);

        this.textureLoader.load(
            url,
            (texture) => {
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
                const centerTileX = this.mapView.coordinateTransform.latlon_to_tile_x(
                    this.mapView.centerLon,
                    this.mapView.zoomLevel
                );
                const centerTileY = this.mapView.coordinateTransform.latlon_to_tile_y(
                    this.mapView.centerLat,
                    this.mapView.zoomLevel
                );

                // Calculate offset from center tile
                const tileOffsetX = (tile.x - centerTileX) * 256;
                const tileOffsetY = (tile.y - centerTileY) * 256;

                // Center the viewport on the center of screen
                const screenCenterX = 0;
                const screenCenterY = 0;

                mesh.position.x = screenCenterX + tileOffsetX;
                mesh.position.y = screenCenterY - tileOffsetY; // Flip Y for screen coordinates
                mesh.position.z = 0;

                this.scene.add(mesh);
                this.tileMeshes.set(key, mesh);

                console.log(`Loaded tile ${key} at (${mesh.position.x}, ${mesh.position.y})`);
            },
            undefined,
            (error) => {
                console.warn(`Failed to load tile ${key}:`, error);
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
