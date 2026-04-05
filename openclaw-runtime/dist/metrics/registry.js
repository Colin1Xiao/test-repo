/**
 * Phase 3A-2: Metrics Registry
 *
 * Prometheus 风格指标注册与暴露。
 */
// ==================== Counter ====================
export class Counter {
    name;
    help;
    labelNames;
    values = new Map();
    constructor(name, help, labelNames = []) {
        this.name = name;
        this.help = help;
        this.labelNames = labelNames;
    }
    key(labels) {
        if (this.labelNames.length === 0)
            return this.name;
        return `${this.name}:${this.labelNames.map(l => labels[l] || '').join(':')}`;
    }
    inc(labels = {}, value = 1) {
        const key = this.key(labels);
        const current = this.values.get(key) || 0;
        this.values.set(key, current + value);
    }
    get(labels = {}) {
        return this.values.get(this.key(labels)) || 0;
    }
    all() {
        return new Map(this.values);
    }
}
// ==================== Gauge ====================
export class Gauge {
    name;
    help;
    labelNames;
    values = new Map();
    constructor(name, help, labelNames = []) {
        this.name = name;
        this.help = help;
        this.labelNames = labelNames;
    }
    key(labels) {
        if (this.labelNames.length === 0)
            return this.name;
        return `${this.name}:${this.labelNames.map(l => labels[l] || '').join(':')}`;
    }
    set(value, labels = {}) {
        this.values.set(this.key(labels), value);
    }
    inc(labels = {}) {
        const key = this.key(labels);
        const current = this.values.get(key) || 0;
        this.values.set(key, current + 1);
    }
    dec(labels = {}) {
        const key = this.key(labels);
        const current = this.values.get(key) || 0;
        this.values.set(key, current - 1);
    }
    get(labels = {}) {
        return this.values.get(this.key(labels)) || 0;
    }
    all() {
        return new Map(this.values);
    }
}
// ==================== Histogram ====================
export class Histogram {
    name;
    help;
    labelNames;
    buckets;
    bucketData = new Map();
    sums = new Map();
    constructor(name, help, labelNames = [], buckets = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]) {
        this.name = name;
        this.help = help;
        this.labelNames = labelNames;
        this.buckets = buckets;
    }
    key(labels) {
        if (this.labelNames.length === 0)
            return this.name;
        return `${this.name}:${this.labelNames.map(l => labels[l] || '').join(':')}`;
    }
    observe(value, labels = {}) {
        const key = this.key(labels);
        if (!this.bucketData.has(key)) {
            const bucketCounts = new Map();
            this.buckets.forEach(b => bucketCounts.set(b, 0));
            this.bucketData.set(key, bucketCounts);
            this.sums.set(key, 0);
        }
        const counts = this.bucketData.get(key);
        this.buckets.forEach(b => {
            if (value <= b) {
                counts.set(b, (counts.get(b) || 0) + 1);
            }
        });
        this.sums.set(key, (this.sums.get(key) || 0) + value);
    }
    getBucketData() {
        return this.bucketData;
    }
    getBucketValues() {
        return this.buckets;
    }
}
// ==================== Metrics Registry ====================
export class MetricsRegistry {
    counters = new Map();
    gauges = new Map();
    histograms = new Map();
    // Counter
    counter(name, help, labelNames) {
        if (!this.counters.has(name)) {
            this.counters.set(name, new Counter(name, help, labelNames));
        }
        return this.counters.get(name);
    }
    // Gauge
    gauge(name, help, labelNames) {
        if (!this.gauges.has(name)) {
            this.gauges.set(name, new Gauge(name, help, labelNames));
        }
        return this.gauges.get(name);
    }
    // Histogram
    histogram(name, help, labelNames, buckets) {
        if (!this.histograms.has(name)) {
            this.histograms.set(name, new Histogram(name, help, labelNames, buckets));
        }
        return this.histograms.get(name);
    }
    // Get all metrics
    getAll() {
        return {
            counters: Array.from(this.counters.values()),
            gauges: Array.from(this.gauges.values()),
            histograms: Array.from(this.histograms.values()),
        };
    }
    // Clear all metrics (for testing)
    clear() {
        this.counters.clear();
        this.gauges.clear();
        this.histograms.clear();
    }
}
// ==================== Prometheus Format Export ====================
export function toPrometheusFormat(registry) {
    const lines = [];
    const { counters, gauges, histograms } = registry.getAll();
    // Counters
    for (const counter of counters) {
        lines.push(`# HELP ${counter.name} ${counter.help}`);
        lines.push(`# TYPE ${counter.name} counter`);
        counter.all().forEach((value, key) => {
            lines.push(formatMetric(counter.name, value, {}));
        });
    }
    // Gauges
    for (const gauge of gauges) {
        lines.push(`# HELP ${gauge.name} ${gauge.help}`);
        lines.push(`# TYPE ${gauge.name} gauge`);
        gauge.all().forEach((value, key) => {
            lines.push(formatMetric(gauge.name, value, {}));
        });
    }
    // Histograms
    for (const histogram of histograms) {
        lines.push(`# HELP ${histogram.name} ${histogram.help}`);
        lines.push(`# TYPE ${histogram.name} histogram`);
        // Simplified - just output sum for now
        lines.push(`# Note: Full histogram output requires implementation`);
    }
    return lines.join('\n') + '\n';
}
function parseLabels(key) {
    const parts = key.split(':');
    const name = parts[0];
    const values = parts.slice(1);
    // This is simplified - in real implementation, label names would be tracked
    return {};
}
function formatMetric(name, value, labels = {}) {
    const labelParts = Object.entries(labels)
        .filter(([_, v]) => v !== '')
        .map(([k, v]) => `${k}="${v}"`)
        .join(',');
    if (labelParts) {
        return `${name}{${labelParts}} ${value}`;
    }
    return `${name} ${value}`;
}
// ==================== Singleton ====================
let _registry = null;
export function getMetricsRegistry() {
    if (!_registry) {
        _registry = new MetricsRegistry();
    }
    return _registry;
}
export function resetMetricsRegistry() {
    _registry = null;
}
//# sourceMappingURL=registry.js.map