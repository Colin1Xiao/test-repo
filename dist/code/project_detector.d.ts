/**
 * Project Detector - 项目类型检测器
 *
 * 职责：
 * 1. 识别编程语言
 * 2. 识别框架
 * 3. 识别包管理器
 * 4. 识别构建系统
 * 5. 识别测试框架
 *
 * @version v0.1.0
 * @date 2026-04-03
 */
import type { RepoProfile, DetectionEvidence } from './types';
/**
 * 检测配置
 */
export interface DetectorConfig {
    /** 最小置信度阈值 */
    minConfidence?: number;
    /** 是否包含证据 */
    includeEvidence?: boolean;
}
/**
 * 检测结果
 */
export interface DetectionResult {
    /** 语言 */
    languages: Set<string>;
    /** 框架 */
    frameworks: Set<string>;
    /** 包管理器 */
    packageManagers: Set<string>;
    /** 构建系统 */
    buildSystems: Set<string>;
    /** 测试框架 */
    testFrameworks: Set<string>;
    /** 证据 */
    evidence: DetectionEvidence[];
}
export declare class ProjectDetector {
    private config;
    constructor(config?: DetectorConfig);
    /**
     * 检测项目
     */
    detect(repoRoot: string): Promise<RepoProfile>;
    /**
     * 检测 Node.js 项目
     */
    private detectNodeProject;
    /**
     * 检测 Node 框架
     */
    private detectNodeFrameworks;
    /**
     * 检测 Node 配置文件
     */
    private detectNodeConfigFiles;
    /**
     * 检测 Node 测试框架
     */
    private detectNodeTestFrameworks;
    /**
     * 检测 Node 测试配置文件
     */
    private detectNodeTestConfigFiles;
    /**
     * 检测 tsconfig.json
     */
    private detectTsConfig;
    /**
     * 检测 Python 项目
     */
    private detectPythonProject;
    /**
     * 检测 pyproject.toml
     */
    private detectPyproject;
    /**
     * 检测 requirements.txt
     */
    private detectRequirements;
    /**
     * 检测 setup.py
     */
    private detectSetupPy;
    /**
     * 检测 Django
     */
    private detectDjango;
    /**
     * 检测 pytest
     */
    private detectPytest;
    /**
     * 检测其他语言项目
     */
    private detectOtherProjects;
    /**
     * 检测 Go 项目
     */
    private detectGoProject;
    /**
     * 检测 Rust 项目
     */
    private detectRustProject;
    /**
     * 检测 Java 项目
     */
    private detectJavaProject;
    /**
     * 检测 Ruby 项目
     */
    private detectRubyProject;
    /**
     * 检测 PHP 项目
     */
    private detectPhpProject;
    /**
     * 添加证据
     */
    private addEvidence;
    /**
     * 构建 RepoProfile
     */
    private buildProfile;
}
/**
 * 创建项目检测器
 */
export declare function createProjectDetector(config?: DetectorConfig): ProjectDetector;
/**
 * 快速检测项目
 */
export declare function detectProject(repoRoot: string, config?: DetectorConfig): Promise<RepoProfile>;
