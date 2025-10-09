import { useEffect, useMemo, useState } from 'react';

export interface TestContext {
  assert(condition: unknown, message?: string): void;
  log(message: string): void;
}

export interface PageTestCase {
  name: string;
  run: (context: TestContext) => Promise<void> | void;
  skip?: boolean;
}

interface TestLogEntry {
  message: string;
  type: 'info' | 'assertion';
  passed?: boolean;
}

interface TestResult {
  name: string;
  status: 'passed' | 'failed' | 'skipped';
  durationMs: number;
  logs: TestLogEntry[];
  error?: string;
}

interface PageTestHarnessProps {
  pageName: string;
  tests: PageTestCase[];
  autoRun?: boolean;
}

const formatTimestamp = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}-${String(date.getMinutes()).padStart(2, '0')}-${String(date.getSeconds()).padStart(2, '0')}`;

const createReport = (pageName: string, executedAt: Date, results: TestResult[]) => {
  const lines: string[] = [];
  lines.push(`Page Test Report: ${pageName}`);
  lines.push(`Executed at: ${executedAt.toISOString()}`);
  lines.push('');
  results.forEach((result, index) => {
    lines.push(`${index + 1}. ${result.name}`);
    lines.push(`   Status   : ${result.status.toUpperCase()}`);
    lines.push(`   Duration : ${result.durationMs.toFixed(2)}ms`);
    if (result.status === 'failed' && result.error) {
      lines.push(`   Error    : ${result.error}`);
    }
    if (result.logs.length) {
      lines.push('   Logs:');
      result.logs.forEach((log) => {
        const prefix = log.type === 'assertion' ? (log.passed ? '✔' : '✖') : '-';
        lines.push(`     ${prefix} ${log.message}`);
      });
    }
    lines.push('');
  });
  const passed = results.filter((r) => r.status === 'passed').length;
  const failed = results.filter((r) => r.status === 'failed').length;
  const skipped = results.filter((r) => r.status === 'skipped').length;
  lines.push(`Summary: passed=${passed}, failed=${failed}, skipped=${skipped}`);
  return lines.join('\n');
};

const storeReport = (pageName: string, executedAt: Date, results: TestResult[]) => {
  if (typeof window === 'undefined' || !('localStorage' in window)) return;
  try {
    const key = `qa-app:page-tests:${pageName}:${executedAt.toISOString()}`;
    window.localStorage.setItem(
      key,
      JSON.stringify({ pageName, executedAt: executedAt.toISOString(), results })
    );
  } catch {
    // ignore storage failures (quota, private mode, etc.)
  }
};

const downloadReport = (pageName: string, executedAt: Date, results: TestResult[]) => {
  const report = createReport(pageName, executedAt, results);
  const blob = new Blob([report], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${pageName}-page-tests-${formatTimestamp(executedAt)}.log`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
};

export const PageTestHarness: React.FC<PageTestHarnessProps> = ({ pageName, tests, autoRun = true }) => {
  const [results, setResults] = useState<TestResult[] | null>(null);
  const [executedAt, setExecutedAt] = useState<Date | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const runnableTests = useMemo(() => tests.filter((test) => !test.skip), [tests]);

  useEffect(() => {
    if (!autoRun || isRunning || results || runnableTests.length === 0) return;
    let cancelled = false;
    const run = async () => {
      setIsRunning(true);
      const startedAt = new Date();
      const runResults: TestResult[] = [];
      for (const test of runnableTests) {
        const logs: TestLogEntry[] = [];
        const context: TestContext = {
          assert(condition, message) {
            const passed = Boolean(condition);
            logs.push({
              type: 'assertion',
              message: message || 'Assertion',
              passed
            });
            if (!passed) {
              throw new Error(message || 'Assertion failed');
            }
          },
          log(message) {
            logs.push({ type: 'info', message });
          }
        };
        const testStart = performance.now();
        try {
          await Promise.resolve(test.run(context));
          const duration = performance.now() - testStart;
          runResults.push({
            name: test.name,
            status: 'passed',
            durationMs: duration,
            logs
          });
        } catch (error) {
          const duration = performance.now() - testStart;
          const errorMessage = error instanceof Error ? error.message : String(error);
          runResults.push({
            name: test.name,
            status: 'failed',
            durationMs: duration,
            logs,
            error: errorMessage
          });
        }
      }
      if (!cancelled) {
        setResults(runResults);
        setExecutedAt(startedAt);
        storeReport(pageName, startedAt, runResults);
        console.group(`[Page Tests] ${pageName}`);
        runResults.forEach((result) => {
          const label = `${result.status.toUpperCase()} - ${result.name}`;
          if (result.status === 'passed') {
            console.info(label, `${result.durationMs.toFixed(1)}ms`);
          } else {
            console.error(label, result.error ?? 'No message', `${result.durationMs.toFixed(1)}ms`);
          }
          result.logs.forEach((log) => {
            if (log.type === 'assertion') {
              const prefix = log.passed ? '✔' : '✖';
              console.info(`  ${prefix} ${log.message}`);
            } else {
              console.log(`  - ${log.message}`);
            }
          });
        });
        console.groupEnd();
      }
      setIsRunning(false);
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [autoRun, isRunning, results, runnableTests, pageName]);

  if (!autoRun || runnableTests.length === 0) return null;

  const passed = results?.filter((result) => result.status === 'passed').length ?? 0;
  const failed = results?.filter((result) => result.status === 'failed').length ?? 0;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 16,
        right: 16,
        zIndex: 9999,
        padding: '12px 16px',
        borderRadius: 12,
        background: 'rgba(15, 23, 42, 0.92)',
        color: '#e2e8f0',
        boxShadow: '0 20px 45px rgba(15, 23, 42, 0.45)',
        maxWidth: 320,
        fontSize: 12,
        fontFamily: 'Inter, system-ui, sans-serif'
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 8 }}>Page Test Harness · {pageName}</div>
      {isRunning && <div>Running {runnableTests.length} tests…</div>}
      {!isRunning && results && (
        <>
          <div style={{ marginBottom: 8 }}>
            <span style={{ color: '#34d399', fontWeight: 600 }}>{passed}</span> passed ·{' '}
            <span style={{ color: failed ? '#f87171' : '#60a5fa', fontWeight: 600 }}>{failed}</span> failed
          </div>
          <button
            type="button"
            onClick={() => executedAt && results && downloadReport(pageName, executedAt, results)}
            style={{
              padding: '6px 10px',
              borderRadius: 8,
              border: '1px solid rgba(148, 163, 184, 0.45)',
              background: 'rgba(30, 41, 59, 0.8)',
              color: '#e2e8f0',
              cursor: 'pointer'
            }}
          >
            Download latest log
          </button>
        </>
      )}
    </div>
  );
};

export default PageTestHarness;
