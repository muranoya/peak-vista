/**
 * Enhanced Camera Controller
 * Provides intuitive camera control for terrain viewing
 */

export class CameraController {
    constructor(camera, canvas) {
        this.camera = camera;
        this.canvas = canvas;

        // State
        this.isDragging = false;
        this.previousMousePosition = { x: 0, y: 0 };

        // Camera parameters
        this.sphericalCoordinates = {
            radius: 5000,
            theta: 0, // azimuth angle
            phi: Math.PI / 4, // polar angle from top
        };

        this.minRadius = 500;
        this.maxRadius = 50000;
        this.minPhi = 0.1;
        this.maxPhi = Math.PI - 0.1;

        // Control sensitivity
        this.rotateSensitivity = 0.005;
        this.zoomSensitivity = 0.1;
        this.panSensitivity = 5;

        // Animation
        this.isAnimating = false;
        this.animationDuration = 500; // ms
        this.targetPosition = null;
        this.animationStartTime = null;

        // Target point (what camera looks at)
        this.targetPoint = { x: 0, y: 0, z: 0 };

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

        // Rotate based on mouse movement
        this.sphericalCoordinates.theta -= deltaX * this.rotateSensitivity;
        this.sphericalCoordinates.phi = Math.max(
            this.minPhi,
            Math.min(this.maxPhi, this.sphericalCoordinates.phi + deltaY * this.rotateSensitivity)
        );

        this.updateCameraPosition();

        this.previousMousePosition = { x: event.clientX, y: event.clientY };
    }

    onMouseUp(event) {
        this.isDragging = false;
    }

    onMouseWheel(event) {
        if (this.isAnimating) return;

        event.preventDefault();

        const zoomDirection = event.deltaY > 0 ? 1 : -1;
        const newRadius = this.sphericalCoordinates.radius + zoomDirection * 500 * this.zoomSensitivity;

        this.sphericalCoordinates.radius = Math.max(this.minRadius, Math.min(this.maxRadius, newRadius));

        this.updateCameraPosition();
    }

    onKeyDown(event) {
        if (this.isAnimating) return;

        const step = 200; // meters per key press
        const rotateStep = 0.1; // radians

        switch (event.key) {
            case 'ArrowUp':
                event.preventDefault();
                this.panTarget(0, step, 0); // Move camera forward
                break;
            case 'ArrowDown':
                event.preventDefault();
                this.panTarget(0, -step, 0); // Move camera backward
                break;
            case 'ArrowLeft':
                event.preventDefault();
                this.sphericalCoordinates.theta += rotateStep;
                break;
            case 'ArrowRight':
                event.preventDefault();
                this.sphericalCoordinates.theta -= rotateStep;
                break;
            case 'w':
                this.panTarget(0, step, 0);
                break;
            case 's':
                this.panTarget(0, -step, 0);
                break;
            case 'a':
                this.panTarget(-step, 0, 0);
                break;
            case 'd':
                this.panTarget(step, 0, 0);
                break;
            case '+':
            case '=':
                event.preventDefault();
                this.sphericalCoordinates.radius *= 0.9;
                break;
            case '-':
                event.preventDefault();
                this.sphericalCoordinates.radius *= 1.1;
                break;
        }

        this.updateCameraPosition();
    }

    /**
     * Pan the camera target point
     */
    panTarget(dx, dy, dz) {
        this.targetPoint.x += dx;
        this.targetPoint.y += dy;
        this.targetPoint.z += dz;
    }

    /**
     * Update camera position based on spherical coordinates
     */
    updateCameraPosition() {
        const { radius, theta, phi } = this.sphericalCoordinates;

        // Convert spherical to Cartesian coordinates
        const x = radius * Math.sin(phi) * Math.sin(theta);
        const y = radius * Math.cos(phi);
        const z = radius * Math.sin(phi) * Math.cos(theta);

        // Update camera position
        this.camera.position.set(this.targetPoint.x + x, this.targetPoint.y + y, this.targetPoint.z + z);

        // Look at target
        this.camera.lookAt(this.targetPoint.x, this.targetPoint.y, this.targetPoint.z);
    }

    /**
     * Get current camera spherical coordinates
     */
    getSphericalCoordinates() {
        return { ...this.sphericalCoordinates };
    }

    /**
     * Set camera spherical coordinates
     */
    setSphericalCoordinates(radius, theta, phi) {
        this.sphericalCoordinates.radius = Math.max(this.minRadius, Math.min(this.maxRadius, radius));
        this.sphericalCoordinates.theta = theta;
        this.sphericalCoordinates.phi = Math.max(
            this.minPhi,
            Math.min(this.maxPhi, phi)
        );
        this.updateCameraPosition();
    }

    /**
     * Get target point
     */
    getTargetPoint() {
        return { ...this.targetPoint };
    }

    /**
     * Set target point
     */
    setTargetPoint(x, y, z) {
        this.targetPoint = { x, y, z };
        this.updateCameraPosition();
    }

    /**
     * Animate camera to a new position
     */
    async animateTo(targetSpherical, targetPointOffset, duration = this.animationDuration) {
        if (this.isAnimating) {
            return new Promise((resolve) => {
                // Wait for current animation to finish
                const checkInterval = setInterval(() => {
                    if (!this.isAnimating) {
                        clearInterval(checkInterval);
                        this.animateTo(targetSpherical, targetPointOffset, duration).then(resolve);
                    }
                }, 50);
            });
        }

        return new Promise((resolve) => {
            this.isAnimating = true;
            this.animationStartTime = Date.now();

            const startSpherical = { ...this.sphericalCoordinates };
            const startPoint = { ...this.targetPoint };

            const animate = () => {
                const elapsed = Date.now() - this.animationStartTime;
                const progress = Math.min(elapsed / duration, 1);

                // Easing function (ease-in-out)
                const easeProgress = progress < 0.5 ? 2 * progress * progress : -1 + 4 * progress - 2 * progress * progress;

                // Interpolate spherical coordinates
                this.sphericalCoordinates.radius =
                    startSpherical.radius + (targetSpherical.radius - startSpherical.radius) * easeProgress;
                this.sphericalCoordinates.theta =
                    startSpherical.theta + (targetSpherical.theta - startSpherical.theta) * easeProgress;
                this.sphericalCoordinates.phi =
                    startSpherical.phi + (targetSpherical.phi - startSpherical.phi) * easeProgress;

                // Interpolate target point
                if (targetPointOffset) {
                    this.targetPoint.x = startPoint.x + (targetPointOffset.x - startPoint.x) * easeProgress;
                    this.targetPoint.y = startPoint.y + (targetPointOffset.y - startPoint.y) * easeProgress;
                    this.targetPoint.z = startPoint.z + (targetPointOffset.z - startPoint.z) * easeProgress;
                }

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
    resetCamera() {
        this.sphericalCoordinates = {
            radius: 5000,
            theta: 0,
            phi: Math.PI / 4,
        };
        this.targetPoint = { x: 0, y: 0, z: 0 };
        this.updateCameraPosition();
    }

    /**
     * Get camera state (for saving/loading)
     */
    getState() {
        return {
            spherical: { ...this.sphericalCoordinates },
            target: { ...this.targetPoint },
        };
    }

    /**
     * Set camera state (for saving/loading)
     */
    setState(state) {
        if (state.spherical) {
            this.sphericalCoordinates = { ...state.spherical };
        }
        if (state.target) {
            this.targetPoint = { ...state.target };
        }
        this.updateCameraPosition();
    }
}
