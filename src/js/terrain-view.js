/**
 * Terrain View Manager
 * Handles viewport calculation and tile selection
 */

export class TerrainViewManager {
    constructor(coordinateTransform) {
        this.coordinateTransform = coordinateTransform;
        this.currentViewpoint = null;
        this.viewDistance = 10; // km
        this.viewAngle = 0; // degrees (0 = north)
        this.tileSize = 1000; // meters per tile at zoom 14
        this.earthRadius = 6371000; // meters
    }

    /**
     * Set viewpoint
     */
    setViewpoint(lat, lon, viewAngle = 0, viewDistance = 10, elevation = 0) {
        this.currentViewpoint = { lat, lon };
        this.viewAngle = viewAngle;
        this.viewDistance = viewDistance; // in km
        this.elevation = elevation; // in meters
    }

    /**
     * Calculate required tiles for current viewpoint
     * Returns array of { z, x, y, lod } objects
     */
    calculateRequiredTiles(zoomLevel = 14) {
        if (!this.currentViewpoint) {
            return [];
        }

        const { lat, lon } = this.currentViewpoint;
        const distanceMeters = this.viewDistance * 1000;

        // Convert center point to tile coordinates
        const centerTileX = this.coordinateTransform.latlon_to_tile_x(lon, zoomLevel);
        const centerTileY = this.coordinateTransform.latlon_to_tile_y(lat, zoomLevel);

        // Calculate how many tiles are needed based on view distance
        // Greatly increased range for full 360-degree view of surrounding terrain
        const tilesAcross = Math.ceil((distanceMeters / 2) / this.tileSize) + 8;

        const tiles = [];
        const visited = new Set();

        // Generate tiles in a circular pattern around center
        for (let dx = -tilesAcross; dx <= tilesAcross; dx++) {
            for (let dy = -tilesAcross; dy <= tilesAcross; dy++) {
                const tileX = Math.floor(centerTileX + dx);
                const tileY = Math.floor(centerTileY + dy);

                const distance = Math.sqrt(dx * dx + dy * dy);
                const key = `${tileX}/${tileY}`;

                if (visited.has(key)) continue;
                visited.add(key);

                // Skip if outside reasonable bounds (wrap-around at date line)
                const maxTile = Math.pow(2, zoomLevel);
                if (tileX < 0 || tileX >= maxTile || tileY < 0 || tileY >= maxTile) {
                    continue;
                }

                // Assign LOD based on distance from center
                let lod = 0; // Far
                if (distance <= 1) {
                    lod = 2; // Near
                } else if (distance <= 2) {
                    lod = 1; // Mid
                }

                // Check if within view cone (optional - simplified to circle for now)
                if (distance <= tilesAcross) {
                    tiles.push({
                        z: zoomLevel,
                        x: tileX,
                        y: tileY,
                        lod: lod,
                        distance: distance,
                    });
                }
            }
        }

        // Sort by distance for optimal loading order
        tiles.sort((a, b) => a.distance - b.distance);

        return tiles;
    }

    /**
     * Filter and prioritize tiles based on view direction
     * Useful for loading tiles in order of importance when viewing in a specific direction
     */
    prioritizeTilesByViewDirection(tiles, viewYaw, viewPitch) {
        if (!tiles || tiles.length === 0) {
            return tiles;
        }

        const { lat, lon } = this.currentViewpoint;
        const centerTileX = this.coordinateTransform.latlon_to_tile_x(lon, 14);
        const centerTileY = this.coordinateTransform.latlon_to_tile_y(lat, 14);

        // Convert yaw to world direction (-PI to PI)
        // yaw: 0 = +z, PI/2 = +x, -PI/2 = -x, PI = -z
        const viewDirection = {
            x: Math.sin(viewYaw),
            z: Math.cos(viewYaw)
        };

        // Calculate priority for each tile based on alignment with view direction
        return tiles.map(tile => {
            // Tile center relative to camera
            const relTileX = tile.x - centerTileX;
            const relTileZ = tile.y - centerTileY;
            
            // Normalize tile direction
            const dist = Math.sqrt(relTileX * relTileX + relTileZ * relTileZ);
            if (dist < 0.1) {
                // Center tile has highest priority
                return { ...tile, priority: 1000 };
            }
            
            const tileDir = {
                x: relTileX / dist,
                z: relTileZ / dist
            };
            
            // Calculate dot product (alignment with view direction)
            const alignment = viewDirection.x * tileDir.x + viewDirection.z * tileDir.z;
            
            // Priority: alignment + distance factor
            // Tiles in front of view direction get higher priority
            const priority = (alignment + 1) * 50 - dist;
            
            return { ...tile, priority };
        }).sort((a, b) => b.priority - a.priority);
    }

    /**
     * Calculate view frustum (simplified as cone)
     * Used for visibility testing
     */
    getViewFrustum() {
        if (!this.currentViewpoint) {
            return null;
        }

        return {
            lat: this.currentViewpoint.lat,
            lon: this.currentViewpoint.lon,
            angle: this.viewAngle,
            distance: this.viewDistance * 1000, // in meters
        };
    }

    /**
     * Test if tile is visible in current view
     */
    isTileVisible(tileZ, tileX, tileY, zoomLevel = 14) {
        if (!this.currentViewpoint) {
            return false;
        }

        // Get tile center coordinates
        const tileCenter = this.getTileCenterCoordinates(tileZ, tileX, tileY);
        if (!tileCenter) {
            return false;
        }

        // Calculate distance to tile center
        const distanceMeters = this.calculateDistance(
            this.currentViewpoint.lat,
            this.currentViewpoint.lon,
            tileCenter.lat,
            tileCenter.lon
        );

        // Simple visibility: within view distance
        return distanceMeters <= this.viewDistance * 1000 * 1.5; // 1.5x safety margin
    }

    /**
     * Get tile center coordinates (lat/lon)
     */
    getTileCenterCoordinates(z, x, y) {
        try {
            // Get tile bounds
            const n = Math.pow(2.0, z);
            const lon = ((x + 0.5) / n) * 360.0 - 180.0;

            const lat = Math.atan(Math.sinh(Math.PI * (1.0 - (2.0 * (y + 0.5)) / n)));
            const latDeg = (lat * 180.0) / Math.PI;

            return {
                lat: latDeg,
                lon: lon,
            };
        } catch (error) {
            console.error('Failed to calculate tile center:', error);
            return null;
        }
    }

    /**
     * Calculate great-circle distance between two points (Haversine formula)
     */
    calculateDistance(lat1, lon1, lat2, lon2) {
        const dLat = ((lat2 - lat1) * Math.PI) / 180;
        const dLon = ((lon2 - lon1) * Math.PI) / 180;

        const sinLat = Math.sin(dLat / 2);
        const sinLon = Math.sin(dLon / 2);

        const a = sinLat * sinLat + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * sinLon * sinLon;

        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return this.earthRadius * c;
    }

    /**
     * Get camera target position (center of view)
     * Returns world coordinates
     */
    /**
     * Get camera target position (what the camera should look at)
     * Returns world coordinates
     */
    /**
     * Get camera target position (what the camera should look at)
     * Calculated from initial view direction (yaw=0, pitch=-0.2) to show surrounding terrain
     * Returns world coordinates
     */
    getCameraTarget() {
        if (!this.currentViewpoint) {
            return { x: 0, y: 0, z: 0 };
        }

        const EYE_HEIGHT = 1.7; // Human eye height in meters
        const distance = 50; // Distance to look-at point (meters)
        
        // Initial view direction (yaw=0 = north, pitch=-0.2 = slightly downward)
        const initialYaw = 0;
        const initialPitch = -0.2;
        
        // Calculate target from initial view direction
        const targetX = 0 + distance * Math.sin(initialYaw) * Math.cos(initialPitch);
        const targetY = (this.elevation || 0) + EYE_HEIGHT + distance * Math.sin(initialPitch);
        const targetZ = 0 + distance * Math.cos(initialYaw) * Math.cos(initialPitch);
        
        return {
            x: targetX,
            y: targetY,
            z: targetZ,
        };
    }

    /**
     * Get camera position based on viewpoint, angle, and distance
     * Returns world coordinates
     */
    /**
     * Get camera position based on viewpoint, angle, and distance
     * Returns world coordinates from the clicked point
     */
    getCameraPosition() {
        if (!this.currentViewpoint) {
            return { x: 0, y: 1000, z: 2000 };
        }

        const distanceMeters = this.viewDistance * 1000;
        const EYE_HEIGHT = 1.7; // Human eye height in meters

        // Convert angle to radians (0 = north = +z, 90 = east = +x, etc)
        const angleRad = ((this.viewAngle + 90) * Math.PI) / 180;

        // Calculate horizontal distance from center based on view distance
        const horizontalDistance = distanceMeters / 2;

        // Camera is positioned at ground level + eye height looking into the distance
        // The y-coordinate is the elevation + eye height
        const cameraHeight = (this.elevation || 0) + EYE_HEIGHT;

        return {
            x: horizontalDistance * Math.cos(angleRad),
            y: cameraHeight,
            z: horizontalDistance * Math.sin(angleRad),
        };
    }

    /**
     * Get current statistics
     */
    getStats() {
        return {
            viewpoint: this.currentViewpoint,
            viewDistance: this.viewDistance,
            viewAngle: this.viewAngle,
        };
    }
}
