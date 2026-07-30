import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const workerDir = dirname(fileURLToPath(import.meta.url));

// 策略 seam 闭合（Issue #4）：worker 生产代码只能经 `strategy/index.ts` 公共 facade
// 与 `shared/*` 共享模块消费，不得直接 import 策略内部实现 `strategy/quiz` 或
// `strategy/audit`（否则会绕过深 Module Interface 或在 worker 中重算领域逻辑）。
// 本测试静态扫描 worker 目录下所有非测试 .ts 源文件的 import 语句。
const FORBIDDEN_FRAGMENTS = ['strategy/quiz', 'strategy/audit'];

describe('策略 seam 导入边界（worker 生产代码）', () => {
  const entries = readdirSync(workerDir).filter(
    (f) => f.endsWith('.ts') && !f.endsWith('.test.ts') && !f.endsWith('.d.ts'),
  );

  it('worker 目录下存在生产源文件', () => {
    expect(entries.length).toBeGreaterThan(0);
  });

  for (const f of entries) {
    it(`${f} 不得直接 import 策略内部模块 strategy/quiz 或 strategy/audit`, () => {
      const src = readFileSync(join(workerDir, f), 'utf-8');
      let lineNo = 0;
      for (const line of src.split('\n')) {
        lineNo++;
        const m = line.match(/from\s+['"]([^'"]+)['"]/);
        if (!m) continue;
        const spec = m[1]!;
        for (const frag of FORBIDDEN_FRAGMENTS) {
          if (spec.includes(frag)) {
            throw new Error(`${f}:${lineNo} 非法导入策略内部模块: ${spec}（应经 strategy/index 或 shared/*）`);
          }
        }
      }
    });
  }

  // 反向确认：允许经 facade 与 shared 模块消费
  it('worker 可经 strategy/index 与 shared/auditPlanVersion 消费', () => {
    const indexSrc = readFileSync(join(workerDir, 'index.ts'), 'utf-8');
    expect(indexSrc).toContain("from '../strategy/index'");
    const valSrc = readFileSync(join(workerDir, 'auditValidation.ts'), 'utf-8');
    expect(valSrc).toContain("from '../shared/auditPlanVersion'");
    expect(valSrc).not.toContain("from '../strategy/audit'");
  });
});
