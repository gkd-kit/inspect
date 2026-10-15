import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'node:test';
import { Linter, type Rule } from 'eslint';
import tseslint from 'typescript-eslint';
import componentConventions from './component-conventions.ts';
import importBoundaries from './import-boundaries.ts';

const verify = (
  ruleName: string,
  rules: Record<string, Rule.RuleModule>,
  source: string,
  filename: string,
) => {
  const linter = new Linter({ configType: 'flat' });
  return linter.verify(
    source,
    [
      {
        files: ['**/*.ts'],
        plugins: {
          project: { rules },
        },
        languageOptions: {
          parser: tseslint.parser,
          ecmaVersion: 'latest',
          sourceType: 'module',
          globals: { createApp: 'readonly' },
        },
        rules: {
          [`project/${ruleName}`]: 'error',
        },
      },
    ],
    { filename: path.resolve(filename) },
  );
};

const verifyBoundaries = (source: string, filename: string) =>
  verify('import-boundaries', importBoundaries.rules, source, filename);

const verifyComponents = (source: string, filename: string) =>
  verify('component-conventions', componentConventions.rules, source, filename);

test('normalizes alias traversal before checking dependency direction', () => {
  const messages = verifyBoundaries(
    `import value from '@/shared/../features/settings/store';`,
    'src/shared/lib/probe.ts',
  );
  assert.equal(messages[0]?.messageId, 'invalidLayer');
});

test('checks static template-literal dynamic imports', () => {
  const messages = verifyBoundaries(
    'import(`@/features/settings/store`);',
    'src/shared/lib/probe.ts',
  );
  assert.equal(messages[0]?.messageId, 'invalidLayer');
});

test('checks TypeScript-wrapped dynamic imports', () => {
  const messages = verifyBoundaries(
    `import('@/features/settings/store' as string);`,
    'src/shared/lib/probe.ts',
  );
  assert.equal(messages[0]?.messageId, 'invalidLayer');
});

test('checks TypeScript satisfies dynamic imports', () => {
  const messages = verifyBoundaries(
    `import('@/features/settings/store' satisfies string);`,
    'src/shared/lib/probe.ts',
  );
  assert.equal(messages[0]?.messageId, 'invalidLayer');
});

test('checks import.meta.glob patterns', () => {
  const messages = verifyBoundaries(
    `import.meta.glob('../../features/*/store.ts', { eager: true });`,
    'src/shared/lib/probe.ts',
  );
  assert.equal(messages[0]?.messageId, 'invalidLayer');
});

test('checks absolute src import.meta.glob patterns', () => {
  const messages = verifyBoundaries(
    `import.meta.glob('/src/features/*/store.ts', { eager: true });`,
    'src/shared/lib/probe.ts',
  );
  assert.equal(messages[0]?.messageId, 'invalidLayer');
});

test('allows explicit TypeScript extensions for public feature modules', () => {
  const messages = verifyBoundaries(
    `import store from '../settings/store.ts';`,
    'src/features/snapshot-list/probe.ts',
  );
  assert.deepEqual(messages, []);
});

test('rejects legacy top-level source directories', () => {
  const messages = verifyBoundaries(`export {};`, 'src/utils/probe.ts');
  assert.equal(messages[0]?.messageId, 'invalidSource');
});

test('rejects aliases for shared Gk components', () => {
  const messages = verifyComponents(
    `import SvgIcon from '@/shared/ui/GkSvg.vue';`,
    'src/app/probe.ts',
  );
  assert.equal(messages[0]?.messageId, 'invalidAlias');
});

test('rejects named default aliases for shared Gk components', () => {
  const messages = verifyComponents(
    `import { default as GkBusiness } from '@/shared/ui/GkSvg.vue';`,
    'src/app/probe.ts',
  );
  assert.equal(messages[0]?.messageId, 'invalidAlias');
});

test('rejects local aliases for imported Gk components', () => {
  const messages = verifyComponents(
    `import GkSvg from '@/shared/ui/GkSvg.vue'; const SvgIcon = GkSvg;`,
    'src/app/probe.ts',
  );
  assert.equal(messages[0]?.messageId, 'invalidAlias');
});

test('rejects destructured local aliases for imported Gk components', () => {
  const messages = verifyComponents(
    `import GkSvg from '@/shared/ui/GkSvg.vue'; const [SvgIcon] = [GkSvg];`,
    'src/app/probe.ts',
  );
  assert.equal(messages[0]?.messageId, 'invalidAlias');
});

test('reserves Gk aliases for shared UI components', () => {
  const messages = verifyComponents(
    `import GkBusiness from '@/features/settings/SettingsModal.vue';`,
    'src/app/probe.ts',
  );
  assert.equal(messages[0]?.messageId, 'reservedPrefix');
});

test('reserves Gk names declared outside shared UI', () => {
  const messages = verifyComponents(
    `const GkBusiness = Business;`,
    'src/features/probe.ts',
  );
  assert.equal(messages[0]?.messageId, 'reservedPrefix');
});

test('reserves destructured Gk names outside shared UI', () => {
  const messages = verifyComponents(
    `const { Business: GkBusiness } = components;`,
    'src/features/probe.ts',
  );
  assert.equal(messages[0]?.messageId, 'reservedPrefix');
});

test('rejects global Gk component registration', () => {
  const messages = verifyComponents(
    `const app = createApp(App); app.component('GkBusiness', component);`,
    'src/app/probe.ts',
  );
  assert.equal(messages[0]?.messageId, 'globalRegistration');
});

test('rejects computed global component registration', () => {
  const messages = verifyComponents(
    `const app = createApp(App); app['component'](componentName, component);`,
    'src/app/probe.ts',
  );
  assert.equal(messages[0]?.messageId, 'globalRegistration');
});

test('does not treat arbitrary component methods as Vue registration', () => {
  const messages = verifyComponents(
    `builder.component('header');`,
    'src/app/probe.ts',
  );
  assert.deepEqual(messages, []);
});

test('resolves shadowed Vue app names by lexical scope', () => {
  const messages = verifyComponents(
    `const app = createApp(App); function render(app) { app.component('header'); }`,
    'src/app/probe.ts',
  );
  assert.deepEqual(messages, []);
});

test('reserves explicit Gk component names outside shared UI', () => {
  const messages = verifyComponents(
    `defineComponent({ name: 'GkBusiness' });`,
    'src/features/probe.ts',
  );
  assert.equal(messages[0]?.messageId, 'reservedPrefix');
});

test('reserves indirect explicit Gk component names outside shared UI', () => {
  const messages = verifyComponents(
    `const options = { name: 'GkBusiness' }; defineComponent(options);`,
    'src/features/probe.ts',
  );
  assert.equal(messages[0]?.messageId, 'reservedPrefix');
});

test('resolves indirect component options by lexical scope', () => {
  const messages = verifyComponents(
    `const options = { name: 'GkBusiness' }; { const options = { name: 'Business' }; } defineComponent(options);`,
    'src/features/probe.ts',
  );
  assert.equal(messages[0]?.messageId, 'reservedPrefix');
});

test('requires Gk for TypeScript shared components', () => {
  const messages = verifyComponents(
    `defineComponent(() => null);`,
    'src/shared/ui/GapList.ts',
  );
  assert.equal(messages[0]?.messageId, 'missingPrefix');
});

test('does not reserve the Gkd domain prefix', () => {
  const messages = verifyComponents(
    `import { GkdException } from '@gkd-kit/selector';`,
    'src/features/probe.ts',
  );
  assert.deepEqual(messages, []);
});
