/**
 * Enhanced Camera Controller
 * Provides intuitive camera control for terrain viewing
 */

export class CameraController {
    constructor(camera, canvas) {
        this.camera = camera;
        this.canvas = canvas;

        // StreetView mode: fixed camera position, only viewing direction changes
        // Camera position (world coordinates) - fixed
        this.cameraPosition = { x: 0, y: 0, z: 0 };
        
        // Viewing direction (Euler angles in radians)
        this.viewDirection = {
            yaw: 0,      // horizontal rotation (0 = looking at +z)
            pitch: -0.2, // vertical rotation (-PI/2 = down, PI/2 = up), slightly downward for better terrain view
        };

        // Control constraints
        this.minPitch = -Math.PI / 3;  // -60 degrees down
        this.maxPitch = Math.PI / 3;   // +60 degrees up
        
        // Control sensitivity
        this.rotateSensitivity = 0.005;

        // Mouse state
        this.isDragging = false;
        this.previousMousePosition = { x: 0, y: 0 };

        // Animation (for future use if needed)
        this.isAnimating = false;
        this.animationDuration = 500; // ms
        this.animationStartTime = null;
        
        // Callback for view direction changes (for loading dynamic tiles)
        this.onViewDirectionChanged = null;
        
        // Track last reported view direction to avoid excessive callbacks
        this.lastReportedYaw = this.viewDirection.yaw;
        this.lastReportedPitch = this.viewDirection.pitch;
        this.viewChangeThreshold = 0.05; // radians (~3 degrees)

        this.setupEventListeners();
        this.updateCameraPosition();
    }

    setupEventListeners() {
        // Mouse controls
        this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
        this.canvas.addEventListener('wheel', (e) => this.onMouseWheel(e));

        // Keyboard controls
        document.addEventListener('keydown', (e) => this.onKeyDown(e));
    }

    onMouseDown(event) {
        this.isDragging = true;
        this.previousMousePosition = { x: event.clientX, y: event.clientY };
    }

    onMouseMove(event) {
        if (!this.isDragging || this.isAnimating) return;

        const deltaX = event.clientX - this.previousMousePosition.x;
        const deltaY = event.clientY - this.previousMousePosition.y;

        // Update view direction based on mouse movement
        // Horizontal movement changes yaw
        this.viewDirection.yaw -= deltaX * this.rotateSensitivity;

        // Vertical movement changes pitch (with constraints)
        this.viewDirection.pitch = Math.max(
            this.minPitch,
            Math.min(this.maxPitch, this.viewDirection.pitch + deltaY * this.rotateSensitivity)
        );

        this.updateCameraPosition();

        this.previousMousePosition = { x: event.clientX, y: event.clientY };
    }

    onMouseUp(event) {
        this.isDragging = false;
    }

    onMouseWheel(event) {
        // In StreetView mode, mouse wheel is disabled (camera position is fixed)
        event.preventDefault();
    }

    onKeyDown(event) {
        if (this.isAnimating) return;

        const rotateStep = 0.1; // radians

        switch (event.key) {
            case 'ArrowUp':
                event.preventDefault();
                this.viewDirection.pitch = Math.max(
                    this.minPitch,
                    this.viewDirection.pitch + rotateStep
                );
                break;
            case 'ArrowDown':
                event.preventDefault();
                this.viewDirection.pitch = Math.min(
                    this.maxPitch,
                    this.viewDirection.pitch - rotateStep
                );
                break;
            case 'ArrowLeft':
                event.preventDefault();
                this.viewDirection.yaw += rotateStep;
                break;
            case 'ArrowRight':
                event.preventDefault();
                this.viewDirection.yaw -= rotateStep;
                break;
        }

        this.updateCameraPosition();
    }

    /**
     * Pan the camera target point
     */
    /**
     * Move camera position (mainly for compatibility)
     */
    moveCameraPosition(dx, dy, dz) {
        this.cameraPosition.x += dx;
        this.cameraPosition.y += dy;
        this.cameraPosition.z += dz;
        this.updateCameraPosition();
    }

    /**
     * Update camera position based on spherical coordinates
     */
    /**
     * Update camera position and look direction
     * In StreetView mode: camera position is fixed, only view direction changes
     */
    /**
     * Update camera position and look direction
     * In StreetView mode: camera position is fixed, only view direction changes
     */
    updateCameraPosition() {
        // Set camera position (fixed)
        this.camera.position.set(this.cameraPosition.x, this.cameraPosition.y, this.cameraPosition.z);

        // Calculate look-at target based on view direction (yaw, pitch)
        // Yaw: 0 = looking at +z, PI/2 = looking at +x, -PI/2 = looking at -x, PI = looking at -z
        // Pitch: 0 = looking at horizon, PI/2 = looking up, -PI/2 = looking down
        
        const distance = 100; // arbitrary distance for lookAt point
        const targetX = this.cameraPosition.x + distance * Math.sin(this.viewDirection.yaw) * Math.cos(this.viewDirection.pitch);
        const targetY = this.cameraPosition.y + distance * Math.sin(this.viewDirection.pitch);
        const targetZ = this.cameraPosition.z + distance * Math.cos(this.viewDirection.yaw) * Math.cos(this.viewDirection.pitch);

        this.camera.lookAt(targetX, targetY, targetZ);
        
        // Check if view direction changed significantly and notify callback
        const yawDiff = Math.abs(this.viewDirection.yaw - this.lastReportedYaw);
        const pitchDiff = Math.abs(this.viewDirection.pitch - this.lastReportedPitch);
        
        if ((yawDiff > this.viewChangeThreshold || pitchDiff > this.viewChangeThreshold) && this.onViewDirectionChanged) {
            this.onViewDirectionChanged({
                yaw: this.viewDirection.yaw,
                pitch: this.viewDirection.pitch,
                position: { ...this.cameraPosition }
            });
            
            // Update tracked values
            this.lastReportedYaw = this.viewDirection.yaw;
            this.lastReportedPitch = this.viewDirection.pitch;
        }
    }

    /**
     * Get current camera spherical coordinates
     */
    /**
     * Get current view direction
     */
    getViewDirection() {
        return { ...this.viewDirection };
    }

    /**
     * Set camera spherical coordinates
     */
    /**
     * Set view direction from Euler angles (compatibility method)
     */
    setViewDirection(yaw, pitch) {
        this.viewDirection.yaw = yaw;
        this.viewDirection.pitch = Math.max(
            this.minPitch,
            Math.min(this.maxPitch, pitch)
        );
        this.updateCameraPosition();
    }

    /**
     * Get target point
     */
    /**
     * Get camera position
     */
    getCameraPosition() {
        return { ...this.cameraPosition };
    }

    /**
     * Set target point
     */
    /**
     * Set camera position
     */
    setCameraPosition(x, y, z) {
        this.cameraPosition = { x, y, z };
        this.updateCameraPosition();
    }

    /**
     * Animate camera to a new position
     */
    /**
     * Animate view direction to target (mainly for compatibility)
     */
    async animateTo(targetYaw, targetPitch, duration = this.animationDuration) {
        if (this.isAnimating) {
            return new Promise((resolve) => {
                // Wait for current animation to finish
                const checkInterval = setInterval(() => {
                    if (!this.isAnimating) {
                        clearInterval(checkInterval);
                        this.animateTo(targetYaw, targetPitch, duration).then(resolve);
                    }
                }, 50);
            });
        }

        return new Promise((resolve) => {
            this.isAnimating = true;
            this.animationStartTime = Date.now();

            const startYaw = this.viewDirection.yaw;
            const startPitch = this.viewDirection.pitch;

            const animate = () => {
                const elapsed = Date.now() - this.animationStartTime;
                const progress = Math.min(elapsed / duration, 1);

                // Easing function (ease-in-out)
                const easeProgress = progress < 0.5 ? 2 * progress * progress : -1 + 4 * progress - 2 * progress * progress;

                // Interpolate view direction
                this.viewDirection.yaw = startYaw + (targetYaw - startYaw) * easeProgress;
                this.viewDirection.pitch = Math.max(
                    this.minPitch,
                    Math.min(this.maxPitch, startPitch + (targetPitch - startPitch) * easeProgress)
                );

                this.updateCameraPosition();

                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    this.isAnimating = false;
                    resolve();
                }
            };

            animate();
        });
    }

    /**
     * Reset camera to default position
     */
    /**
     * Reset view direction to default
     */
    /**
     * Reset view direction to default
     */
    resetCamera() {
        this.viewDirection = {
            yaw: 0,
            pitch: -0.2,  // Slightly downward for better terrain view
        };
        this.updateCameraPosition();
    }

    /**
     * Get camera state (for saving/loading)
     */
    /**
     * Get camera state (for saving/loading)
     */
    getState() {
        return {
            cameraPosition: { ...this.cameraPosition },
            viewDirection: { ...this.viewDirection },
        };
    }

    /**
     * Set camera state (for saving/loading)
     */
    /**
     * Set camera state (for saving/loading)
     */
    setState(state) {
        if (state.cameraPosition) {
            this.cameraPosition = { ...state.cameraPosition };
        }
        if (state.viewDirection) {
            this.viewDirection = { ...state.viewDirection };
        }
        this.updateCameraPosition();
    }

    // Compatibility methods for old API
    /**
     * Get spherical coordinates (for compatibility with old code)
     */
    getSphericalCoordinates() {
        // Convert current position and view direction to spherical coordinates
        // This is mainly for UI display purposes
        const dx = Math.sin(this.viewDirection.yaw) * Math.cos(this.viewDirection.pitch);
        const dy = Math.sin(this.viewDirection.pitch);
        const dz = Math.cos(this.viewDirection.yaw) * Math.cos(this.viewDirection.pitch);
        
        return {
            radius: 5000, // dummy value for compatibility
            theta: this.viewDirection.yaw,
            phi: Math.PI / 2 - this.viewDirection.pitch, // convert to old phi convention
        };
    }

    /**
     * Get target point (for compatibility with old code)
     */
    getTargetPoint() {
        return { ...this.cameraPosition };
    }
}
