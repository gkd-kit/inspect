import type { Position } from '@gkd-kit/api';
import dayjs from 'dayjs';
import JSON5 from 'json5';

export type RuleOutputDepth = 'rule' | 'group' | 'app' | 'ts';
export type RulePositionMode = 'node-relative' | 'node-pixel' | 'screen';

export interface RuleComposerOptions {
  outputDepth: RuleOutputDepth;
  appId: string;
  appName: string;
  activityId: string;
  selector: string;
  fastQuery: boolean;
  groupKey: number;
  groupName: string;
  groupDescription: string;
  action?: string;
  preKeys: number[];
  includeLimits: boolean;
  matchRoot: boolean;
  includeActivity: boolean;
  exampleUrl?: string;
  snapshotUrl?: string;
  position?: Position;
}

interface RuleComposerParts {
  rule: Record<string, unknown>;
  group: Record<string, unknown>;
  app: Record<string, unknown>;
}

export interface PositionPoint {
  x: number;
  y: number;
}

interface PositionTargetRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export const isRulePositionAction = (action?: string) =>
  !action || action == 'clickCenter' || action == 'longClickCenter';

export const resolveRuleActionAfterPositionSelect = (action?: string) =>
  action == 'longClick' ||
  action == 'longClickNode' ||
  action == 'longClickCenter'
    ? 'longClickCenter'
    : 'clickCenter';

export const createRuleComposerDefaults = (now = Date.now()) => ({
  groupKey: 1,
  groupName: `[ChangeMe]规则名称-${dayjs(now).format('YYYY-MM-DD HH:mm:ss')}`,
  groupDescription: '[ChangeMe]本规则由GKD网页端审查工具生成',
  preKeys: [] as number[],
  includeLimits: false,
  matchRoot: false,
  includeActivity: true,
});

const compactNumber = (value: number) => String(Number(value.toFixed(4)));

export const parsePreKeys = (
  value: string,
): { values: number[]; error?: string } => {
  if (!value.trim()) return { values: [] };
  const items = value
    .split(/[,，]/u)
    .map((item) => item.trim())
    .filter(Boolean);
  if (!items.every((item) => /^-?\d+$/u.test(item))) {
    return { values: [], error: 'preKeys 必须是逗号分隔的整数' };
  }
  const values = items.map(Number);
  if (!values.every(Number.isSafeInteger)) {
    return { values: [], error: 'preKeys 包含超出安全范围的整数' };
  }
  return { values: [...new Set(values)] };
};

export const createRulePosition = (
  point: PositionPoint,
  target: PositionTargetRect,
  mode: RulePositionMode,
): Position => {
  const x = Math.round(point.x);
  const y = Math.round(point.y);
  if (mode == 'screen') return { x, y };

  const left = point.x - target.left;
  const top = point.y - target.top;
  if (mode == 'node-pixel') {
    return { left: Math.round(left), top: Math.round(top) };
  }
  if (!(target.width > 0) || !(target.height > 0)) {
    throw new Error('目标节点缺少有效尺寸，无法生成相对坐标');
  }
  return {
    left: `width * ${compactNumber(left / target.width)}`,
    top: `height * ${compactNumber(top / target.height)}`,
  };
};

export const composeRuleParts = (
  options: RuleComposerOptions,
): RuleComposerParts => {
  const rule: Record<string, unknown> = {};
  if (options.preKeys.length) rule.preKeys = options.preKeys;
  if (options.fastQuery) rule.fastQuery = true;
  if (options.matchRoot) rule.matchRoot = true;
  if (options.action) rule.action = options.action;
  if (options.includeActivity && options.activityId) {
    rule.activityIds = options.activityId;
  }
  if (options.position && isRulePositionAction(options.action)) {
    rule.position = options.position;
  }
  rule.matches = options.selector;
  if (options.exampleUrl) rule.exampleUrls = options.exampleUrl;
  if (options.snapshotUrl) rule.snapshotUrls = options.snapshotUrl;

  const group: Record<string, unknown> = {
    key: options.groupKey,
    name: options.groupName,
  };
  if (options.groupDescription) group.desc = options.groupDescription;
  if (options.includeLimits) {
    group.matchTime = 10000;
    group.actionMaximum = 1;
    group.resetMatch = 'app';
  }
  group.rules = [rule];

  const app: Record<string, unknown> = {
    id: options.appId,
    name: options.appName,
    groups: [group],
  };
  return { rule, group, app };
};

export const composeRuleDiagnosticText = (options: RuleComposerOptions) =>
  JSON5.stringify(composeRuleParts(options).app, undefined, 2);

export const composeRuleOutput = (options: RuleComposerOptions) => {
  const parts = composeRuleParts(options);
  if (options.outputDepth == 'ts') {
    return `import { defineGkdApp } from '@gkd-kit/define';\n\nexport default defineGkdApp(${JSON5.stringify(parts.app, undefined, 2)});\n`;
  }
  return JSON5.stringify(parts[options.outputDepth], undefined, 2);
};
