import path from 'node:path';
import type { JSSyntaxElement, Rule } from 'eslint';

type LooseNode = JSSyntaxElement & Record<string, any>;
type Layer = 'app' | 'pages' | 'features' | 'entities' | 'shared';

const layerDependencies: Record<Layer, ReadonlySet<Layer>> = {
  app: new Set(['app', 'pages', 'features', 'entities', 'shared']),
  pages: new Set(['pages', 'features', 'entities', 'shared']),
  features: new Set(['features', 'entities', 'shared']),
  entities: new Set(['entities', 'shared']),
  shared: new Set(['shared']),
};

const featureDependencies: Record<string, ReadonlySet<string>> = {
  'device-control': new Set([
    'network-access',
    'navigation',
    'selector-library',
    'snapshot-management',
  ]),
  'log-viewer': new Set(['navigation', 'network-access']),
  'selector-tester': new Set(['navigation']),
  'selector-library': new Set(['navigation']),
  'snapshot-inspector': new Set([
    'navigation',
    'selector-library',
    'settings',
    'snapshot-management',
  ]),
  'snapshot-list': new Set(['settings', 'snapshot-management']),
  'snapshot-management': new Set(['network-access', 'settings']),
};

const publicFeatureModules: Record<string, ReadonlySet<string>> = {
  navigation: new Set(['PageBackButton.vue']),
  'network-access': new Set(['enhanceFetch', 'store']),
  'selector-library': new Set([
    'library',
    'store',
    'ui/SelectorLibraryDialog.vue',
  ]),
  settings: new Set(['SettingsModal.vue', 'store']),
  'snapshot-management': new Set([
    'export',
    'import',
    'ui/SnapshotActionCard.vue',
    'ui/SnapshotBatchActionsBar.vue',
    'useBatchActions',
  ]),
};

const entityDependencies: Record<string, ReadonlySet<string>> = {
  selector: new Set(['snapshot']),
};

const getSourcePath = (filename: string) => {
  const normalizedFilename = filename.replaceAll(path.sep, '/');
  const sourceMarker = '/src/';
  const sourceIndex = normalizedFilename.lastIndexOf(sourceMarker);
  if (sourceIndex < 0) return;
  return normalizedFilename.slice(sourceIndex + sourceMarker.length);
};

const getLayer = (value: string | undefined): Layer | undefined => {
  const layer = value?.split('/')[0];
  return layer && layer in layerDependencies ? (layer as Layer) : undefined;
};

const importBoundariesRule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: { description: 'enforce the project source dependency direction' },
    schema: [],
    messages: {
      invalidLayer: '{{source}} cannot depend on {{target}}.',
      invalidSlice: '{{source}} cannot depend on sibling slice {{target}}.',
      privateFeatureModule:
        '{{source}} cannot import private module {{target}} from another feature.',
      invalidSource:
        'Source files must belong to app, pages, features, entities, or shared.',
      invalidTarget:
        'Imports from unknown src top-level directories are not allowed.',
    },
  },
  create(context) {
    const importerPath = getSourcePath(context.filename);
    const importerLayer = getLayer(importerPath);
    const importerSlice = importerPath?.split('/')[1];

    const check = (node: LooseNode, value: unknown) => {
      if (!importerLayer || !importerPath || typeof value != 'string') {
        return;
      }
      const targetPath = value.startsWith('@/')
        ? path.posix.normalize(value.slice(2))
        : value.startsWith('/src/')
          ? path.posix.normalize(value.slice('/src/'.length))
          : value.startsWith('.')
            ? path.posix.normalize(
                path.posix.join(path.posix.dirname(importerPath), value),
              )
            : undefined;
      if (!targetPath) return;
      const targetLayer = getLayer(targetPath);
      if (!targetLayer) {
        context.report({ node, messageId: 'invalidTarget' });
        return;
      }
      if (!layerDependencies[importerLayer].has(targetLayer)) {
        context.report({
          node,
          messageId: 'invalidLayer',
          data: { source: importerLayer, target: targetLayer },
        });
        return;
      }

      const targetSlice = targetPath.split('/')[1];
      if (!importerSlice || !targetSlice || importerSlice == targetSlice)
        return;

      if (importerLayer == 'pages' && targetLayer == 'pages') {
        context.report({
          node,
          messageId: 'invalidSlice',
          data: { source: importerSlice, target: targetSlice },
        });
      }
      if (
        importerLayer == 'features' &&
        targetLayer == 'features' &&
        !featureDependencies[importerSlice]?.has(targetSlice)
      ) {
        context.report({
          node,
          messageId: 'invalidSlice',
          data: { source: importerSlice, target: targetSlice },
        });
      } else if (
        importerLayer == 'features' &&
        targetLayer == 'features' &&
        !publicFeatureModules[targetSlice]?.has(
          targetPath
            .split('/')
            .slice(2)
            .join('/')
            .replace(/\.(?:ts|tsx)$/u, ''),
        )
      ) {
        context.report({
          node,
          messageId: 'privateFeatureModule',
          data: {
            source: importerSlice,
            target: targetPath.split('/').slice(1).join('/'),
          },
        });
      }
      if (
        importerLayer == 'entities' &&
        targetLayer == 'entities' &&
        !entityDependencies[importerSlice]?.has(targetSlice)
      ) {
        context.report({
          node,
          messageId: 'invalidSlice',
          data: { source: importerSlice, target: targetSlice },
        });
      }
    };

    const unwrapExpression = (source: LooseNode | undefined) => {
      while (
        source &&
        [
          'TSAsExpression',
          'TSSatisfiesExpression',
          'TSTypeAssertion',
          'TSNonNullExpression',
          'TSInstantiationExpression',
          'ChainExpression',
        ].includes(source.type)
      ) {
        source = source.expression;
      }
      return source;
    };

    const getStaticImportValue = (source: LooseNode | undefined) => {
      source = unwrapExpression(source);
      if (typeof source?.value == 'string') return source.value;
      if (
        source?.type == 'TemplateLiteral' &&
        source.expressions?.length == 0 &&
        source.quasis?.length == 1
      ) {
        return source.quasis[0].value.cooked ?? source.quasis[0].value.raw;
      }
    };

    return {
      Program(node: LooseNode) {
        if (
          importerPath &&
          !importerLayer &&
          (importerPath.includes('/') ||
            (importerPath != 'main.ts' && !importerPath.endsWith('.d.ts')))
        ) {
          context.report({ node, messageId: 'invalidSource' });
        }
      },
      ImportDeclaration(node: LooseNode) {
        check(node, getStaticImportValue(node.source));
      },
      ExportNamedDeclaration(node: LooseNode) {
        check(node, getStaticImportValue(node.source));
      },
      ExportAllDeclaration(node: LooseNode) {
        check(node, getStaticImportValue(node.source));
      },
      ImportExpression(node: LooseNode) {
        check(node, getStaticImportValue(node.source));
      },
      CallExpression(node: LooseNode) {
        const callee = node.callee;
        const isImportMetaGlob =
          callee?.type == 'MemberExpression' &&
          ((callee.computed && callee.property?.value == 'glob') ||
            (!callee.computed && callee.property?.name == 'glob')) &&
          callee.object?.type == 'MetaProperty' &&
          callee.object.meta?.name == 'import' &&
          callee.object.property?.name == 'meta';
        if (!isImportMetaGlob) return;
        const patterns =
          node.arguments?.[0]?.type == 'ArrayExpression'
            ? node.arguments[0].elements
            : [node.arguments?.[0]];
        for (const pattern of patterns) {
          check(node, getStaticImportValue(pattern));
        }
      },
    } as unknown as Rule.RuleListener;
  },
};

export default {
  rules: {
    'import-boundaries': importBoundariesRule,
  },
};
