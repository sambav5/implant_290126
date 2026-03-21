import type { FullConfig, FullResult, Reporter, Suite, TestCase, TestResult } from '@playwright/test/reporter';

class ExecutionSummaryReporter implements Reporter {
  private total = 0;
  private passed = 0;
  private failed = 0;

  onBegin(_: FullConfig, suite: Suite): void {
    this.total = suite.allTests().length;
  }

  onTestEnd(_: TestCase, result: TestResult): void {
    if (result.status === 'passed') {
      this.passed += 1;
      return;
    }

    if (['failed', 'timedOut', 'interrupted'].includes(result.status)) {
      this.failed += 1;
    }
  }

  onEnd(result: FullResult): void {
    const durationSeconds = (result.duration / 1000).toFixed(2);
    console.log('\n=== Playwright Execution Summary ===');
    console.log(`Total tests: ${this.total}`);
    console.log(`Passed: ${this.passed}`);
    console.log(`Failed: ${this.failed}`);
    console.log(`Execution time: ${durationSeconds}s`);
  }
}

export default ExecutionSummaryReporter;
