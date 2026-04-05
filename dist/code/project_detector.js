"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectDetector = void 0;
exports.createProjectDetector = createProjectDetector;
exports.detectProject = detectProject;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
// ============================================================================
// 检测器
// ============================================================================
class ProjectDetector {
    constructor(config = {}) {
        this.config = {
            minConfidence: config.minConfidence ?? 0.5,
            includeEvidence: config.includeEvidence ?? true,
        };
    }
    /**
     * 检测项目
     */
    async detect(repoRoot) {
        const result = {
            languages: new Set(),
            frameworks: new Set(),
            packageManagers: new Set(),
            buildSystems: new Set(),
            testFrameworks: new Set(),
            evidence: [],
        };
        // 1. 检测 package.json (Node.js/TS/JS)
        await this.detectNodeProject(repoRoot, result);
        // 2. 检测 Python 项目
        await this.detectPythonProject(repoRoot, result);
        // 3. 检测其他语言项目
        await this.detectOtherProjects(repoRoot, result);
        // 4. 构建 RepoProfile
        return this.buildProfile(repoRoot, result);
    }
    /**
     * 检测 Node.js 项目
     */
    async detectNodeProject(repoRoot, result) {
        const packageJsonPath = path.join(repoRoot, 'package.json');
        try {
            const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
            const packageJson = JSON.parse(packageJsonContent);
            // 添加语言
            if (packageJson.devDependencies?.typescript || packageJson.dependencies?.typescript) {
                result.languages.add('TypeScript');
                this.addEvidence(result, 'tsconfig', 'package.json', 'TypeScript dependency found', 0.9);
            }
            result.languages.add('JavaScript');
            // 添加包管理器
            if (await fs.access(path.join(repoRoot, 'pnpm-lock.yaml')).then(() => true).catch(() => false)) {
                result.packageManagers.add('pnpm');
                this.addEvidence(result, 'package_json', 'pnpm-lock.yaml', 'pnpm lock file found', 1.0);
            }
            else if (await fs.access(path.join(repoRoot, 'yarn.lock')).then(() => true).catch(() => false)) {
                result.packageManagers.add('yarn');
                this.addEvidence(result, 'package_json', 'yarn.lock', 'yarn lock file found', 1.0);
            }
            else {
                result.packageManagers.add('npm');
            }
            // 检测框架
            this.detectNodeFrameworks(packageJson, repoRoot, result);
            // 检测测试框架
            this.detectNodeTestFrameworks(packageJson, repoRoot, result);
        }
        catch (error) {
            // package.json 不存在或解析失败
        }
        // 检测 tsconfig.json
        await this.detectTsConfig(repoRoot, result);
    }
    /**
     * 检测 Node 框架
     */
    detectNodeFrameworks(packageJson, repoRoot, result) {
        const deps = {
            ...packageJson.dependencies,
            ...packageJson.devDependencies,
        };
        // React
        if (deps.react) {
            result.frameworks.add('React');
            this.addEvidence(result, 'package_json', 'package.json', 'React dependency found', 0.9);
            // Next.js
            if (deps.next) {
                result.frameworks.add('Next.js');
                this.addEvidence(result, 'package_json', 'package.json', 'Next.js dependency found', 1.0);
            }
            // Vite
            if (deps.vite || devHasVite(packageJson)) {
                result.frameworks.add('Vite');
                this.addEvidence(result, 'package_json', 'package.json', 'Vite dependency found', 0.9);
            }
        }
        // Vue
        if (deps.vue || deps['vue-router']) {
            result.frameworks.add('Vue');
            this.addEvidence(result, 'package_json', 'package.json', 'Vue dependency found', 0.9);
        }
        // Express
        if (deps.express) {
            result.frameworks.add('Express');
            this.addEvidence(result, 'package_json', 'package.json', 'Express dependency found', 0.9);
        }
        // NestJS
        if (deps['@nestjs/core']) {
            result.frameworks.add('NestJS');
            this.addEvidence(result, 'package_json', 'package.json', 'NestJS dependency found', 1.0);
        }
        // 检测配置文件
        this.detectNodeConfigFiles(repoRoot, result);
    }
    /**
     * 检测 Node 配置文件
     */
    async detectNodeConfigFiles(repoRoot, result) {
        const configFiles = [
            { file: 'vite.config.ts', framework: 'Vite', evidence: 'vite_config' },
            { file: 'vite.config.js', framework: 'Vite', evidence: 'vite_config' },
            { file: 'next.config.js', framework: 'Next.js', evidence: 'next_config' },
            { file: 'next.config.ts', framework: 'Next.js', evidence: 'next_config' },
            { file: 'nuxt.config.js', framework: 'Nuxt', evidence: 'file_pattern' },
            { file: 'svelte.config.js', framework: 'Svelte', evidence: 'file_pattern' },
            { file: 'astro.config.mjs', framework: 'Astro', evidence: 'file_pattern' },
            { file: 'remix.config.js', framework: 'Remix', evidence: 'file_pattern' },
        ];
        for (const { file, framework, evidence } of configFiles) {
            const configPath = path.join(repoRoot, file);
            try {
                await fs.access(configPath);
                result.frameworks.add(framework);
                this.addEvidence(result, evidence, file, `${file} found`, 0.95);
            }
            catch {
                // 文件不存在
            }
        }
    }
    /**
     * 检测 Node 测试框架
     */
    detectNodeTestFrameworks(packageJson, repoRoot, result) {
        const deps = {
            ...packageJson.dependencies,
            ...packageJson.devDependencies,
        };
        // Jest
        if (deps.jest || deps['@types/jest']) {
            result.testFrameworks.add('Jest');
            this.addEvidence(result, 'package_json', 'package.json', 'Jest dependency found', 0.9);
        }
        // Vitest
        if (deps.vitest) {
            result.testFrameworks.add('Vitest');
            this.addEvidence(result, 'package_json', 'package.json', 'Vitest dependency found', 0.9);
        }
        // Mocha
        if (deps.mocha) {
            result.testFrameworks.add('Mocha');
            this.addEvidence(result, 'package_json', 'package.json', 'Mocha dependency found', 0.9);
        }
        // Ava
        if (deps.ava) {
            result.testFrameworks.add('Ava');
            this.addEvidence(result, 'package_json', 'package.json', 'Ava dependency found', 0.9);
        }
        // 检测配置文件
        this.detectNodeTestConfigFiles(repoRoot, result);
    }
    /**
     * 检测 Node 测试配置文件
     */
    async detectNodeTestConfigFiles(repoRoot, result) {
        const configFiles = [
            { file: 'jest.config.js', framework: 'Jest', evidence: 'file_pattern' },
            { file: 'jest.config.ts', framework: 'Jest', evidence: 'file_pattern' },
            { file: 'vitest.config.ts', framework: 'Vitest', evidence: 'file_pattern' },
            { file: 'vitest.config.js', framework: 'Vitest', evidence: 'file_pattern' },
            { file: 'mocha.opts', framework: 'Mocha', evidence: 'file_pattern' },
        ];
        for (const { file, framework, evidence } of configFiles) {
            const configPath = path.join(repoRoot, file);
            try {
                await fs.access(configPath);
                result.testFrameworks.add(framework);
                this.addEvidence(result, evidence, file, `${file} found`, 0.95);
            }
            catch {
                // 文件不存在
            }
        }
    }
    /**
     * 检测 tsconfig.json
     */
    async detectTsConfig(repoRoot, result) {
        const tsConfigPath = path.join(repoRoot, 'tsconfig.json');
        try {
            await fs.access(tsConfigPath);
            result.languages.add('TypeScript');
            this.addEvidence(result, 'tsconfig', 'tsconfig.json', 'tsconfig.json found', 1.0);
        }
        catch {
            // tsconfig.json 不存在
        }
    }
    /**
     * 检测 Python 项目
     */
    async detectPythonProject(repoRoot, result) {
        // 检测 pyproject.toml
        await this.detectPyproject(repoRoot, result);
        // 检测 requirements.txt
        await this.detectRequirements(repoRoot, result);
        // 检测 setup.py
        await this.detectSetupPy(repoRoot, result);
        // 检测 Django
        await this.detectDjango(repoRoot, result);
        // 检测 pytest
        await this.detectPytest(repoRoot, result);
    }
    /**
     * 检测 pyproject.toml
     */
    async detectPyproject(repoRoot, result) {
        const pyprojectPath = path.join(repoRoot, 'pyproject.toml');
        try {
            const content = await fs.readFile(pyprojectPath, 'utf-8');
            result.languages.add('Python');
            this.addEvidence(result, 'pyproject', 'pyproject.toml', 'pyproject.toml found', 1.0);
            // 检测 Poetry
            if (content.includes('[tool.poetry]')) {
                result.packageManagers.add('poetry');
                this.addEvidence(result, 'poetry_lock', 'pyproject.toml', 'Poetry configuration found', 0.95);
            }
            // 检测框架
            if (content.includes('fastapi'))
                result.frameworks.add('FastAPI');
            if (content.includes('django'))
                result.frameworks.add('Django');
            if (content.includes('flask'))
                result.frameworks.add('Flask');
            if (content.includes('pyramid'))
                result.frameworks.add('Pyramid');
            // 检测测试框架
            if (content.includes('pytest'))
                result.testFrameworks.add('pytest');
            if (content.includes('unittest'))
                result.testFrameworks.add('unittest');
        }
        catch {
            // pyproject.toml 不存在
        }
    }
    /**
     * 检测 requirements.txt
     */
    async detectRequirements(repoRoot, result) {
        const requirementsPath = path.join(repoRoot, 'requirements.txt');
        try {
            await fs.access(requirementsPath);
            result.languages.add('Python');
            result.packageManagers.add('pip');
            this.addEvidence(result, 'requirements', 'requirements.txt', 'requirements.txt found', 0.9);
            // 读取内容检测框架
            const content = await fs.readFile(requirementsPath, 'utf-8');
            if (content.includes('fastapi')) {
                result.frameworks.add('FastAPI');
                this.addEvidence(result, 'requirements', 'requirements.txt', 'FastAPI found in requirements', 0.9);
            }
            if (content.includes('django')) {
                result.frameworks.add('Django');
                this.addEvidence(result, 'requirements', 'requirements.txt', 'Django found in requirements', 0.9);
            }
            if (content.includes('flask')) {
                result.frameworks.add('Flask');
                this.addEvidence(result, 'requirements', 'requirements.txt', 'Flask found in requirements', 0.9);
            }
            if (content.includes('pytest')) {
                result.testFrameworks.add('pytest');
                this.addEvidence(result, 'requirements', 'requirements.txt', 'pytest found in requirements', 0.9);
            }
        }
        catch {
            // requirements.txt 不存在
        }
    }
    /**
     * 检测 setup.py
     */
    async detectSetupPy(repoRoot, result) {
        const setupPyPath = path.join(repoRoot, 'setup.py');
        try {
            await fs.access(setupPyPath);
            result.languages.add('Python');
            this.addEvidence(result, 'setup_py', 'setup.py', 'setup.py found', 0.8);
        }
        catch {
            // setup.py 不存在
        }
    }
    /**
     * 检测 Django
     */
    async detectDjango(repoRoot, result) {
        const managePyPath = path.join(repoRoot, 'manage.py');
        try {
            await fs.access(managePyPath);
            result.frameworks.add('Django');
            this.addEvidence(result, 'manage_py', 'manage.py', 'manage.py found', 1.0);
        }
        catch {
            // manage.py 不存在
        }
    }
    /**
     * 检测 pytest
     */
    async detectPytest(repoRoot, result) {
        const pytestIniPath = path.join(repoRoot, 'pytest.ini');
        const toxIniPath = path.join(repoRoot, 'tox.ini');
        try {
            await fs.access(pytestIniPath);
            result.testFrameworks.add('pytest');
            this.addEvidence(result, 'pytest_ini', 'pytest.ini', 'pytest.ini found', 0.95);
        }
        catch {
            // pytest.ini 不存在
        }
        try {
            await fs.access(toxIniPath);
            result.testFrameworks.add('tox');
            this.addEvidence(result, 'file_pattern', 'tox.ini', 'tox.ini found', 0.8);
        }
        catch {
            // tox.ini 不存在
        }
    }
    /**
     * 检测其他语言项目
     */
    async detectOtherProjects(repoRoot, result) {
        // Go
        await this.detectGoProject(repoRoot, result);
        // Rust
        await this.detectRustProject(repoRoot, result);
        // Java
        await this.detectJavaProject(repoRoot, result);
        // Ruby
        await this.detectRubyProject(repoRoot, result);
        // PHP
        await this.detectPhpProject(repoRoot, result);
    }
    /**
     * 检测 Go 项目
     */
    async detectGoProject(repoRoot, result) {
        const goModPath = path.join(repoRoot, 'go.mod');
        try {
            await fs.access(goModPath);
            result.languages.add('Go');
            this.addEvidence(result, 'go_mod', 'go.mod', 'go.mod found', 1.0);
        }
        catch {
            // go.mod 不存在
        }
    }
    /**
     * 检测 Rust 项目
     */
    async detectRustProject(repoRoot, result) {
        const cargoTomlPath = path.join(repoRoot, 'Cargo.toml');
        try {
            await fs.access(cargoTomlPath);
            result.languages.add('Rust');
            result.buildSystems.add('Cargo');
            this.addEvidence(result, 'cargo_toml', 'Cargo.toml', 'Cargo.toml found', 1.0);
        }
        catch {
            // Cargo.toml 不存在
        }
    }
    /**
     * 检测 Java 项目
     */
    async detectJavaProject(repoRoot, result) {
        const pomXmlPath = path.join(repoRoot, 'pom.xml');
        const buildGradlePath = path.join(repoRoot, 'build.gradle');
        try {
            await fs.access(pomXmlPath);
            result.languages.add('Java');
            result.buildSystems.add('Maven');
            this.addEvidence(result, 'file_pattern', 'pom.xml', 'pom.xml found', 1.0);
        }
        catch {
            // pom.xml 不存在
        }
        try {
            await fs.access(buildGradlePath);
            result.languages.add('Java');
            result.buildSystems.add('Gradle');
            this.addEvidence(result, 'file_pattern', 'build.gradle', 'build.gradle found', 1.0);
        }
        catch {
            // build.gradle 不存在
        }
    }
    /**
     * 检测 Ruby 项目
     */
    async detectRubyProject(repoRoot, result) {
        const gemfilePath = path.join(repoRoot, 'Gemfile');
        try {
            await fs.access(gemfilePath);
            result.languages.add('Ruby');
            result.packageManagers.add('bundler');
            this.addEvidence(result, 'gemfile', 'Gemfile', 'Gemfile found', 1.0);
            // 检测 Rails
            const gemfileContent = await fs.readFile(gemfilePath, 'utf-8');
            if (gemfileContent.includes("gem 'rails'")) {
                result.frameworks.add('Rails');
                this.addEvidence(result, 'gemfile', 'Gemfile', 'Rails gem found', 0.9);
            }
        }
        catch {
            // Gemfile 不存在
        }
    }
    /**
     * 检测 PHP 项目
     */
    async detectPhpProject(repoRoot, result) {
        const composerJsonPath = path.join(repoRoot, 'composer.json');
        try {
            await fs.access(composerJsonPath);
            result.languages.add('PHP');
            result.packageManagers.add('composer');
            this.addEvidence(result, 'composer_json', 'composer.json', 'composer.json found', 1.0);
            // 检测 Laravel
            const composerJsonContent = await fs.readFile(composerJsonPath, 'utf-8');
            if (composerJsonContent.includes('laravel')) {
                result.frameworks.add('Laravel');
                this.addEvidence(result, 'composer_json', 'composer.json', 'Laravel dependency found', 0.9);
            }
        }
        catch {
            // composer.json 不存在
        }
    }
    /**
     * 添加证据
     */
    addEvidence(result, type, source, content, confidence) {
        if (!this.config.includeEvidence)
            return;
        result.evidence.push({
            type,
            source,
            content,
            confidence,
            detectedAt: Date.now(),
        });
    }
    /**
     * 构建 RepoProfile
     */
    buildProfile(repoRoot, result) {
        return {
            repoRoot,
            languages: Array.from(result.languages),
            frameworks: Array.from(result.frameworks),
            packageManagers: Array.from(result.packageManagers),
            buildSystems: Array.from(result.buildSystems),
            testFrameworks: Array.from(result.testFrameworks),
            entrypoints: [], // 由 entrypoint_discovery 填充
            importantPaths: {
                app: [],
                lib: [],
                tests: [],
                infra: [],
                scripts: [],
                docs: [],
                configs: [],
            }, // 由 module_classifier 填充
            evidence: result.evidence,
            detectedAt: Date.now(),
        };
    }
}
exports.ProjectDetector = ProjectDetector;
// ============================================================================
// 辅助函数
// ============================================================================
/**
 * 检测是否有 Vite dev dependency
 */
function devHasVite(packageJson) {
    return packageJson.devDependencies?.vite !== undefined;
}
// ============================================================================
// 便捷函数
// ============================================================================
/**
 * 创建项目检测器
 */
function createProjectDetector(config) {
    return new ProjectDetector(config);
}
/**
 * 快速检测项目
 */
async function detectProject(repoRoot, config) {
    const detector = new ProjectDetector(config);
    return await detector.detect(repoRoot);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvamVjdF9kZXRlY3Rvci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9jb2RlL3Byb2plY3RfZGV0ZWN0b3IudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7Ozs7Ozs7R0FZRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBbW5CSCxzREFFQztBQUtELHNDQU1DO0FBOW5CRCxnREFBa0M7QUFDbEMsMkNBQTZCO0FBeUM3QiwrRUFBK0U7QUFDL0UsTUFBTTtBQUNOLCtFQUErRTtBQUUvRSxNQUFhLGVBQWU7SUFHMUIsWUFBWSxTQUF5QixFQUFFO1FBQ3JDLElBQUksQ0FBQyxNQUFNLEdBQUc7WUFDWixhQUFhLEVBQUUsTUFBTSxDQUFDLGFBQWEsSUFBSSxHQUFHO1lBQzFDLGVBQWUsRUFBRSxNQUFNLENBQUMsZUFBZSxJQUFJLElBQUk7U0FDaEQsQ0FBQztJQUNKLENBQUM7SUFFRDs7T0FFRztJQUNILEtBQUssQ0FBQyxNQUFNLENBQUMsUUFBZ0I7UUFDM0IsTUFBTSxNQUFNLEdBQW9CO1lBQzlCLFNBQVMsRUFBRSxJQUFJLEdBQUcsRUFBRTtZQUNwQixVQUFVLEVBQUUsSUFBSSxHQUFHLEVBQUU7WUFDckIsZUFBZSxFQUFFLElBQUksR0FBRyxFQUFFO1lBQzFCLFlBQVksRUFBRSxJQUFJLEdBQUcsRUFBRTtZQUN2QixjQUFjLEVBQUUsSUFBSSxHQUFHLEVBQUU7WUFDekIsUUFBUSxFQUFFLEVBQUU7U0FDYixDQUFDO1FBRUYscUNBQXFDO1FBQ3JDLE1BQU0sSUFBSSxDQUFDLGlCQUFpQixDQUFDLFFBQVEsRUFBRSxNQUFNLENBQUMsQ0FBQztRQUUvQyxrQkFBa0I7UUFDbEIsTUFBTSxJQUFJLENBQUMsbUJBQW1CLENBQUMsUUFBUSxFQUFFLE1BQU0sQ0FBQyxDQUFDO1FBRWpELGNBQWM7UUFDZCxNQUFNLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxRQUFRLEVBQUUsTUFBTSxDQUFDLENBQUM7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SSxLQUFLLFVBQVUsYUFBYSxDQUNqQyxRQUFnQixFQUNoQixNQUF1QjtJQUV2QixNQUFNLFFBQVEsR0FBRyxJQUFJLGVBQWUsQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUM3QyxPQUFPLE1BQU0sUUFBUSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsQ0FBQztBQUN6QyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBQcm9qZWN0IERldGVjdG9yIC0g6aG555uu57G75Z6L5qOA5rWL5ZmoXG4gKiBcbiAqIOiBjOi0o++8mlxuICogMS4g6K+G5Yir57yW56iL6K+t6KiAXG4gKiAyLiDor4bliKvmoYbmnrZcbiAqIDMuIOivhuWIq+WMheeuoeeQhuWZqFxuICogNC4g6K+G5Yir5p6E5bu657O757ufXG4gKiA1LiDor4bliKvmtYvor5XmoYbmnrZcbiAqIFxuICogQHZlcnNpb24gdjAuMS4wXG4gKiBAZGF0ZSAyMDI2LTA0LTAzXG4gKi9cblxuaW1wb3J0ICogYXMgZnMgZnJvbSAnZnMvcHJvbWlzZXMnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB0eXBlIHsgUmVwb1Byb2ZpbGUsIERldGVjdGlvbkV2aWRlbmNlLCBFdmlkZW5jZVR5cGUgfSBmcm9tICcuL3R5cGVzJztcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8g57G75Z6L5a6a5LmJXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog5qOA5rWL6YWN572uXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgRGV0ZWN0b3JDb25maWcge1xuICAvKiog5pyA5bCP572u5L+h5bqm6ZiI5YC8ICovXG4gIG1pbkNvbmZpZGVuY2U/OiBudW1iZXI7XG4gIFxuICAvKiog5piv5ZCm5YyF5ZCr6K+B5o2uICovXG4gIGluY2x1ZGVFdmlkZW5jZT86IGJvb2xlYW47XG59XG5cbi8qKlxuICog5qOA5rWL57uT5p6cXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgRGV0ZWN0aW9uUmVzdWx0IHtcbiAgLyoqIOivreiogCAqL1xuICBsYW5ndWFnZXM6IFNldDxzdHJpbmc+O1xuICBcbiAgLyoqIOahhuaetiAqL1xuICBmcmFtZXdvcmtzOiBTZXQ8c3RyaW5nPjtcbiAgXG4gIC8qKiDljIXnrqHnkIblmaggKi9cbiAgcGFja2FnZU1hbmFnZXJzOiBTZXQ8c3RyaW5nPjtcbiAgXG4gIC8qKiDmnoTlu7rns7vnu58gKi9cbiAgYnVpbGRTeXN0ZW1zOiBTZXQ8c3RyaW5nPjtcbiAgXG4gIC8qKiDmtYvor5XmoYbmnrYgKi9cbiAgdGVzdEZyYW1ld29ya3M6IFNldDxzdHJpbmc+O1xuICBcbiAgLyoqIOivgeaNriAqL1xuICBldmlkZW5jZTogRGV0ZWN0aW9uRXZpZGVuY2VbXTtcbn1cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8g5qOA5rWL5ZmoXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbmV4cG9ydCBjbGFzcyBQcm9qZWN0RGV0ZWN0b3Ige1xuICBwcml2YXRlIGNvbmZpZzogUmVxdWlyZWQ8RGV0ZWN0b3JDb25maWc+O1xuICBcbiAgY29uc3RydWN0b3IoY29uZmlnOiBEZXRlY3RvckNvbmZpZyA9IHt9KSB7XG4gICAgdGhpcy5jb25maWcgPSB7XG4gICAgICBtaW5Db25maWRlbmNlOiBjb25maWcubWluQ29uZmlkZW5jZSA/PyAwLjUsXG4gICAgICBpbmNsdWRlRXZpZGVuY2U6IGNvbmZpZy5pbmNsdWRlRXZpZGVuY2UgPz8gdHJ1ZSxcbiAgICB9O1xuICB9XG4gIFxuICAvKipcbiAgICog5qOA5rWL6aG555uuXG4gICAqL1xuICBhc3luYyBkZXRlY3QocmVwb1Jvb3Q6IHN0cmluZyk6IFByb21pc2U8UmVwb1Byb2ZpbGU+IHtcbiAgICBjb25zdCByZXN1bHQ6IERldGVjdGlvblJlc3VsdCA9IHtcbiAgICAgIGxhbmd1YWdlczogbmV3IFNldCgpLFxuICAgICAgZnJhbWV3b3JrczogbmV3IFNldCgpLFxuICAgICAgcGFja2FnZU1hbmFnZXJzOiBuZXcgU2V0KCksXG4gICAgICBidWlsZFN5c3RlbXM6IG5ldyBTZXQoKSxcbiAgICAgIHRlc3RGcmFtZXdvcmtzOiBuZXcgU2V0KCksXG4gICAgICBldmlkZW5jZTogW10sXG4gICAgfTtcbiAgICBcbiAgICAvLyAxLiDmo4DmtYsgcGFja2FnZS5qc29uIChOb2RlLmpzL1RTL0pTKVxuICAgIGF3YWl0IHRoaXMuZGV0ZWN0Tm9kZVByb2plY3QocmVwb1Jvb3QsIHJlc3VsdCk7XG4gICAgXG4gICAgLy8gMi4g5qOA5rWLIFB5dGhvbiDpobnnm65cbiAgICBhd2FpdCB0aGlzLmRldGVjdFB5dGhvblByb2plY3QocmVwb1Jvb3QsIHJlc3VsdCk7XG4gICAgXG4gICAgLy8gMy4g5qOA5rWL5YW25LuW6K+t6KiA6aG555uuXG4gICAgYXdhaXQgdGhpcy5kZXRlY3RPdGhlclByb2plY3RzKHJlcG9Sb290LCByZXN1bHQpO1xuICAgIFxuICAgIC8vIDQuIOaehOW7uiBSZXBvUHJvZmlsZVxuICAgIHJldHVybiB0aGlzLmJ1aWxkUHJvZmlsZShyZXBvUm9vdCwgcmVzdWx0KTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOajgOa1iyBOb2RlLmpzIOmhueebrlxuICAgKi9cbiAgcHJpdmF0ZSBhc3luYyBkZXRlY3ROb2RlUHJvamVjdChcbiAgICByZXBvUm9vdDogc3RyaW5nLFxuICAgIHJlc3VsdDogRGV0ZWN0aW9uUmVzdWx0XG4gICk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IHBhY2thZ2VKc29uUGF0aCA9IHBhdGguam9pbihyZXBvUm9vdCwgJ3BhY2thZ2UuanNvbicpO1xuICAgIFxuICAgIHRyeSB7XG4gICAgICBjb25zdCBwYWNrYWdlSnNvbkNvbnRlbnQgPSBhd2FpdCBmcy5yZWFkRmlsZShwYWNrYWdlSnNvblBhdGgsICd1dGYtOCcpO1xuICAgICAgY29uc3QgcGFja2FnZUpzb24gPSBKU09OLnBhcnNlKHBhY2thZ2VKc29uQ29udGVudCk7XG4gICAgICBcbiAgICAgIC8vIOa3u+WKoOivreiogFxuICAgICAgaWYgKHBhY2thZ2VKc29uLmRldkRlcGVuZGVuY2llcz8udHlwZXNjcmlwdCB8fCBwYWNrYWdlSnNvbi5kZXBlbmRlbmNpZXM/LnR5cGVzY3JpcHQpIHtcbiAgICAgICAgcmVzdWx0Lmxhbmd1YWdlcy5hZGQoJ1R5cGVTY3JpcHQnKTtcbiAgICAgICAgdGhpcy5hZGRFdmlkZW5jZShyZXN1bHQsICd0c2NvbmZpZycsICdwYWNrYWdlLmpzb24nLCAnVHlwZVNjcmlwdCBkZXBlbmRlbmN5IGZvdW5kJywgMC45KTtcbiAgICAgIH1cbiAgICAgIHJlc3VsdC5sYW5ndWFnZXMuYWRkKCdKYXZhU2NyaXB0Jyk7XG4gICAgICBcbiAgICAgIC8vIOa3u+WKoOWMheeuoeeQhuWZqFxuICAgICAgaWYgKGF3YWl0IGZzLmFjY2VzcyhwYXRoLmpvaW4ocmVwb1Jvb3QsICdwbnBtLWxvY2sueWFtbCcpKS50aGVuKCgpID0+IHRydWUpLmNhdGNoKCgpID0+IGZhbHNlKSkge1xuICAgICAgICByZXN1bHQucGFja2FnZU1hbmFnZXJzLmFkZCgncG5wbScpO1xuICAgICAgICB0aGlzLmFkZEV2aWRlbmNlKHJlc3VsdCwgJ3BhY2thZ2VfanNvbicsICdwbnBtLWxvY2sueWFtbCcsICdwbnBtIGxvY2sgZmlsZSBmb3VuZCcsIDEuMCk7XG4gICAgICB9IGVsc2UgaWYgKGF3YWl0IGZzLmFjY2VzcyhwYXRoLmpvaW4ocmVwb1Jvb3QsICd5YXJuLmxvY2snKSkudGhlbigoKSA9PiB0cnVlKS5jYXRjaCgoKSA9PiBmYWxzZSkpIHtcbiAgICAgICAgcmVzdWx0LnBhY2thZ2VNYW5hZ2Vycy5hZGQoJ3lhcm4nKTtcbiAgICAgICAgdGhpcy5hZGRFdmlkZW5jZShyZXN1bHQsICdwYWNrYWdlX2pzb24nLCAneWFybi5sb2NrJywgJ3lhcm4gbG9jayBmaWxlIGZvdW5kJywgMS4wKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJlc3VsdC5wYWNrYWdlTWFuYWdlcnMuYWRkKCducG0nKTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgLy8g5qOA5rWL5qGG5p62XG4gICAgICB0aGlzLmRldGVjdE5vZGVGcmFtZXdvcmtzKHBhY2thZ2VKc29uLCByZXBvUm9vdCwgcmVzdWx0KTtcbiAgICAgIFxuICAgICAgLy8g5qOA5rWL5rWL6K+V5qGG5p62XG4gICAgICB0aGlzLmRldGVjdE5vZGVUZXN0RnJhbWV3b3JrcyhwYWNrYWdlSnNvbiwgcmVwb1Jvb3QsIHJlc3VsdCk7XG4gICAgICBcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgLy8gcGFja2FnZS5qc29uIOS4jeWtmOWcqOaIluino+aekOWksei0pVxuICAgIH1cbiAgICBcbiAgICAvLyDmo4DmtYsgdHNjb25maWcuanNvblxuICAgIGF3YWl0IHRoaXMuZGV0ZWN0VHNDb25maWcocmVwb1Jvb3QsIHJlc3VsdCk7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDmo4DmtYsgTm9kZSDmoYbmnrZcbiAgICovXG4gIHByaXZhdGUgZGV0ZWN0Tm9kZUZyYW1ld29ya3MoXG4gICAgcGFja2FnZUpzb246IGFueSxcbiAgICByZXBvUm9vdDogc3RyaW5nLFxuICAgIHJlc3VsdDogRGV0ZWN0aW9uUmVzdWx0XG4gICk6IHZvaWQge1xuICAgIGNvbnN0IGRlcHMgPSB7XG4gICAgICAuLi5wYWNrYWdlSnNvbi5kZXBlbmRlbmNpZXMsXG4gICAgICAuLi5wYWNrYWdlSnNvbi5kZXZEZXBlbmRlbmNpZXMsXG4gICAgfTtcbiAgICBcbiAgICAvLyBSZWFjdFxuICAgIGlmIChkZXBzLnJlYWN0KSB7XG4gICAgICByZXN1bHQuZnJhbWV3b3Jrcy5hZGQoJ1JlYWN0Jyk7XG4gICAgICB0aGlzLmFkZEV2aWRlbmNlKHJlc3VsdCwgJ3BhY2thZ2VfanNvbicsICdwYWNrYWdlLmpzb24nLCAnUmVhY3QgZGVwZW5kZW5jeSBmb3VuZCcsIDAuOSk7XG4gICAgICBcbiAgICAgIC8vIE5leHQuanNcbiAgICAgIGlmIChkZXBzLm5leHQpIHtcbiAgICAgICAgcmVzdWx0LmZyYW1ld29ya3MuYWRkKCdOZXh0LmpzJyk7XG4gICAgICAgIHRoaXMuYWRkRXZpZGVuY2UocmVzdWx0LCAncGFja2FnZV9qc29uJywgJ3BhY2thZ2UuanNvbicsICdOZXh0LmpzIGRlcGVuZGVuY3kgZm91bmQnLCAxLjApO1xuICAgICAgfVxuICAgICAgXG4gICAgICAvLyBWaXRlXG4gICAgICBpZiAoZGVwcy52aXRlIHx8IGRldkhhc1ZpdGUocGFja2FnZUpzb24pKSB7XG4gICAgICAgIHJlc3VsdC5mcmFtZXdvcmtzLmFkZCgnVml0ZScpO1xuICAgICAgICB0aGlzLmFkZEV2aWRlbmNlKHJlc3VsdCwgJ3BhY2thZ2VfanNvbicsICdwYWNrYWdlLmpzb24nLCAnVml0ZSBkZXBlbmRlbmN5IGZvdW5kJywgMC45KTtcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgLy8gVnVlXG4gICAgaWYgKGRlcHMudnVlIHx8IGRlcHNbJ3Z1ZS1yb3V0ZXInXSkge1xuICAgICAgcmVzdWx0LmZyYW1ld29ya3MuYWRkKCdWdWUnKTtcbiAgICAgIHRoaXMuYWRkRXZpZGVuY2UocmVzdWx0LCAncGFja2FnZV9qc29uJywgJ3BhY2thZ2UuanNvbicsICdWdWUgZGVwZW5kZW5jeSBmb3VuZCcsIDAuOSk7XG4gICAgfVxuICAgIFxuICAgIC8vIEV4cHJlc3NcbiAgICBpZiAoZGVwcy5leHByZXNzKSB7XG4gICAgICByZXN1bHQuZnJhbWV3b3Jrcy5hZGQoJ0V4cHJlc3MnKTtcbiAgICAgIHRoaXMuYWRkRXZpZGVuY2UocmVzdWx0LCAncGFja2FnZV9qc29uJywgJ3BhY2thZ2UuanNvbicsICdFeHByZXNzIGRlcGVuZGVuY3kgZm91bmQnLCAwLjkpO1xuICAgIH1cbiAgICBcbiAgICAvLyBOZXN0SlNcbiAgICBpZiAoZGVwc1snQG5lc3Rqcy9jb3JlJ10pIHtcbiAgICAgIHJlc3VsdC5mcmFtZXdvcmtzLmFkZCgnTmVzdEpTJyk7XG4gICAgICB0aGlzLmFkZEV2aWRlbmNlKHJlc3VsdCwgJ3BhY2thZ2VfanNvbicsICdwYWNrYWdlLmpzb24nLCAnTmVzdEpTIGRlcGVuZGVuY3kgZm91bmQnLCAxLjApO1xuICAgIH1cbiAgICBcbiAgICAvLyDmo4DmtYvphY3nva7mlofku7ZcbiAgICB0aGlzLmRldGVjdE5vZGVDb25maWdGaWxlcyhyZXBvUm9vdCwgcmVzdWx0KTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOajgOa1iyBOb2RlIOmFjee9ruaWh+S7tlxuICAgKi9cbiAgcHJpdmF0ZSBhc3luYyBkZXRlY3ROb2RlQ29uZmlnRmlsZXMocmVwb1Jvb3Q6IHN0cmluZywgcmVzdWx0OiBEZXRlY3Rpb25SZXN1bHQpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCBjb25maWdGaWxlcyA9IFtcbiAgICAgIHsgZmlsZTogJ3ZpdGUuY29uZmlnLnRzJywgZnJhbWV3b3JrOiAnVml0ZScsIGV2aWRlbmNlOiAndml0ZV9jb25maWcnIGFzIEV2aWRlbmNlVHlwZSB9LFxuICAgICAgeyBmaWxlOiAndml0ZS5jb25maWcuanMnLCBmcmFtZXdvcms6ICdWaXRlJywgZXZpZGVuY2U6ICd2aXRlX2NvbmZpZycgYXMgRXZpZGVuY2VUeXBlIH0sXG4gICAgICB7IGZpbGU6ICduZXh0LmNvbmZpZy5qcycsIGZyYW1ld29yazogJ05leHQuanMnLCBldmlkZW5jZTogJ25leHRfY29uZmlnJyBhcyBFdmlkZW5jZVR5cGUgfSxcbiAgICAgIHsgZmlsZTogJ25leHQuY29uZmlnLnRzJywgZnJhbWV3b3JrOiAnTmV4dC5qcycsIGV2aWRlbmNlOiAnbmV4dF9jb25maWcnIGFzIEV2aWRlbmNlVHlwZSB9LFxuICAgICAgeyBmaWxlOiAnbnV4dC5jb25maWcuanMnLCBmcmFtZXdvcms6ICdOdXh0JywgZXZpZGVuY2U6ICdmaWxlX3BhdHRlcm4nIGFzIEV2aWRlbmNlVHlwZSB9LFxuICAgICAgeyBmaWxlOiAnc3ZlbHRlLmNvbmZpZy5qcycsIGZyYW1ld29yazogJ1N2ZWx0ZScsIGV2aWRlbmNlOiAnZmlsZV9wYXR0ZXJuJyBhcyBFdmlkZW5jZVR5cGUgfSxcbiAgICAgIHsgZmlsZTogJ2FzdHJvLmNvbmZpZy5tanMnLCBmcmFtZXdvcms6ICdBc3RybycsIGV2aWRlbmNlOiAnZmlsZV9wYXR0ZXJuJyBhcyBFdmlkZW5jZVR5cGUgfSxcbiAgICAgIHsgZmlsZTogJ3JlbWl4LmNvbmZpZy5qcycsIGZyYW1ld29yazogJ1JlbWl4JywgZXZpZGVuY2U6ICdmaWxlX3BhdHRlcm4nIGFzIEV2aWRlbmNlVHlwZSB9LFxuICAgIF07XG4gICAgXG4gICAgZm9yIChjb25zdCB7IGZpbGUsIGZyYW1ld29yaywgZXZpZGVuY2UgfSBvZiBjb25maWdGaWxlcykge1xuICAgICAgY29uc3QgY29uZmlnUGF0aCA9IHBhdGguam9pbihyZXBvUm9vdCwgZmlsZSk7XG4gICAgICB0cnkge1xuICAgICAgICBhd2FpdCBmcy5hY2Nlc3MoY29uZmlnUGF0aCk7XG4gICAgICAgIHJlc3VsdC5mcmFtZXdvcmtzLmFkZChmcmFtZXdvcmspO1xuICAgICAgICB0aGlzLmFkZEV2aWRlbmNlKHJlc3VsdCwgZXZpZGVuY2UsIGZpbGUsIGAke2ZpbGV9IGZvdW5kYCwgMC45NSk7XG4gICAgICB9IGNhdGNoIHtcbiAgICAgICAgLy8g5paH5Lu25LiN5a2Y5ZyoXG4gICAgICB9XG4gICAgfVxuICB9XG4gIFxuICAvKipcbiAgICog5qOA5rWLIE5vZGUg5rWL6K+V5qGG5p62XG4gICAqL1xuICBwcml2YXRlIGRldGVjdE5vZGVUZXN0RnJhbWV3b3JrcyhcbiAgICBwYWNrYWdlSnNvbjogYW55LFxuICAgIHJlcG9Sb290OiBzdHJpbmcsXG4gICAgcmVzdWx0OiBEZXRlY3Rpb25SZXN1bHRcbiAgKTogdm9pZCB7XG4gICAgY29uc3QgZGVwcyA9IHtcbiAgICAgIC4uLnBhY2thZ2VKc29uLmRlcGVuZGVuY2llcyxcbiAgICAgIC4uLnBhY2thZ2VKc29uLmRldkRlcGVuZGVuY2llcyxcbiAgICB9O1xuICAgIFxuICAgIC8vIEplc3RcbiAgICBpZiAoZGVwcy5qZXN0IHx8IGRlcHNbJ0B0eXBlcy9qZXN0J10pIHtcbiAgICAgIHJlc3VsdC50ZXN0RnJhbWV3b3Jrcy5hZGQoJ0plc3QnKTtcbiAgICAgIHRoaXMuYWRkRXZpZGVuY2UocmVzdWx0LCAncGFja2FnZV9qc29uJywgJ3BhY2thZ2UuanNvbicsICdKZXN0IGRlcGVuZGVuY3kgZm91bmQnLCAwLjkpO1xuICAgIH1cbiAgICBcbiAgICAvLyBWaXRlc3RcbiAgICBpZiAoZGVwcy52aXRlc3QpIHtcbiAgICAgIHJlc3VsdC50ZXN0RnJhbWV3b3Jrcy5hZGQoJ1ZpdGVzdCcpO1xuICAgICAgdGhpcy5hZGRFdmlkZW5jZShyZXN1bHQsICdwYWNrYWdlX2pzb24nLCAncGFja2FnZS5qc29uJywgJ1ZpdGVzdCBkZXBlbmRlbmN5IGZvdW5kJywgMC45KTtcbiAgICB9XG4gICAgXG4gICAgLy8gTW9jaGFcbiAgICBpZiAoZGVwcy5tb2NoYSkge1xuICAgICAgcmVzdWx0LnRlc3RGcmFtZXdvcmtzLmFkZCgnTW9jaGEnKTtcbiAgICAgIHRoaXMuYWRkRXZpZGVuY2UocmVzdWx0LCAncGFja2FnZV9qc29uJywgJ3BhY2thZ2UuanNvbicsICdNb2NoYSBkZXBlbmRlbmN5IGZvdW5kJywgMC45KTtcbiAgICB9XG4gICAgXG4gICAgLy8gQXZhXG4gICAgaWYgKGRlcHMuYXZhKSB7XG4gICAgICByZXN1bHQudGVzdEZyYW1ld29ya3MuYWRkKCdBdmEnKTtcbiAgICAgIHRoaXMuYWRkRXZpZGVuY2UocmVzdWx0LCAncGFja2FnZV9qc29uJywgJ3BhY2thZ2UuanNvbicsICdBdmEgZGVwZW5kZW5jeSBmb3VuZCcsIDAuOSk7XG4gICAgfVxuICAgIFxuICAgIC8vIOajgOa1i+mFjee9ruaWh+S7tlxuICAgIHRoaXMuZGV0ZWN0Tm9kZVRlc3RDb25maWdGaWxlcyhyZXBvUm9vdCwgcmVzdWx0KTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOajgOa1iyBOb2RlIOa1i+ivlemFjee9ruaWh+S7tlxuICAgKi9cbiAgcHJpdmF0ZSBhc3luYyBkZXRlY3ROb2RlVGVzdENvbmZpZ0ZpbGVzKHJlcG9Sb290OiBzdHJpbmcsIHJlc3VsdDogRGV0ZWN0aW9uUmVzdWx0KTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgY29uZmlnRmlsZXMgPSBbXG4gICAgICB7IGZpbGU6ICdqZXN0LmNvbmZpZy5qcycsIGZyYW1ld29yazogJ0plc3QnLCBldmlkZW5jZTogJ2ZpbGVfcGF0dGVybicgYXMgRXZpZGVuY2VUeXBlIH0sXG4gICAgICB7IGZpbGU6ICdqZXN0LmNvbmZpZy50cycsIGZyYW1ld29yazogJ0plc3QnLCBldmlkZW5jZTogJ2ZpbGVfcGF0dGVybicgYXMgRXZpZGVuY2VUeXBlIH0sXG4gICAgICB7IGZpbGU6ICd2aXRlc3QuY29uZmlnLnRzJywgZnJhbWV3b3JrOiAnVml0ZXN0JywgZXZpZGVuY2U6ICdmaWxlX3BhdHRlcm4nIGFzIEV2aWRlbmNlVHlwZSB9LFxuICAgICAgeyBmaWxlOiAndml0ZXN0LmNvbmZpZy5qcycsIGZyYW1ld29yazogJ1ZpdGVzdCcsIGV2aWRlbmNlOiAnZmlsZV9wYXR0ZXJuJyBhcyBFdmlkZW5jZVR5cGUgfSxcbiAgICAgIHsgZmlsZTogJ21vY2hhLm9wdHMnLCBmcmFtZXdvcms6ICdNb2NoYScsIGV2aWRlbmNlOiAnZmlsZV9wYXR0ZXJuJyBhcyBFdmlkZW5jZVR5cGUgfSxcbiAgICBdO1xuICAgIFxuICAgIGZvciAoY29uc3QgeyBmaWxlLCBmcmFtZXdvcmssIGV2aWRlbmNlIH0gb2YgY29uZmlnRmlsZXMpIHtcbiAgICAgIGNvbnN0IGNvbmZpZ1BhdGggPSBwYXRoLmpvaW4ocmVwb1Jvb3QsIGZpbGUpO1xuICAgICAgdHJ5IHtcbiAgICAgICAgYXdhaXQgZnMuYWNjZXNzKGNvbmZpZ1BhdGgpO1xuICAgICAgICByZXN1bHQudGVzdEZyYW1ld29ya3MuYWRkKGZyYW1ld29yayk7XG4gICAgICAgIHRoaXMuYWRkRXZpZGVuY2UocmVzdWx0LCBldmlkZW5jZSwgZmlsZSwgYCR7ZmlsZX0gZm91bmRgLCAwLjk1KTtcbiAgICAgIH0gY2F0Y2gge1xuICAgICAgICAvLyDmlofku7bkuI3lrZjlnKhcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDmo4DmtYsgdHNjb25maWcuanNvblxuICAgKi9cbiAgcHJpdmF0ZSBhc3luYyBkZXRlY3RUc0NvbmZpZyhyZXBvUm9vdDogc3RyaW5nLCByZXN1bHQ6IERldGVjdGlvblJlc3VsdCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IHRzQ29uZmlnUGF0aCA9IHBhdGguam9pbihyZXBvUm9vdCwgJ3RzY29uZmlnLmpzb24nKTtcbiAgICBcbiAgICB0cnkge1xuICAgICAgYXdhaXQgZnMuYWNjZXNzKHRzQ29uZmlnUGF0aCk7XG4gICAgICByZXN1bHQubGFuZ3VhZ2VzLmFkZCgnVHlwZVNjcmlwdCcpO1xuICAgICAgdGhpcy5hZGRFdmlkZW5jZShyZXN1bHQsICd0c2NvbmZpZycsICd0c2NvbmZpZy5qc29uJywgJ3RzY29uZmlnLmpzb24gZm91bmQnLCAxLjApO1xuICAgIH0gY2F0Y2gge1xuICAgICAgLy8gdHNjb25maWcuanNvbiDkuI3lrZjlnKhcbiAgICB9XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDmo4DmtYsgUHl0aG9uIOmhueebrlxuICAgKi9cbiAgcHJpdmF0ZSBhc3luYyBkZXRlY3RQeXRob25Qcm9qZWN0KFxuICAgIHJlcG9Sb290OiBzdHJpbmcsXG4gICAgcmVzdWx0OiBEZXRlY3Rpb25SZXN1bHRcbiAgKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgLy8g5qOA5rWLIHB5cHJvamVjdC50b21sXG4gICAgYXdhaXQgdGhpcy5kZXRlY3RQeXByb2plY3QocmVwb1Jvb3QsIHJlc3VsdCk7XG4gICAgXG4gICAgLy8g5qOA5rWLIHJlcXVpcmVtZW50cy50eHRcbiAgICBhd2FpdCB0aGlzLmRldGVjdFJlcXVpcmVtZW50cyhyZXBvUm9vdCwgcmVzdWx0KTtcbiAgICBcbiAgICAvLyDmo4DmtYsgc2V0dXAucHlcbiAgICBhd2FpdCB0aGlzLmRldGVjdFNldHVwUHkocmVwb1Jvb3QsIHJlc3VsdCk7XG4gICAgXG4gICAgLy8g5qOA5rWLIERqYW5nb1xuICAgIGF3YWl0IHRoaXMuZGV0ZWN0RGphbmdvKHJlcG9Sb290LCByZXN1bHQpO1xuICAgIFxuICAgIC8vIOajgOa1iyBweXRlc3RcbiAgICBhd2FpdCB0aGlzLmRldGVjdFB5dGVzdChyZXBvUm9vdCwgcmVzdWx0KTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOajgOa1iyBweXByb2plY3QudG9tbFxuICAgKi9cbiAgcHJpdmF0ZSBhc3luYyBkZXRlY3RQeXByb2plY3QocmVwb1Jvb3Q6IHN0cmluZywgcmVzdWx0OiBEZXRlY3Rpb25SZXN1bHQpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCBweXByb2plY3RQYXRoID0gcGF0aC5qb2luKHJlcG9Sb290LCAncHlwcm9qZWN0LnRvbWwnKTtcbiAgICBcbiAgICB0cnkge1xuICAgICAgY29uc3QgY29udGVudCA9IGF3YWl0IGZzLnJlYWRGaWxlKHB5cHJvamVjdFBhdGgsICd1dGYtOCcpO1xuICAgICAgcmVzdWx0Lmxhbmd1YWdlcy5hZGQoJ1B5dGhvbicpO1xuICAgICAgdGhpcy5hZGRFdmlkZW5jZShyZXN1bHQsICdweXByb2plY3QnLCAncHlwcm9qZWN0LnRvbWwnLCAncHlwcm9qZWN0LnRvbWwgZm91bmQnLCAxLjApO1xuICAgICAgXG4gICAgICAvLyDmo4DmtYsgUG9ldHJ5XG4gICAgICBpZiAoY29udGVudC5pbmNsdWRlcygnW3Rvb2wucG9ldHJ5XScpKSB7XG4gICAgICAgIHJlc3VsdC5wYWNrYWdlTWFuYWdlcnMuYWRkKCdwb2V0cnknKTtcbiAgICAgICAgdGhpcy5hZGRFdmlkZW5jZShyZXN1bHQsICdwb2V0cnlfbG9jaycsICdweXByb2plY3QudG9tbCcsICdQb2V0cnkgY29uZmlndXJhdGlvbiBmb3VuZCcsIDAuOTUpO1xuICAgICAgfVxuICAgICAgXG4gICAgICAvLyDmo4DmtYvmoYbmnrZcbiAgICAgIGlmIChjb250ZW50LmluY2x1ZGVzKCdmYXN0YXBpJykpIHJlc3VsdC5mcmFtZXdvcmtzLmFkZCgnRmFzdEFQSScpO1xuICAgICAgaWYgKGNvbnRlbnQuaW5jbHVkZXMoJ2RqYW5nbycpKSByZXN1bHQuZnJhbWV3b3Jrcy5hZGQoJ0RqYW5nbycpO1xuICAgICAgaWYgKGNvbnRlbnQuaW5jbHVkZXMoJ2ZsYXNrJykpIHJlc3VsdC5mcmFtZXdvcmtzLmFkZCgnRmxhc2snKTtcbiAgICAgIGlmIChjb250ZW50LmluY2x1ZGVzKCdweXJhbWlkJykpIHJlc3VsdC5mcmFtZXdvcmtzLmFkZCgnUHlyYW1pZCcpO1xuICAgICAgXG4gICAgICAvLyDmo4DmtYvmtYvor5XmoYbmnrZcbiAgICAgIGlmIChjb250ZW50LmluY2x1ZGVzKCdweXRlc3QnKSkgcmVzdWx0LnRlc3RGcmFtZXdvcmtzLmFkZCgncHl0ZXN0Jyk7XG4gICAgICBpZiAoY29udGVudC5pbmNsdWRlcygndW5pdHRlc3QnKSkgcmVzdWx0LnRlc3RGcmFtZXdvcmtzLmFkZCgndW5pdHRlc3QnKTtcbiAgICAgIFxuICAgIH0gY2F0Y2gge1xuICAgICAgLy8gcHlwcm9qZWN0LnRvbWwg5LiN5a2Y5ZyoXG4gICAgfVxuICB9XG4gIFxuICAvKipcbiAgICog5qOA5rWLIHJlcXVpcmVtZW50cy50eHRcbiAgICovXG4gIHByaXZhdGUgYXN5bmMgZGV0ZWN0UmVxdWlyZW1lbnRzKHJlcG9Sb290OiBzdHJpbmcsIHJlc3VsdDogRGV0ZWN0aW9uUmVzdWx0KTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgcmVxdWlyZW1lbnRzUGF0aCA9IHBhdGguam9pbihyZXBvUm9vdCwgJ3JlcXVpcmVtZW50cy50eHQnKTtcbiAgICBcbiAgICB0cnkge1xuICAgICAgYXdhaXQgZnMuYWNjZXNzKHJlcXVpcmVtZW50c1BhdGgpO1xuICAgICAgcmVzdWx0Lmxhbmd1YWdlcy5hZGQoJ1B5dGhvbicpO1xuICAgICAgcmVzdWx0LnBhY2thZ2VNYW5hZ2Vycy5hZGQoJ3BpcCcpO1xuICAgICAgdGhpcy5hZGRFdmlkZW5jZShyZXN1bHQsICdyZXF1aXJlbWVudHMnLCAncmVxdWlyZW1lbnRzLnR4dCcsICdyZXF1aXJlbWVudHMudHh0IGZvdW5kJywgMC45KTtcbiAgICAgIFxuICAgICAgLy8g6K+75Y+W5YaF5a655qOA5rWL5qGG5p62XG4gICAgICBjb25zdCBjb250ZW50ID0gYXdhaXQgZnMucmVhZEZpbGUocmVxdWlyZW1lbnRzUGF0aCwgJ3V0Zi04Jyk7XG4gICAgICBcbiAgICAgIGlmIChjb250ZW50LmluY2x1ZGVzKCdmYXN0YXBpJykpIHtcbiAgICAgICAgcmVzdWx0LmZyYW1ld29ya3MuYWRkKCdGYXN0QVBJJyk7XG4gICAgICAgIHRoaXMuYWRkRXZpZGVuY2UocmVzdWx0LCAncmVxdWlyZW1lbnRzJywgJ3JlcXVpcmVtZW50cy50eHQnLCAnRmFzdEFQSSBmb3VuZCBpbiByZXF1aXJlbWVudHMnLCAwLjkpO1xuICAgICAgfVxuICAgICAgaWYgKGNvbnRlbnQuaW5jbHVkZXMoJ2RqYW5nbycpKSB7XG4gICAgICAgIHJlc3VsdC5mcmFtZXdvcmtzLmFkZCgnRGphbmdvJyk7XG4gICAgICAgIHRoaXMuYWRkRXZpZGVuY2UocmVzdWx0LCAncmVxdWlyZW1lbnRzJywgJ3JlcXVpcmVtZW50cy50eHQnLCAnRGphbmdvIGZvdW5kIGluIHJlcXVpcmVtZW50cycsIDAuOSk7XG4gICAgICB9XG4gICAgICBpZiAoY29udGVudC5pbmNsdWRlcygnZmxhc2snKSkge1xuICAgICAgICByZXN1bHQuZnJhbWV3b3Jrcy5hZGQoJ0ZsYXNrJyk7XG4gICAgICAgIHRoaXMuYWRkRXZpZGVuY2UocmVzdWx0LCAncmVxdWlyZW1lbnRzJywgJ3JlcXVpcmVtZW50cy50eHQnLCAnRmxhc2sgZm91bmQgaW4gcmVxdWlyZW1lbnRzJywgMC45KTtcbiAgICAgIH1cbiAgICAgIGlmIChjb250ZW50LmluY2x1ZGVzKCdweXRlc3QnKSkge1xuICAgICAgICByZXN1bHQudGVzdEZyYW1ld29ya3MuYWRkKCdweXRlc3QnKTtcbiAgICAgICAgdGhpcy5hZGRFdmlkZW5jZShyZXN1bHQsICdyZXF1aXJlbWVudHMnLCAncmVxdWlyZW1lbnRzLnR4dCcsICdweXRlc3QgZm91bmQgaW4gcmVxdWlyZW1lbnRzJywgMC45KTtcbiAgICAgIH1cbiAgICAgIFxuICAgIH0gY2F0Y2gge1xuICAgICAgLy8gcmVxdWlyZW1lbnRzLnR4dCDkuI3lrZjlnKhcbiAgICB9XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDmo4DmtYsgc2V0dXAucHlcbiAgICovXG4gIHByaXZhdGUgYXN5bmMgZGV0ZWN0U2V0dXBQeShyZXBvUm9vdDogc3RyaW5nLCByZXN1bHQ6IERldGVjdGlvblJlc3VsdCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IHNldHVwUHlQYXRoID0gcGF0aC5qb2luKHJlcG9Sb290LCAnc2V0dXAucHknKTtcbiAgICBcbiAgICB0cnkge1xuICAgICAgYXdhaXQgZnMuYWNjZXNzKHNldHVwUHlQYXRoKTtcbiAgICAgIHJlc3VsdC5sYW5ndWFnZXMuYWRkKCdQeXRob24nKTtcbiAgICAgIHRoaXMuYWRkRXZpZGVuY2UocmVzdWx0LCAnc2V0dXBfcHknLCAnc2V0dXAucHknLCAnc2V0dXAucHkgZm91bmQnLCAwLjgpO1xuICAgIH0gY2F0Y2gge1xuICAgICAgLy8gc2V0dXAucHkg5LiN5a2Y5ZyoXG4gICAgfVxuICB9XG4gIFxuICAvKipcbiAgICog5qOA5rWLIERqYW5nb1xuICAgKi9cbiAgcHJpdmF0ZSBhc3luYyBkZXRlY3REamFuZ28ocmVwb1Jvb3Q6IHN0cmluZywgcmVzdWx0OiBEZXRlY3Rpb25SZXN1bHQpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCBtYW5hZ2VQeVBhdGggPSBwYXRoLmpvaW4ocmVwb1Jvb3QsICdtYW5hZ2UucHknKTtcbiAgICBcbiAgICB0cnkge1xuICAgICAgYXdhaXQgZnMuYWNjZXNzKG1hbmFnZVB5UGF0aCk7XG4gICAgICByZXN1bHQuZnJhbWV3b3Jrcy5hZGQoJ0RqYW5nbycpO1xuICAgICAgdGhpcy5hZGRFdmlkZW5jZShyZXN1bHQsICdtYW5hZ2VfcHknLCAnbWFuYWdlLnB5JywgJ21hbmFnZS5weSBmb3VuZCcsIDEuMCk7XG4gICAgfSBjYXRjaCB7XG4gICAgICAvLyBtYW5hZ2UucHkg5LiN5a2Y5ZyoXG4gICAgfVxuICB9XG4gIFxuICAvKipcbiAgICog5qOA5rWLIHB5dGVzdFxuICAgKi9cbiAgcHJpdmF0ZSBhc3luYyBkZXRlY3RQeXRlc3QocmVwb1Jvb3Q6IHN0cmluZywgcmVzdWx0OiBEZXRlY3Rpb25SZXN1bHQpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCBweXRlc3RJbmlQYXRoID0gcGF0aC5qb2luKHJlcG9Sb290LCAncHl0ZXN0LmluaScpO1xuICAgIGNvbnN0IHRveEluaVBhdGggPSBwYXRoLmpvaW4ocmVwb1Jvb3QsICd0b3guaW5pJyk7XG4gICAgXG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IGZzLmFjY2VzcyhweXRlc3RJbmlQYXRoKTtcbiAgICAgIHJlc3VsdC50ZXN0RnJhbWV3b3Jrcy5hZGQoJ3B5dGVzdCcpO1xuICAgICAgdGhpcy5hZGRFdmlkZW5jZShyZXN1bHQsICdweXRlc3RfaW5pJywgJ3B5dGVzdC5pbmknLCAncHl0ZXN0LmluaSBmb3VuZCcsIDAuOTUpO1xuICAgIH0gY2F0Y2gge1xuICAgICAgLy8gcHl0ZXN0LmluaSDkuI3lrZjlnKhcbiAgICB9XG4gICAgXG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IGZzLmFjY2Vzcyh0b3hJbmlQYXRoKTtcbiAgICAgIHJlc3VsdC50ZXN0RnJhbWV3b3Jrcy5hZGQoJ3RveCcpO1xuICAgICAgdGhpcy5hZGRFdmlkZW5jZShyZXN1bHQsICdmaWxlX3BhdHRlcm4nLCAndG94LmluaScsICd0b3guaW5pIGZvdW5kJywgMC44KTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIC8vIHRveC5pbmkg5LiN5a2Y5ZyoXG4gICAgfVxuICB9XG4gIFxuICAvKipcbiAgICog5qOA5rWL5YW25LuW6K+t6KiA6aG555uuXG4gICAqL1xuICBwcml2YXRlIGFzeW5jIGRldGVjdE90aGVyUHJvamVjdHMoXG4gICAgcmVwb1Jvb3Q6IHN0cmluZyxcbiAgICByZXN1bHQ6IERldGVjdGlvblJlc3VsdFxuICApOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAvLyBHb1xuICAgIGF3YWl0IHRoaXMuZGV0ZWN0R29Qcm9qZWN0KHJlcG9Sb290LCByZXN1bHQpO1xuICAgIFxuICAgIC8vIFJ1c3RcbiAgICBhd2FpdCB0aGlzLmRldGVjdFJ1c3RQcm9qZWN0KHJlcG9Sb290LCByZXN1bHQpO1xuICAgIFxuICAgIC8vIEphdmFcbiAgICBhd2FpdCB0aGlzLmRldGVjdEphdmFQcm9qZWN0KHJlcG9Sb290LCByZXN1bHQpO1xuICAgIFxuICAgIC8vIFJ1YnlcbiAgICBhd2FpdCB0aGlzLmRldGVjdFJ1YnlQcm9qZWN0KHJlcG9Sb290LCByZXN1bHQpO1xuICAgIFxuICAgIC8vIFBIUFxuICAgIGF3YWl0IHRoaXMuZGV0ZWN0UGhwUHJvamVjdChyZXBvUm9vdCwgcmVzdWx0KTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOajgOa1iyBHbyDpobnnm65cbiAgICovXG4gIHByaXZhdGUgYXN5bmMgZGV0ZWN0R29Qcm9qZWN0KHJlcG9Sb290OiBzdHJpbmcsIHJlc3VsdDogRGV0ZWN0aW9uUmVzdWx0KTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgZ29Nb2RQYXRoID0gcGF0aC5qb2luKHJlcG9Sb290LCAnZ28ubW9kJyk7XG4gICAgXG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IGZzLmFjY2Vzcyhnb01vZFBhdGgpO1xuICAgICAgcmVzdWx0Lmxhbmd1YWdlcy5hZGQoJ0dvJyk7XG4gICAgICB0aGlzLmFkZEV2aWRlbmNlKHJlc3VsdCwgJ2dvX21vZCcsICdnby5tb2QnLCAnZ28ubW9kIGZvdW5kJywgMS4wKTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIC8vIGdvLm1vZCDkuI3lrZjlnKhcbiAgICB9XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDmo4DmtYsgUnVzdCDpobnnm65cbiAgICovXG4gIHByaXZhdGUgYXN5bmMgZGV0ZWN0UnVzdFByb2plY3QocmVwb1Jvb3Q6IHN0cmluZywgcmVzdWx0OiBEZXRlY3Rpb25SZXN1bHQpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCBjYXJnb1RvbWxQYXRoID0gcGF0aC5qb2luKHJlcG9Sb290LCAnQ2FyZ28udG9tbCcpO1xuICAgIFxuICAgIHRyeSB7XG4gICAgICBhd2FpdCBmcy5hY2Nlc3MoY2FyZ29Ub21sUGF0aCk7XG4gICAgICByZXN1bHQubGFuZ3VhZ2VzLmFkZCgnUnVzdCcpO1xuICAgICAgcmVzdWx0LmJ1aWxkU3lzdGVtcy5hZGQoJ0NhcmdvJyk7XG4gICAgICB0aGlzLmFkZEV2aWRlbmNlKHJlc3VsdCwgJ2NhcmdvX3RvbWwnLCAnQ2FyZ28udG9tbCcsICdDYXJnby50b21sIGZvdW5kJywgMS4wKTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIC8vIENhcmdvLnRvbWwg5LiN5a2Y5ZyoXG4gICAgfVxuICB9XG4gIFxuICAvKipcbiAgICog5qOA5rWLIEphdmEg6aG555uuXG4gICAqL1xuICBwcml2YXRlIGFzeW5jIGRldGVjdEphdmFQcm9qZWN0KHJlcG9Sb290OiBzdHJpbmcsIHJlc3VsdDogRGV0ZWN0aW9uUmVzdWx0KTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgcG9tWG1sUGF0aCA9IHBhdGguam9pbihyZXBvUm9vdCwgJ3BvbS54bWwnKTtcbiAgICBjb25zdCBidWlsZEdyYWRsZVBhdGggPSBwYXRoLmpvaW4ocmVwb1Jvb3QsICdidWlsZC5ncmFkbGUnKTtcbiAgICBcbiAgICB0cnkge1xuICAgICAgYXdhaXQgZnMuYWNjZXNzKHBvbVhtbFBhdGgpO1xuICAgICAgcmVzdWx0Lmxhbmd1YWdlcy5hZGQoJ0phdmEnKTtcbiAgICAgIHJlc3VsdC5idWlsZFN5c3RlbXMuYWRkKCdNYXZlbicpO1xuICAgICAgdGhpcy5hZGRFdmlkZW5jZShyZXN1bHQsICdmaWxlX3BhdHRlcm4nLCAncG9tLnhtbCcsICdwb20ueG1sIGZvdW5kJywgMS4wKTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIC8vIHBvbS54bWwg5LiN5a2Y5ZyoXG4gICAgfVxuICAgIFxuICAgIHRyeSB7XG4gICAgICBhd2FpdCBmcy5hY2Nlc3MoYnVpbGRHcmFkbGVQYXRoKTtcbiAgICAgIHJlc3VsdC5sYW5ndWFnZXMuYWRkKCdKYXZhJyk7XG4gICAgICByZXN1bHQuYnVpbGRTeXN0ZW1zLmFkZCgnR3JhZGxlJyk7XG4gICAgICB0aGlzLmFkZEV2aWRlbmNlKHJlc3VsdCwgJ2ZpbGVfcGF0dGVybicsICdidWlsZC5ncmFkbGUnLCAnYnVpbGQuZ3JhZGxlIGZvdW5kJywgMS4wKTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIC8vIGJ1aWxkLmdyYWRsZSDkuI3lrZjlnKhcbiAgICB9XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDmo4DmtYsgUnVieSDpobnnm65cbiAgICovXG4gIHByaXZhdGUgYXN5bmMgZGV0ZWN0UnVieVByb2plY3QocmVwb1Jvb3Q6IHN0cmluZywgcmVzdWx0OiBEZXRlY3Rpb25SZXN1bHQpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCBnZW1maWxlUGF0aCA9IHBhdGguam9pbihyZXBvUm9vdCwgJ0dlbWZpbGUnKTtcbiAgICBcbiAgICB0cnkge1xuICAgICAgYXdhaXQgZnMuYWNjZXNzKGdlbWZpbGVQYXRoKTtcbiAgICAgIHJlc3VsdC5sYW5ndWFnZXMuYWRkKCdSdWJ5Jyk7XG4gICAgICByZXN1bHQucGFja2FnZU1hbmFnZXJzLmFkZCgnYnVuZGxlcicpO1xuICAgICAgdGhpcy5hZGRFdmlkZW5jZShyZXN1bHQsICdnZW1maWxlJywgJ0dlbWZpbGUnLCAnR2VtZmlsZSBmb3VuZCcsIDEuMCk7XG4gICAgICBcbiAgICAgIC8vIOajgOa1iyBSYWlsc1xuICAgICAgY29uc3QgZ2VtZmlsZUNvbnRlbnQgPSBhd2FpdCBmcy5yZWFkRmlsZShnZW1maWxlUGF0aCwgJ3V0Zi04Jyk7XG4gICAgICBpZiAoZ2VtZmlsZUNvbnRlbnQuaW5jbHVkZXMoXCJnZW0gJ3JhaWxzJ1wiKSkge1xuICAgICAgICByZXN1bHQuZnJhbWV3b3Jrcy5hZGQoJ1JhaWxzJyk7XG4gICAgICAgIHRoaXMuYWRkRXZpZGVuY2UocmVzdWx0LCAnZ2VtZmlsZScsICdHZW1maWxlJywgJ1JhaWxzIGdlbSBmb3VuZCcsIDAuOSk7XG4gICAgICB9XG4gICAgfSBjYXRjaCB7XG4gICAgICAvLyBHZW1maWxlIOS4jeWtmOWcqFxuICAgIH1cbiAgfVxuICBcbiAgLyoqXG4gICAqIOajgOa1iyBQSFAg6aG555uuXG4gICAqL1xuICBwcml2YXRlIGFzeW5jIGRldGVjdFBocFByb2plY3QocmVwb1Jvb3Q6IHN0cmluZywgcmVzdWx0OiBEZXRlY3Rpb25SZXN1bHQpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCBjb21wb3Nlckpzb25QYXRoID0gcGF0aC5qb2luKHJlcG9Sb290LCAnY29tcG9zZXIuanNvbicpO1xuICAgIFxuICAgIHRyeSB7XG4gICAgICBhd2FpdCBmcy5hY2Nlc3MoY29tcG9zZXJKc29uUGF0aCk7XG4gICAgICByZXN1bHQubGFuZ3VhZ2VzLmFkZCgnUEhQJyk7XG4gICAgICByZXN1bHQucGFja2FnZU1hbmFnZXJzLmFkZCgnY29tcG9zZXInKTtcbiAgICAgIHRoaXMuYWRkRXZpZGVuY2UocmVzdWx0LCAnY29tcG9zZXJfanNvbicsICdjb21wb3Nlci5qc29uJywgJ2NvbXBvc2VyLmpzb24gZm91bmQnLCAxLjApO1xuICAgICAgXG4gICAgICAvLyDmo4DmtYsgTGFyYXZlbFxuICAgICAgY29uc3QgY29tcG9zZXJKc29uQ29udGVudCA9IGF3YWl0IGZzLnJlYWRGaWxlKGNvbXBvc2VySnNvblBhdGgsICd1dGYtOCcpO1xuICAgICAgaWYgKGNvbXBvc2VySnNvbkNvbnRlbnQuaW5jbHVkZXMoJ2xhcmF2ZWwnKSkge1xuICAgICAgICByZXN1bHQuZnJhbWV3b3Jrcy5hZGQoJ0xhcmF2ZWwnKTtcbiAgICAgICAgdGhpcy5hZGRFdmlkZW5jZShyZXN1bHQsICdjb21wb3Nlcl9qc29uJywgJ2NvbXBvc2VyLmpzb24nLCAnTGFyYXZlbCBkZXBlbmRlbmN5IGZvdW5kJywgMC45KTtcbiAgICAgIH1cbiAgICB9IGNhdGNoIHtcbiAgICAgIC8vIGNvbXBvc2VyLmpzb24g5LiN5a2Y5ZyoXG4gICAgfVxuICB9XG4gIFxuICAvKipcbiAgICog5re75Yqg6K+B5o2uXG4gICAqL1xuICBwcml2YXRlIGFkZEV2aWRlbmNlKFxuICAgIHJlc3VsdDogRGV0ZWN0aW9uUmVzdWx0LFxuICAgIHR5cGU6IEV2aWRlbmNlVHlwZSxcbiAgICBzb3VyY2U6IHN0cmluZyxcbiAgICBjb250ZW50OiBzdHJpbmcsXG4gICAgY29uZmlkZW5jZTogbnVtYmVyXG4gICk6IHZvaWQge1xuICAgIGlmICghdGhpcy5jb25maWcuaW5jbHVkZUV2aWRlbmNlKSByZXR1cm47XG4gICAgXG4gICAgcmVzdWx0LmV2aWRlbmNlLnB1c2goe1xuICAgICAgdHlwZSxcbiAgICAgIHNvdXJjZSxcbiAgICAgIGNvbnRlbnQsXG4gICAgICBjb25maWRlbmNlLFxuICAgICAgZGV0ZWN0ZWRBdDogRGF0ZS5ub3coKSxcbiAgICB9KTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOaehOW7uiBSZXBvUHJvZmlsZVxuICAgKi9cbiAgcHJpdmF0ZSBidWlsZFByb2ZpbGUocmVwb1Jvb3Q6IHN0cmluZywgcmVzdWx0OiBEZXRlY3Rpb25SZXN1bHQpOiBSZXBvUHJvZmlsZSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHJlcG9Sb290LFxuICAgICAgbGFuZ3VhZ2VzOiBBcnJheS5mcm9tKHJlc3VsdC5sYW5ndWFnZXMpLFxuICAgICAgZnJhbWV3b3JrczogQXJyYXkuZnJvbShyZXN1bHQuZnJhbWV3b3JrcyksXG4gICAgICBwYWNrYWdlTWFuYWdlcnM6IEFycmF5LmZyb20ocmVzdWx0LnBhY2thZ2VNYW5hZ2VycyksXG4gICAgICBidWlsZFN5c3RlbXM6IEFycmF5LmZyb20ocmVzdWx0LmJ1aWxkU3lzdGVtcyksXG4gICAgICB0ZXN0RnJhbWV3b3JrczogQXJyYXkuZnJvbShyZXN1bHQudGVzdEZyYW1ld29ya3MpLFxuICAgICAgZW50cnlwb2ludHM6IFtdLCAvLyDnlLEgZW50cnlwb2ludF9kaXNjb3Zlcnkg5aGr5YWFXG4gICAgICBpbXBvcnRhbnRQYXRoczoge1xuICAgICAgICBhcHA6IFtdLFxuICAgICAgICBsaWI6IFtdLFxuICAgICAgICB0ZXN0czogW10sXG4gICAgICAgIGluZnJhOiBbXSxcbiAgICAgICAgc2NyaXB0czogW10sXG4gICAgICAgIGRvY3M6IFtdLFxuICAgICAgICBjb25maWdzOiBbXSxcbiAgICAgIH0sIC8vIOeUsSBtb2R1bGVfY2xhc3NpZmllciDloavlhYVcbiAgICAgIGV2aWRlbmNlOiByZXN1bHQuZXZpZGVuY2UsXG4gICAgICBkZXRlY3RlZEF0OiBEYXRlLm5vdygpLFxuICAgIH07XG4gIH1cbn1cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8g6L6F5Yqp5Ye95pWwXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog5qOA5rWL5piv5ZCm5pyJIFZpdGUgZGV2IGRlcGVuZGVuY3lcbiAqL1xuZnVuY3Rpb24gZGV2SGFzVml0ZShwYWNrYWdlSnNvbjogYW55KTogYm9vbGVhbiB7XG4gIHJldHVybiBwYWNrYWdlSnNvbi5kZXZEZXBlbmRlbmNpZXM/LnZpdGUgIT09IHVuZGVmaW5lZDtcbn1cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8g5L6/5o235Ye95pWwXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog5Yib5bu66aG555uu5qOA5rWL5ZmoXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVQcm9qZWN0RGV0ZWN0b3IoY29uZmlnPzogRGV0ZWN0b3JDb25maWcpOiBQcm9qZWN0RGV0ZWN0b3Ige1xuICByZXR1cm4gbmV3IFByb2plY3REZXRlY3Rvcihjb25maWcpO1xufVxuXG4vKipcbiAqIOW/q+mAn+ajgOa1i+mhueebrlxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZGV0ZWN0UHJvamVjdChcbiAgcmVwb1Jvb3Q6IHN0cmluZyxcbiAgY29uZmlnPzogRGV0ZWN0b3JDb25maWdcbik6IFByb21pc2U8UmVwb1Byb2ZpbGU+IHtcbiAgY29uc3QgZGV0ZWN0b3IgPSBuZXcgUHJvamVjdERldGVjdG9yKGNvbmZpZyk7XG4gIHJldHVybiBhd2FpdCBkZXRlY3Rvci5kZXRlY3QocmVwb1Jvb3QpO1xufVxuIl19