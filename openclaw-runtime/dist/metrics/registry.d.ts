/**
 * Phase 3A-2: Metrics Registry
 *
 * Prometheus 风格指标注册与暴露。
 */
export type MetricType = 'counter' | 'gauge' | 'histogram';
export interface MetricLabels {
    [key: string]: string;
}
export interface MetricDefinition {
    name: string;
    type: MetricType;
    help: string;
    labelNames?: string[];
}
export declare class Counter {
    readonly name: string;
    readonly help: string;
    readonly labelNames: string[];
    private values;
    constructor(name: string, help: string, labelNames?: string[]);
    private key;
    inc(labels?: MetricLabels, value?: number): void;
    get(labels?: MetricLabels): number;
    all(): Map<string, number>;
}
export declare class Gauge {
    readonly name: string;
    readonly help: string;
    readonly labelNames: string[];
    private values;
    constructor(name: string, help: string, labelNames?: string[]);
    private key;
    set(value: number, labels?: MetricLabels): void;
    inc(labels?: MetricLabels): void;
    dec(labels?: MetricLabels): void;
    get(labels?: MetricLabels): number;
    all(): Map<string, number>;
}
export declare class Histogram {
    readonly name: string;
    readonly help: string;
    readonly labelNames: string[];
    private buckets;
    private bucketData;
    private sums;
    constructor(name: string, help: string, labelNames?: string[], buckets?: number[]);
    private key;
    observe(value: number, labels?: MetricLabels): void;
    getBucketData(): Map<string, Map<number, number>>;
    getBucketValues(): number[];
}
export declare class MetricsRegistry {
    private counters;
    private gauges;
    private histograms;
    counter(name: string, help: string, labelNames?: string[]): Counter;
    gauge(name: string, help: string, labelNames?: string[]): Gauge;
    histogram(name: string, help: string, labelNames?: string[], buckets?: number[]): Histogram;
    getAll(): {
        counters: Counter[];
        gauges: Gauge[];
        histograms: Histogram[];
    };
    clear(): void;
}
export declare function toPrometheusFormat(registry: MetricsRegistry): string;
export declare function getMetricsRegistry(): MetricsRegistry;
export declare function resetMetricsRegistry(): void;
//# sourceMappingURL=registry.d.ts.map