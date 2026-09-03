import assert from 'node:assert/strict';
import test from 'node:test';
import { listToTree } from '../../domain/snapshot/node.ts';
import { evaluateRuleText } from './rule_diagnostics.ts';

const createFixture = () => {
  const nodes: RawNode[] = [
    {
      id: 0,
      pid: -1,
      children: [],
      attr: {
        name: 'Root',
        isClickable: false,
        childCount: 1,
        index: 0,
        depth: 0,
        left: 0,
        top: 0,
        right: 100,
        bottom: 100,
        width: 100,
        height: 100,
      },
    },
    {
      id: 1,
      pid: 0,
      children: [],
      textQf: true,
      attr: {
        name: 'Button',
        text: '确定',
        textLen: 2,
        isClickable: true,
        childCount: 0,
        index: 0,
        depth: 1,
        left: 10,
        top: 10,
        right: 90,
        bottom: 50,
        width: 80,
        height: 40,
      },
    },
  ];
  const rootNode = listToTree(nodes);
  const snapshot = {
    id: 1,
    appId: 'com.example',
    activityId: 'com.example.MainActivity',
  } as Snapshot;
  return { rootNode, snapshot };
};

test('requires matches and anyMatches when both are present', () => {
  const { rootNode, snapshot } = createFixture();
  const result = evaluateRuleText(
    `{ matches: '[text="确定"]', anyMatches: '[text="不存在"]' }`,
    snapshot,
    rootNode,
  );
  assert.equal(result.status, 'not-matched');
  if (result.status == 'not-matched')
    assert.match(result.message, /anyMatches/);
});

test('inherits group activityIds and accepts string rules', () => {
  const { rootNode, snapshot } = createFixture();
  const result = evaluateRuleText(
    `{ id: 'com.example', groups: [{ key: 1, activityIds: '.Main', rules: '[text="确定"]' }] }`,
    snapshot,
    rootNode,
  );
  assert.equal(result.status, 'matched');
});

test('rejects a rule when all excludeAllMatches selectors match', () => {
  const { rootNode, snapshot } = createFixture();
  const result = evaluateRuleText(
    `{ matches: '[text="确定"]', excludeAllMatches: ['Root', '[text="确定"]'] }`,
    snapshot,
    rootNode,
  );
  assert.equal(result.status, 'not-matched');
  if (result.status == 'not-matched') {
    assert.match(result.message, /excludeAllMatches/);
  }
});

test('reports runtime-only fields without claiming full simulation', () => {
  const { rootNode, snapshot } = createFixture();
  const result = evaluateRuleText(
    `{ matches: '[text="确定"]', preKeys: [1] }`,
    snapshot,
    rootNode,
  );
  assert.equal(result.status, 'matched');
  if (result.status == 'matched') {
    assert.ok(result.notes.some((note) => note.includes('preKeys')));
  }
});

test('reports malformed activity constraints as invalid input', () => {
  const { rootNode, snapshot } = createFixture();
  const result = evaluateRuleText(
    `{ matches: '[text="确定"]', activityIds: 1 }`,
    snapshot,
    rootNode,
  );
  assert.equal(result.status, 'invalid');
});
