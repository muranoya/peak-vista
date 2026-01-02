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

            // Get indices from WASM (must be set before computing normals)
            const indicesArray = meshData.get_indices();
            geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(indicesArray), 1));
            
            // Get normal data from WASM
            const normalsArray = meshData.get_normals();
            geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(normalsArray), 3));

            // Compute bounds to ensure proper geometry size
            geometry.computeBoundingBox();
            geometry.computeBoundingSphere();
            
            const boundingBox = geometry.boundingBox;
            const geomWidth = boundingBox.max.x - boundingBox.min.x;
            const geomDepth = boundingBox.max.z - boundingBox.min.z;
            
            // Verify geometry integrity
            const vertexCount = geometry.attributes.position.count;
            const indexCount = geometry.index.count;
            const triangleCount = indexCount / 3;
            
            console.log(
                `Geometry ${key}: vertices=${vertexCount}, triangles=${triangleCount}, bounds=${geomWidth.toFixed(1)}x${geomDepth.toFixed(1)}m`
            );

            // Create material with proper culling and shading
            const material = new THREE.MeshStandardMaterial({
                color: 0x8b7355,
                metalness: 0.1,
                roughness: 0.8,
                flatShading: false,
                side: THREE.FrontSide,  // Back-face culling enabled for proper lighting
                transparent: false,      // Explicitly disable transparency
                depthTest: true,         // Enable depth testing
                depthWrite: true,        // Enable depth writing
            });

            // Create mesh
            const mesh = new THREE.Mesh(geometry, material);
            mesh.castShadow = true;
            mesh.receiveShadow = true;

            // Position mesh in world space
            const tileSize = 1000; // meters per tile
            mesh.position.x = x * tileSize;
            mesh.position.z = y * tileSize;
            
            // Apply minimal overlap (0.2%) to eliminate gaps between tiles
            // This is necessary due to floating-point precision in mesh generation
            const overlap = 1.002;
            mesh.scale.set(overlap, 1, overlap);
            
            // CRITICAL: Recompute normals after scaling to ensure proper lighting
            // Non-uniform scaling affects normal vectors, so we must recalculate them
            // using the inverse transpose of the scaling matrix
            geometry.computeVertexNormals();
            geometry.normalizeNormals();

            console.log(
                `Mesh positioned at (${mesh.position.x}, ${mesh.position.y}, ${mesh.position.z}), scaled=${overlap.toFixed(4)}`
            );
            console.log(`Scene children before add: ${this.scene.children.length}`);

            // Add to scene with proper z-order to avoid z-fighting
            mesh.renderOrder = z;
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

    setCameraPosition(x, y, z, targetX = 0, targetY = 0, targetZ = 0) {
        // Set camera position
        console.log(
            `Setting camera position: (${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)})`
        );
        this.camera.position.set(x, y, z);
        
        // Sync CameraController with the new camera position
        if (this.cameraController) {
            // In StreetView mode, camera position is fixed
            this.cameraController.setCameraPosition(x, y, z);
            
            // Calculate view direction (yaw, pitch) from target point if provided
            // For initial setup, calculate from target point if provided
            const dx = targetX - x;
            const dy = targetY - y;
            const dz = targetZ - z;
            const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
            
            // Only set view direction if target point is far enough from camera
            if (distance > 5) {
                // Convert to yaw and pitch
                const yaw = Math.atan2(dx, dz);
                const horizontalDistance = Math.sqrt(dx * dx + dz * dz);
                const pitch = Math.atan2(dy, horizontalDistance);
                
                this.cameraController.setViewDirection(yaw, pitch);
                
                console.log(
                    `CameraController synced: position=(${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)}), yaw=${yaw.toFixed(3)}, pitch=${pitch.toFixed(3)}`
                );
            } else {
                // Use default view direction if target is too close
                this.cameraController.resetCamera();
                console.log(
                    `CameraController reset: position=(${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)})`
                );
            }
        }
    }

    getScreenResolution() {
        return {
            width: this.canvas.clientWidth,
            height: this.canvas.clientHeight,
        };
    }
}
