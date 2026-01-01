import * as THREE from 'three';
import { CameraController } from './camera-controller.js';

export class TerrainRenderer {
    constructor(canvasElement) {
        this.canvas = canvasElement;
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(
            60,
            window.innerWidth / window.innerHeight,
            0.1,
            100000
        );

        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            preserveDrawingBuffer: false,
        });

        this.tileMeshes = new Map();
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.cameraController = null;

        this.setupRenderer();
        this.setupLighting();
        this.setupCamera();
        this.setupControls();

        window.addEventListener('resize', () => this.onWindowResize());
        this.onWindowResize();
    }

    setupRenderer() {
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setClearColor(0x87ceeb, 1);
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    }

    setupLighting() {
        // Directional light (sun)
        const sunLight = new THREE.DirectionalLight(0xffffff, 1.0);
        sunLight.position.set(1, 2, 1);
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.width = 2048;
        sunLight.shadow.mapSize.height = 2048;
        this.scene.add(sunLight);

        // Ambient light
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        this.scene.add(ambientLight);

        // Hemisphere light
        const hemisphereLight = new THREE.HemisphereLight(0x87ceeb, 0x654321, 0.5);
        this.scene.add(hemisphereLight);

        this.sunLight = sunLight;
    }

    setupCamera() {
        this.camera.position.set(0, 1000, 2000);
        this.camera.lookAt(0, 0, 0);
    }

    setupControls() {
        // Initialize enhanced camera controller
        this.cameraController = new CameraController(this.camera, this.canvas);
    }

    onWindowResize() {
        const width = window.innerWidth;
        const height = window.innerHeight;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();

        this.renderer.setSize(width, height);
    }

    createTerrainMesh(z, x, y, meshData) {
        const key = `${z}/${x}/${y}`;

        // Remove existing mesh
        if (this.tileMeshes.has(key)) {
            const oldMesh = this.tileMeshes.get(key);
            this.scene.remove(oldMesh);
            oldMesh.geometry.dispose();
            oldMesh.material.dispose();
        }

        try {
            // Create geometry from WASM data
            const geometry = new THREE.BufferGeometry();

            // Get vertex data from WASM
            const verticesArray = meshData.get_vertices();
            geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verticesArray), 3));

            // Get normal data from WASM
            const normalsArray = meshData.get_normals();
            geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(normalsArray), 3));

            // Get indices from WASM
            const indicesArray = meshData.get_indices();
            geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(indicesArray), 1));

            // Create material
            const material = new THREE.MeshStandardMaterial({
                color: 0x8b7355,
                metalness: 0.1,
                roughness: 0.8,
                flatShading: false,
                side: THREE.DoubleSide,
            });

            // Create mesh
            const mesh = new THREE.Mesh(geometry, material);
            mesh.castShadow = true;
            mesh.receiveShadow = true;

            // Position mesh in world space
            const tileSize = 1000; // meters per tile
            mesh.position.x = x * tileSize;
            mesh.position.z = y * tileSize;

            console.log(
                `Mesh positioned at (${mesh.position.x}, ${mesh.position.y}, ${mesh.position.z})`
            );
            console.log(`Scene children before add: ${this.scene.children.length}`);

            // Add to scene
            this.scene.add(mesh);
            this.tileMeshes.set(key, mesh);

            console.log(`Scene children after add: ${this.scene.children.length}`);
            console.log(`Tile meshes stored: ${this.tileMeshes.size}`);

            return true;
        } catch (error) {
            console.error(`Failed to create mesh for tile ${key}:`, error);
            console.error(error.stack);
            return false;
        }
    }

    removeTile(z, x, y) {
        const key = `${z}/${x}/${y}`;
        if (this.tileMeshes.has(key)) {
            const mesh = this.tileMeshes.get(key);
            this.scene.remove(mesh);

            // Properly dispose of geometry and material
            if (mesh.geometry) {
                mesh.geometry.dispose();
            }
            if (mesh.material) {
                if (Array.isArray(mesh.material)) {
                    mesh.material.forEach((mat) => mat.dispose());
                } else {
                    mesh.material.dispose();
                }
            }

            this.tileMeshes.delete(key);
        }
    }

    /**
     * Evict least recently used tiles to save memory
     */
    evictLRUTiles(maxTiles = 30) {
        if (this.tileMeshes.size <= maxTiles) {
            return;
        }

        const tilesToRemove = this.tileMeshes.size - maxTiles;

        // Get tiles and remove oldest ones
        const keys = Array.from(this.tileMeshes.keys());
        for (let i = 0; i < tilesToRemove; i++) {
            const [z, x, y] = keys[i].split('/').map(Number);
            this.removeTile(z, x, y);
        }

        console.log(`Evicted ${tilesToRemove} tiles. Remaining: ${this.tileMeshes.size}`);
    }

    /**
     * Get total triangle count for all meshes
     */
    getTotalTriangleCount() {
        let total = 0;

        this.tileMeshes.forEach((mesh) => {
            if (mesh.geometry && mesh.geometry.index) {
                total += mesh.geometry.index.count / 3;
            }
        });

        return total;
    }

    /**
     * Get memory statistics
     */
    getMemoryStats() {
        let geometryMemory = 0;
        let materialMemory = 0;
        let textureMemory = 0;

        this.tileMeshes.forEach((mesh) => {
            if (mesh.geometry) {
                // Rough estimate: vertices * 3 * 4 bytes (position) + normals + indices
                geometryMemory += mesh.geometry.attributes.position.array.byteLength;
                if (mesh.geometry.attributes.normal) {
                    geometryMemory += mesh.geometry.attributes.normal.array.byteLength;
                }
                if (mesh.geometry.index) {
                    geometryMemory += mesh.geometry.index.array.byteLength;
                }
            }
        });

        return {
            geometryMemory: Math.round(geometryMemory / 1024 / 1024 * 100) / 100, // MB
            materialMemory: Math.round(materialMemory / 1024 / 1024 * 100) / 100,
            textureMemory: Math.round(textureMemory / 1024 / 1024 * 100) / 100,
            totalTiles: this.tileMeshes.size,
            totalTriangles: this.getTotalTriangleCount(),
        };
    }

    getActiveTiles() {
        return Array.from(this.tileMeshes.keys());
    }

    render() {
        this.renderer.render(this.scene, this.camera);
    }

    animate(callback) {
        const loop = () => {
            requestAnimationFrame(loop);
            if (callback) callback();
            this.render();
        };
        loop();
    }

    setCameraPosition(x, y, z) {
        // Support both old (lat, lon, distance) and new (x, y, z) signatures
        if (typeof x === 'number' && typeof y === 'number' && typeof z === 'number') {
            // New signature: world coordinates
            console.log(
                `Setting camera position: (${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)})`
            );
            this.camera.position.set(x, y, z);
            this.camera.lookAt(0, 0, 0);
        } else {
            // Legacy: assume x=lat, y=lon, z=distance
            const lat = x;
            const lon = y;
            const distance = z;
            const height = 1000 + distance / 2;
            const radius = distance / 2;

            console.log(`Camera setting: height=${height}, radius=${radius}, distance=${distance}`);
            this.camera.position.set(radius, height, radius);
            this.camera.lookAt(0, 0, 0);
        }
    }

    getScreenResolution() {
        return {
            width: this.canvas.clientWidth,
            height: this.canvas.clientHeight,
        };
    }
}
