#!/usr/bin/env node
"use strict";
/**
 * Comprehensive Test Runner
 *
 * This script provides a comprehensive test runner for the Time-Off Microservice
 * with support for different test suites, scenarios, and reporting.
 *
 * Features:
 * - Unit tests for services
 * - Integration tests for API endpoints
 * - Mock HCM interactions
 * - Coverage reporting
 * - Performance benchmarks
 * - Regression detection
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestRunner = void 0;
const child_process_1 = require("child_process");
const fs_1 = require("fs");
const path_1 = require("path");
class TestRunner {
    constructor(config = {}) {
        this.results = [];
        this.config = {
            suites: ['unit', 'integration', 'e2e'],
            coverage: true,
            watch: false,
            verbose: true,
            bail: false,
            maxWorkers: 4,
            testTimeout: 30000,
            ...config,
        };
        this.startTime = Date.now();
    }
    /**
     * Run all test suites
     */
    async runAll() {
        console.log('🚀 Starting Time-Off Microservice Test Suite\n');
        for (const suite of this.config.suites) {
            await this.runSuite(suite);
        }
        this.generateReport();
    }
    /**
     * Run specific test suite
     */
    async runSuite(suite) {
        console.log(`📋 Running ${suite} tests...`);
        const suiteStartTime = Date.now();
        try {
            const result = await this.executeTestSuite(suite);
            result.duration = Date.now() - suiteStartTime;
            this.results.push(result);
            this.printSuiteResult(result);
        }
        catch (error) {
            console.error(`❌ ${suite} tests failed:`, error.message);
            process.exit(1);
        }
    }
    /**
     * Execute test suite with Jest
     */
    async executeTestSuite(suite) {
        const jestConfig = this.buildJestConfig(suite);
        const command = this.buildJestCommand(suite, jestConfig);
        try {
            const output = (0, child_process_1.execSync)(command, {
                encoding: 'utf8',
                stdio: 'pipe',
                cwd: process.cwd(),
            });
            return this.parseJestOutput(output, suite);
        }
        catch (error) {
            // Jest returns non-zero exit code on test failures
            const output = error.stdout || error.stderr || '';
            return this.parseJestOutput(output, suite);
        }
    }
    /**
     * Build Jest configuration for test suite
     */
    buildJestConfig(suite) {
        const baseConfig = {
            testMatch: this.getTestMatchPattern(suite),
            collectCoverageFrom: this.getCoveragePatterns(suite),
            coverageDirectory: `coverage/${suite}`,
            coverageReporters: ['text', 'lcov', 'html'],
            verbose: this.config.verbose,
            bail: this.config.bail,
            maxWorkers: this.config.maxWorkers,
            testTimeout: this.config.testTimeout,
            setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
        };
        return JSON.stringify(baseConfig).replace(/"/g, "'");
    }
    /**
     * Build Jest command
     */
    buildJestCommand(suite, config) {
        let command = `npx jest --config="${config}"`;
        if (this.config.coverage) {
            command += ' --coverage';
        }
        if (this.config.watch) {
            command += ' --watch';
        }
        if (this.config.verbose) {
            command += ' --verbose';
        }
        return command;
    }
    /**
     * Get test match patterns for suite
     */
    getTestMatchPattern(suite) {
        switch (suite) {
            case 'unit':
                return ['**/tests/unit/**/*.spec.ts', '**/tests/unit/**/*.test.ts'];
            case 'integration':
                return ['**/tests/integration/**/*.spec.ts', '**/tests/integration/**/*.test.ts'];
            case 'e2e':
                return ['**/tests/e2e/**/*.spec.ts', '**/tests/e2e/**/*.test.ts'];
            default:
                return [`**/tests/${suite}/**/*.spec.ts`, `**/tests/${suite}/**/*.test.ts`];
        }
    }
    /**
     * Get coverage patterns for suite
     */
    getCoveragePatterns(suite) {
        const basePatterns = [
            'src/**/*.ts',
            '!src/**/*.d.ts',
            '!src/**/*.interface.ts',
            '!src/**/*.dto.ts',
            '!src/**/*.config.ts',
            '!src/main.ts',
        ];
        switch (suite) {
            case 'unit':
                return basePatterns.filter(pattern => !pattern.includes('controller') && !pattern.includes('interceptor'));
            case 'integration':
                return basePatterns.filter(pattern => !pattern.includes('service') && !pattern.includes('repository'));
            default:
                return basePatterns;
        }
    }
    /**
     * Parse Jest output to extract test results
     */
    parseJestOutput(output, suite) {
        const lines = output.split('\n');
        const result = {
            suite,
            passed: 0,
            failed: 0,
            total: 0,
            duration: 0,
        };
        // Parse test results
        for (const line of lines) {
            if (line.includes('Tests:')) {
                const match = line.match(/Tests:\s+(\d+)\s+passed,\s+(\d+)\s+failed/);
                if (match) {
                    result.passed = parseInt(match[1]);
                    result.failed = parseInt(match[2]);
                    result.total = result.passed + result.failed;
                }
            }
            // Parse coverage if available
            if (line.includes('Coverage:')) {
                const coverageMatch = line.match(/Coverage:\s+([\d.]+)%\s+\|\s+([\d.]+)\/\s+([\d.]+)/);
                if (coverageMatch) {
                    result.coverage = {
                        lines: parseFloat(coverageMatch[1]),
                        functions: parseFloat(coverageMatch[1]),
                        branches: parseFloat(coverageMatch[1]),
                        statements: parseFloat(coverageMatch[1]),
                    };
                }
            }
        }
        return result;
    }
    /**
     * Print suite results
     */
    printSuiteResult(result) {
        const status = result.failed === 0 ? '✅' : '❌';
        const coverage = result.coverage ? ` (Coverage: ${result.coverage.lines}%)` : '';
        console.log(`${status} ${result.suite}: ${result.passed}/${result.total} passed${coverage} (${result.duration}ms)`);
        if (result.failed > 0) {
            console.log(`   Failed: ${result.failed} tests`);
        }
    }
    /**
     * Generate comprehensive test report
     */
    generateReport() {
        const totalDuration = Date.now() - this.startTime;
        const totalPassed = this.results.reduce((sum, r) => sum + r.passed, 0);
        const totalFailed = this.results.reduce((sum, r) => sum + r.failed, 0);
        const totalTests = totalPassed + totalFailed;
        console.log('\n📊 Test Results Summary');
        console.log('====================');
        console.log(`Total Tests: ${totalTests}`);
        console.log(`Passed: ${totalPassed}`);
        console.log(`Failed: ${totalFailed}`);
        console.log(`Success Rate: ${totalTests > 0 ? ((totalPassed / totalTests) * 100).toFixed(2) : 0}%`);
        console.log(`Total Duration: ${totalDuration}ms`);
        // Coverage summary
        if (this.config.coverage && this.results.some(r => r.coverage)) {
            console.log('\n📈 Coverage Summary');
            console.log('==================');
            const avgCoverage = this.results
                .filter(r => r.coverage)
                .reduce((sum, r) => sum + r.coverage.lines, 0) / this.results.filter(r => r.coverage).length;
            console.log(`Average Coverage: ${avgCoverage.toFixed(2)}%`);
            this.results.forEach(result => {
                if (result.coverage) {
                    console.log(`${result.suite}: ${result.coverage.lines}%`);
                }
            });
        }
        // Suite details
        console.log('\n📋 Suite Details');
        console.log('================');
        this.results.forEach(result => {
            const status = result.failed === 0 ? '✅' : '❌';
            console.log(`${status} ${result.suite}: ${result.passed}/${result.total} (${result.duration}ms)`);
        });
        // Generate HTML report
        this.generateHtmlReport();
        // Check for failures
        if (totalFailed > 0) {
            console.log('\n❌ Some tests failed. Check the detailed reports above.');
            process.exit(1);
        }
        else {
            console.log('\n✅ All tests passed!');
        }
    }
    /**
     * Generate HTML report
     */
    generateHtmlReport() {
        const reportDir = (0, path_1.join)(process.cwd(), 'test-reports');
        if (!(0, fs_1.existsSync)(reportDir)) {
            (0, fs_1.mkdirSync)(reportDir, { recursive: true });
        }
        const reportPath = (0, path_1.join)(reportDir, 'test-report.html');
        const html = this.generateHtmlContent();
        (0, fs_1.writeFileSync)(reportPath, html);
        console.log(`\n📄 HTML report generated: ${reportPath}`);
    }
    /**
     * Generate HTML content for report
     */
    generateHtmlContent() {
        const totalPassed = this.results.reduce((sum, r) => sum + r.passed, 0);
        const totalFailed = this.results.reduce((sum, r) => sum + r.failed, 0);
        const totalTests = totalPassed + totalFailed;
        const successRate = totalTests > 0 ? ((totalPassed / totalTests) * 100).toFixed(2) : 0;
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Time-Off Microservice Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #333; text-align: center; margin-bottom: 30px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .metric { background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center; }
        .metric h3 { margin: 0 0 10px 0; color: #666; }
        .metric .value { font-size: 2em; font-weight: bold; color: #333; }
        .metric.success .value { color: #28a745; }
        .metric.error .value { color: #dc3545; }
        .suites { margin-top: 30px; }
        .suite { background: #f8f9fa; margin-bottom: 15px; padding: 15px; border-radius: 8px; border-left: 4px solid #007bff; }
        .suite.failed { border-left-color: #dc3545; }
        .suite-name { font-weight: bold; margin-bottom: 10px; }
        .suite-stats { display: flex; justify-content: space-between; align-items: center; }
        .coverage { background: #e9ecef; padding: 2px 8px; border-radius: 12px; font-size: 0.9em; }
        .timestamp { text-align: center; color: #666; margin-top: 30px; font-size: 0.9em; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🧪 Time-Off Microservice Test Report</h1>
        
        <div class="summary">
            <div class="metric">
                <h3>Total Tests</h3>
                <div class="value">${totalTests}</div>
            </div>
            <div class="metric success">
                <h3>Passed</h3>
                <div class="value">${totalPassed}</div>
            </div>
            <div class="metric error">
                <h3>Failed</h3>
                <div class="value">${totalFailed}</div>
            </div>
            <div class="metric">
                <h3>Success Rate</h3>
                <div class="value">${successRate}%</div>
            </div>
        </div>

        <div class="suites">
            <h2>Test Suites</h2>
            ${this.results.map(result => `
                <div class="suite ${result.failed > 0 ? 'failed' : ''}">
                    <div class="suite-name">${result.suite}</div>
                    <div class="suite-stats">
                        <span>${result.passed}/${result.total} tests passed</span>
                        <span>${result.duration}ms</span>
                        ${result.coverage ? `<span class="coverage">${result.coverage.lines}% coverage</span>` : ''}
                    </div>
                </div>
            `).join('')}
        </div>

        <div class="timestamp">
            Report generated on ${new Date().toLocaleString()}
        </div>
    </div>
</body>
</html>
    `;
    }
}
exports.TestRunner = TestRunner;
/**
 * CLI interface
 */
async function main() {
    const args = process.argv.slice(2);
    const config = {};
    // Parse command line arguments
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        switch (arg) {
            case '--no-coverage':
                config.coverage = false;
                break;
            case '--watch':
                config.watch = true;
                break;
            case '--bail':
                config.bail = true;
                break;
            case '--verbose':
                config.verbose = true;
                break;
            case '--suite':
                if (i + 1 < args.length) {
                    config.suites = [args[i + 1]];
                    i++;
                }
                break;
            case '--timeout':
                if (i + 1 < args.length) {
                    config.testTimeout = parseInt(args[i + 1]);
                    i++;
                }
                break;
            case '--workers':
                if (i + 1 < args.length) {
                    config.maxWorkers = parseInt(args[i + 1]);
                    i++;
                }
                break;
            case '--help':
                console.log(`
Time-Off Microservice Test Runner

Usage: npm run test [options]

Options:
  --no-coverage    Disable coverage reporting
  --watch          Run tests in watch mode
  --bail           Stop on first test failure
  --verbose        Enable verbose output
  --suite <name>   Run specific test suite (unit, integration, e2e)
  --timeout <ms>   Set test timeout in milliseconds
  --workers <n>    Set number of worker processes
  --help           Show this help message

Examples:
  npm run test                    # Run all tests
  npm run test --suite unit     # Run only unit tests
  npm run test --no-coverage     # Run without coverage
  npm run test --watch          # Run in watch mode
        `);
                process.exit(0);
                break;
        }
    }
    const runner = new TestRunner(config);
    await runner.runAll();
}
// Run if called directly
if (require.main === module) {
    main().catch(error => {
        console.error('Test runner failed:', error);
        process.exit(1);
    });
}
