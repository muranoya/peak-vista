/**
 * Performance Monitor
 * Tracks FPS, memory usage, tile loading time, and other metrics
 */

export class PerformanceMonitor {
    constructor() {
        this.metrics = {
            fps: 0,
            frameTime: 0,
            memoryUsage: 0,
            memoryLimit: 0,
            tileLoadTime: 0,
            meshGenerationTime: 0,
            renderTime: 0,
        };

        this.frameCount = 0;
        this.lastFrameTime = performance.now();
        this.fpsHistory = [];
        this.fpsHistorySize = 60; // 1 second at 60 FPS

        this.timings = {}; // For tracking specific operations
        this.measurements = {};

        this.enabled = true;
    }

    /**
     * Start timing a named operation
     */
    startTiming(name) {
        if (!this.enabled) return;
        this.timings[name] = performance.now();
    }

    /**
     * End timing a named operation
     */
    endTiming(name) {
        if (!this.enabled || !this.timings[name]) return;

        const duration = performance.now() - this.timings[name];
        delete this.timings[name];

        if (!this.measurements[name]) {
            this.measurements[name] = [];
        }

        this.measurements[name].push(duration);

        // Keep only last 100 measurements
        if (this.measurements[name].length > 100) {
            this.measurements[name].shift();
        }

        return duration;
    }

    /**
     * Record frame time and update FPS
     */
    recordFrame() {
        if (!this.enabled) return;

        const now = performance.now();
        const deltaTime = now - this.lastFrameTime;
        this.lastFrameTime = now;

        this.frameCount++;
        this.metrics.frameTime = deltaTime;

        // Calculate FPS
        const fps = 1000 / deltaTime;
        this.fpsHistory.push(fps);
        if (this.fpsHistory.length > this.fpsHistorySize) {
            this.fpsHistory.shift();
        }

        this.metrics.fps = Math.round(this.getAverageFPS());

        // Update memory usage if available
        if (performance.memory) {
            this.metrics.memoryUsage = Math.round(performance.memory.usedJSHeapSize / 1024 / 1024);
            this.metrics.memoryLimit = Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024);
        }
    }

    /**
     * Get average FPS from history
     */
    getAverageFPS() {
        if (this.fpsHistory.length === 0) return 0;
        const sum = this.fpsHistory.reduce((a, b) => a + b, 0);
        return sum / this.fpsHistory.length;
    }

    /**
     * Get average timing for a named operation
     */
    getAverageTiming(name) {
        if (!this.measurements[name] || this.measurements[name].length === 0) {
            return 0;
        }
        const sum = this.measurements[name].reduce((a, b) => a + b, 0);
        return sum / this.measurements[name].length;
    }

    /**
     * Get timing statistics for all recorded operations
     */
    getTimingStats() {
        const stats = {};

        for (const [name, measurements] of Object.entries(this.measurements)) {
            if (measurements.length === 0) continue;

            const sorted = [...measurements].sort((a, b) => a - b);
            const sum = sorted.reduce((a, b) => a + b, 0);
            const avg = sum / sorted.length;
            const min = sorted[0];
            const max = sorted[sorted.length - 1];
            const median = sorted[Math.floor(sorted.length / 2)];
            const p95 = sorted[Math.floor(sorted.length * 0.95)];

            stats[name] = {
                avg: Math.round(avg * 100) / 100,
                min: Math.round(min * 100) / 100,
                max: Math.round(max * 100) / 100,
                median: Math.round(median * 100) / 100,
                p95: Math.round(p95 * 100) / 100,
                samples: measurements.length,
            };
        }

        return stats;
    }

    /**
     * Get current metrics
     */
    getMetrics() {
        return { ...this.metrics };
    }

    /**
     * Get performance report
     */
    getReport() {
        const timingStats = this.getTimingStats();

        return {
            timestamp: new Date().toISOString(),
            metrics: this.getMetrics(),
            timings: timingStats,
            uptime: Math.round(performance.now() / 1000),
        };
    }

    /**
     * Reset all measurements
     */
    reset() {
        this.measurements = {};
        this.timings = {};
        this.fpsHistory = [];
        this.frameCount = 0;
    }

    /**
     * Enable/disable monitoring
     */
    setEnabled(enabled) {
        this.enabled = enabled;
    }

    /**
     * Log performance report to console
     */
    logReport() {
        const report = this.getReport();
        console.group('Peak Vista Performance Report');
        console.log('Timestamp:', report.timestamp);
        console.table(report.metrics);
        console.log('Timing Statistics:', report.timings);
        console.log('Uptime (s):', report.uptime);
        console.groupEnd();
    }

    /**
     * Export report as JSON
     */
    exportReport() {
        const report = this.getReport();
        const dataStr = JSON.stringify(report, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);

        const link = document.createElement('a');
        link.href = url;
        link.download = `peak-vista-performance-${Date.now()}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
}
