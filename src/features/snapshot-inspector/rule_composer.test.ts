import assert from 'node:assert/strict';
import test from 'node:test';
import {
  composeRuleOutput,
  composeRuleParts,
  createRuleComposerDefaults,
  createRulePosition,
  isRulePositionAction,
  parsePreKeys,
  resolveRuleActionAfterPositionSelect,
  type RuleComposerOptions,
} from './rule_composer.ts';

const baseOptions: RuleComposerOptions = {
  outputDepth: 'app',
  appId: 'com.example',
  appName: 'Example',
  activityId: 'com.example.MainActivity',
  selector: '[text="关闭"]',
  fastQuery: true,
  groupKey: 1,
  groupName: '开屏广告',
  groupDescription: '关闭广告',
  action: 'clickCenter',
  preKeys: [2],
  includeLimits: true,
  matchRoot: true,
  includeActivity: true,
};

test('composes rule, group, app and TypeScript output depths', () => {
  const parts = composeRuleParts(baseOptions);
  assert.deepEqual(parts.rule, {
    preKeys: [2],
    fastQuery: true,
    matchRoot: true,
    action: 'clickCenter',
    activityIds: 'com.example.MainActivity',
    matches: '[text="关闭"]',
  });
  assert.equal(parts.group.matchTime, 10000);
  assert.equal(parts.group.actionMaximum, 1);
  assert.equal(parts.app.id, 'com.example');

  const tsOutput = composeRuleOutput({ ...baseOptions, outputDepth: 'ts' });
  assert.match(tsOutput, /defineGkdApp/u);
  assert.match(tsOutput, /com\.example/u);
});

test('creates deterministic defaults for quick copy and composer sessions', () => {
  const defaults = createRuleComposerDefaults(0);
  assert.match(
    defaults.groupName,
    /^\[ChangeMe\]规则名称-\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/u,
  );
  assert.deepEqual(
    { ...defaults, groupName: undefined },
    {
      groupKey: 1,
      groupName: undefined,
      groupDescription: '[ChangeMe]本规则由GKD网页端审查工具生成',
      preKeys: [],
      includeLimits: false,
      matchRoot: false,
      includeActivity: true,
    },
  );
});

test('parses unique integer preKeys and rejects invalid values', () => {
  assert.deepEqual(parsePreKeys('1, 2，1'), { values: [1, 2] });
  assert.equal(parsePreKeys('1, x').error, 'preKeys 必须是逗号分隔的整数');
});

test('creates screen, node pixel and node relative positions', () => {
  const point = { x: 150, y: 240 };
  const target = { left: 100, top: 200, width: 200, height: 80 };

  assert.deepEqual(createRulePosition(point, target, 'screen'), {
    x: 150,
    y: 240,
  });
  assert.deepEqual(createRulePosition(point, target, 'node-pixel'), {
    left: 50,
    top: 40,
  });
  assert.deepEqual(createRulePosition(point, target, 'node-relative'), {
    left: 'width * 0.25',
    top: 'height * 0.5',
  });
});

test('keeps long-click semantics when selecting a screenshot position', () => {
  assert.equal(
    resolveRuleActionAfterPositionSelect('longClick'),
    'longClickCenter',
  );
  assert.equal(
    resolveRuleActionAfterPositionSelect('longClickNode'),
    'longClickCenter',
  );
  assert.equal(
    resolveRuleActionAfterPositionSelect('clickNode'),
    'clickCenter',
  );
});

test('only emits position for actions that support it', () => {
  assert.equal(isRulePositionAction(''), true);
  assert.equal(isRulePositionAction('clickCenter'), true);
  assert.equal(isRulePositionAction('longClickCenter'), true);
  assert.equal(isRulePositionAction('clickNode'), false);

  const parts = composeRuleParts({
    ...baseOptions,
    action: 'clickNode',
    position: { x: 10, y: 20 },
  });
  assert.equal(parts.rule.action, 'clickNode');
  assert.equal(parts.rule.position, undefined);
});
