/**
 * R-AUD-4 发送端边界锁（静态回归门禁）。
 *
 * V0.1 用户路径（popup / content）永远不得发起五类审计消息，也不得经策略 facade
 * 调用冻结审计动作。本测试以静态源码扫描作为回归门禁——一旦有人在 popup 或 content
 * 脚本中新增任何审计消息类型或审计 facade 调用，测试立即失败。
 *
 * 这是真实边界证据：结合 E2E「残留 auditPlan 不被恢复」与「首测后 auditMarkers 为空」，
 * 共同证明 V0.1 用户路径已与审计流程解耦（R-AUD-4）。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

// vitest 从项目根目录运行，cwd 即仓库根。
const ROOT = process.cwd();

/** 五类审计消息类型（worker 冻结处理器对应的出站消息） */
const AUDIT_MESSAGE_TYPES = [
  'FREEZE_AUDIT_PLAN',
  'AUDIT_ANSWER',
  'GET_AUDIT_MARKERS',
  'GET_AUDIT_PLAN',
  'CLEAR_AUDIT_PLAN',
] as const;

/** popup 额外不得经 facade 触发的审计动作与入口函数 */
const POPUP_LOCKED = [...AUDIT_MESSAGE_TYPES, 'freezeAuditPlan', 'settleAuditAnswer', 'startAudit'] as const;

function readSrc(relPath: string): string {
  return readFileSync(path.join(ROOT, relPath), 'utf8');
}

describe('R-AUD-4：popup 不发起/不调用审计流程', () => {
  const src = readSrc('extension/src/popup.ts');
  for (const token of POPUP_LOCKED) {
    it(`popup.ts 不得包含 ${token}`, () => {
      expect(src).not.toContain(token);
    });
  }
});

describe('R-AUD-4：content 脚本不发起审计消息', () => {
  const contentDir = path.join(ROOT, 'extension/src/content');
  const contentSrcFiles = readdirSync(contentDir).filter(
    (f) => f.endsWith('.ts') && !f.endsWith('.test.ts'),
  );
  for (const file of contentSrcFiles) {
    const src = readFileSync(path.join(contentDir, file), 'utf8');
    for (const token of AUDIT_MESSAGE_TYPES) {
      it(`content/${file} 不得包含审计消息 ${token}`, () => {
        expect(src).not.toContain(token);
      });
    }
  }
});
