/**
 * View Mode Manager
 * Manages switching between map view and 3D terrain view
 */

export const VIEW_MODE = {
    MAP: 'map',
    TERRAIN: '3d',
};

export class ViewModeManager {
    constructor(app) {
        this.app = app;
        this.currentMode = VIEW_MODE.MAP;
        this.callbacks = {
            modeChanged: [],
        };
    }

    /**
     * Switch to a different view mode
     */
    async switchMode(newMode) {
        if (newMode === this.currentMode) {
            return;
        }

        console.log(`Switching from ${this.currentMode} to ${newMode}`);

        switch (newMode) {
            case VIEW_MODE.MAP:
                await this.switchToMapMode();
                break;
            case VIEW_MODE.TERRAIN:
                await this.switchToTerrainMode();
                break;
        }

        this.currentMode = newMode;
        this.notifyModeChanged(newMode);
    }

    /**
     * Switch to map mode
     */
    async switchToMapMode() {
        this.app.updateStatus('Switching to map view...', 'loading');

        // Show map renderer
        if (this.app.mapRenderer) {
            // Start rendering
            // Already running in animate loop
        }

        // Hide terrain controls
        this.hideTerrainControls();

        this.app.updateStatus('Map view ready. Click on a location to view terrain.', 'success');
    }

    /**
     * Switch to terrain mode
     */
    async switchToTerrainMode() {
        this.app.updateStatus('Switching to 3D terrain view...', 'loading');

        // Show terrain renderer
        if (this.app.renderer) {
            // Terrain renderer is in use
        }

        // Show terrain controls
        this.showTerrainControls();

        this.app.updateStatus('3D terrain view ready. Click and drag to rotate. Scroll to zoom.', 'success');
    }

    /**
     * Show terrain control elements
     */
    showTerrainControls() {
        const controlsDiv = document.getElementById('controls');
        if (controlsDiv) {
            controlsDiv.style.display = 'block';
        }
    }

    /**
     * Hide terrain control elements
     */
    hideTerrainControls() {
        const controlsDiv = document.getElementById('controls');
        if (controlsDiv) {
            controlsDiv.style.display = 'none';
        }
    }

    /**
     * Get current mode
     */
    getMode() {
        return this.currentMode;
    }

    /**
     * Check if in map mode
     */
    isMapMode() {
        return this.currentMode === VIEW_MODE.MAP;
    }

    /**
     * Check if in terrain mode
     */
    isTerrainMode() {
        return this.currentMode === VIEW_MODE.TERRAIN;
    }

    /**
     * Register mode change callback
     */
    onModeChanged(callback) {
        this.callbacks.modeChanged.push(callback);
    }

    /**
     * Notify listeners of mode change
     */
    notifyModeChanged(newMode) {
        this.callbacks.modeChanged.forEach((callback) => callback(newMode));
    }
}
