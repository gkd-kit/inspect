import type { JSSyntaxElement, Rule } from 'eslint';

const forbiddenWatcherNames = new Set([
  '$watch',
  'syncRef',
  'syncRefs',
  'watch',
  'watchArray',
  'watchAtMost',
  'watchDebounced',
  'watchDeep',
  'watchEffect',
  'watchIgnorable',
  'watchImmediate',
  'watchOnce',
  'watchPausable',
  'watchPostEffect',
  'watchSyncEffect',
  'watchThrottled',
  'watchTriggerable',
  'watchWithFilter',
  'whenever',
]);

type LooseNode = JSSyntaxElement & Record<string, any>;

const getCalledName = (node: LooseNode): string | undefined => {
  if (node.callee.type == 'Identifier') return node.callee.name;
  if (
    node.callee.type == 'MemberExpression' &&
    !node.callee.computed &&
    node.callee.property.type == 'Identifier'
  ) {
    return node.callee.property.name;
  }
};

const noImplicitStateWatchersRule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'require state changes to originate from explicit actions instead of watcher callbacks',
    },
    schema: [],
    messages: {
      forbidden:
        '{{name}} is not allowed here. Route, lifecycle, and user events must call named actions explicitly.',
    },
  },
  create(context) {
    return {
      CallExpression(node: LooseNode) {
        const name = getCalledName(node);
        if (!name || !forbiddenWatcherNames.has(name)) return;
        context.report({ node, messageId: 'forbidden', data: { name } });
      },
    } as unknown as Rule.RuleListener;
  },
};

export default {
  rules: {
    'no-implicit-state-watchers': noImplicitStateWatchersRule,
  },
};
