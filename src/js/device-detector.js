/**
 * Device Detector
 * Detects device capabilities and provides optimization recommendations
 */

export class DeviceDetector {
    constructor() {
        this.isMobile = this.detectMobile();
        this.isTablet = this.detectTablet();
        this.pixelRatio = window.devicePixelRatio || 1;
        this.memory = this.detectMemory();
        this.gpuInfo = this.detectGPU();
    }

    /**
     * Detect if device is mobile
     */
    detectMobile() {
        const userAgent = navigator.userAgent || navigator.vendor || window.opera;
        const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i;
        return mobileRegex.test(userAgent.toLowerCase());
    }

    /**
     * Detect if device is tablet
     */
    detectTablet() {
        const userAgent = navigator.userAgent;
        const tabletRegex = /ipad|android(?!.*mobile)/i;
        return tabletRegex.test(userAgent.toLowerCase());
    }

    /**
     * Detect available memory (rough estimate)
     */
    detectMemory() {
        // Try to get from DeviceMemory API (available on some browsers)
        if (navigator.deviceMemory) {
            return navigator.deviceMemory;
        }

        // Fallback: estimate based on device type
        if (this.isMobile && !this.isTablet) {
            return 2; // Typical mobile: 2GB
        } else if (this.isTablet) {
            return 4; // Typical tablet: 4GB
        } else {
            return 8; // Typical desktop: 8GB
        }
    }

    /**
     * Detect GPU info
     */
    detectGPU() {
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

            if (!gl) {
                return { vendor: 'Unknown', renderer: 'Unknown', webglVersion: 'Not available' };
            }

            const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
            const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
            const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);

            return {
                vendor,
                renderer,
                webglVersion: 'WebGL 1.0',
            };
        } catch (error) {
            console.warn('Failed to detect GPU info:', error);
            return { vendor: 'Unknown', renderer: 'Unknown', webglVersion: 'Unknown' };
        }
    }

    /**
     * Get optimization profile based on device
     */
    getOptimizationProfile() {
        // Determine profile based on device capabilities
        // OPTIMIZATION: useBalancedLighting = false (default) for maximum performance
        // Set to true for balanced mode with moderate shadow quality
        const profile = {
            maxTiles: 150,  // Large number for 360-degree terrain coverage
            maxLodLevel: 2,
            renderDistance: 10, // km
            targetFPS: 60,
            pixelRatio: Math.min(this.pixelRatio, 2), // Cap at 2x
            useBalancedLighting: false,  // OPTIMIZATION: Default to maximum performance
        };

        // Mobile optimization
        if (this.isMobile && !this.isTablet) {
            profile.maxTiles = 36;  // Moderate number for mobile
            profile.maxLodLevel = 1;
            profile.renderDistance = 5;
            profile.targetFPS = 30;
            profile.pixelRatio = Math.min(this.pixelRatio, 1);
            profile.enableShadows = false;
            profile.enableAmbientOcclusion = false;
        }
        // Tablet optimization
        else if (this.isTablet) {
            profile.maxTiles = 80;  // Good coverage for tablets
            profile.maxLodLevel = 1;
            profile.renderDistance = 7;
            profile.targetFPS = 30;
            profile.pixelRatio = Math.min(this.pixelRatio, 1.5);
            profile.enableShadows = true;
            profile.enableAmbientOcclusion = false;
        }

        // Adjust based on memory
        if (this.memory <= 2) {
            profile.maxTiles = Math.max(4, Math.floor(profile.maxTiles / 2));
            profile.maxLodLevel = Math.max(0, profile.maxLodLevel - 1);
        }

        return profile;
    }

    /**
     * Get connection speed estimate
     */
    async getConnectionSpeed() {
        try {
            if ('connection' in navigator) {
                const conn = navigator.connection;
                return {
                    effectiveType: conn.effectiveType, // '4g', '3g', '2g', 'slow-2g'
                    downlink: conn.downlink, // Mbps
                    rtt: conn.rtt, // ms
                    saveData: conn.saveData,
                };
            }
        } catch (error) {
            console.warn('Failed to detect connection speed:', error);
        }

        return null;
    }

    /**
     * Check if device supports WebGL 2.0
     */
    supportsWebGL2() {
        try {
            const canvas = document.createElement('canvas');
            return !!canvas.getContext('webgl2');
        } catch {
            return false;
        }
    }

    /**
     * Check if device supports ES modules (modern browsers)
     */
    supportsES6() {
        try {
            new Function('(async () => {})');
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Get device fingerprint for analytics
     */
    getDeviceInfo() {
        return {
            userAgent: navigator.userAgent,
            isMobile: this.isMobile,
            isTablet: this.isTablet,
            pixelRatio: this.pixelRatio,
            memory: this.memory,
            gpu: this.gpuInfo,
            platform: navigator.platform,
            language: navigator.language,
            hardwareConcurrency: navigator.hardwareConcurrency,
            maxTouchPoints: navigator.maxTouchPoints,
        };
    }

    /**
     * Log device info to console
     */
    logDeviceInfo() {
        console.group('Device Information');
        console.log('Device Info:', this.getDeviceInfo());
        console.log('Optimization Profile:', this.getOptimizationProfile());
        console.log('WebGL 2.0 Support:', this.supportsWebGL2());
        console.log('ES6 Support:', this.supportsES6());
        console.groupEnd();
    }
}
