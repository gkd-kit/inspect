import path from 'node:path';
import type { JSSyntaxElement, Rule } from 'eslint';

type LooseNode = JSSyntaxElement & Record<string, any>;

const toSourcePath = (filename: string) => {
  const normalizedFilename = filename.replaceAll(path.sep, '/');
  const sourceMarker = '/src/';
  const sourceIndex = normalizedFilename.lastIndexOf(sourceMarker);
  if (sourceIndex < 0) return;
  return normalizedFilename.slice(sourceIndex + sourceMarker.length);
};

const toComponentName = (filename: string) =>
  path.basename(filename, path.extname(filename));

const isGkComponentName = (value: string) =>
  /^Gk[A-Z][A-Za-z0-9]*$/u.test(value);

const componentConventionsRule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'reserve the Gk prefix for reusable shared UI components',
    },
    schema: [],
    messages: {
      missingPrefix:
        'Reusable components in src/shared/ui must use a Gk-prefixed PascalCase filename.',
      reservedPrefix:
        'The Gk prefix is reserved for reusable components in src/shared/ui.',
      invalidAlias:
        'Gk components must be imported with their filename and cannot be aliased.',
      globalRegistration:
        'Gk components must be imported locally and cannot be registered globally.',
      invalidExplicitName:
        'A shared Gk component name declared with defineOptions must match its filename.',
    },
  },
  create(context) {
    const sourcePath = toSourcePath(context.filename);
    const extension = path.extname(context.filename);
    const filename = toComponentName(context.filename);
    const isSharedUi = sourcePath?.startsWith('shared/ui/') ?? false;
    const isGkComponent = isGkComponentName(filename);
    let missingPrefixReported = false;

    const reportMissingPrefix = (node: LooseNode) => {
      if (missingPrefixReported) return;
      missingPrefixReported = true;
      context.report({ node, messageId: 'missingPrefix' });
    };

    const resolveImportPath = (value: unknown) => {
      if (!sourcePath || typeof value != 'string') return;
      if (value.startsWith('@/')) return path.posix.normalize(value.slice(2));
      if (!value.startsWith('.')) return;
      return path.posix.normalize(
        path.posix.join(path.posix.dirname(sourcePath), value),
      );
    };

    const checkDeclaredName = (node: LooseNode, name: unknown) => {
      if (typeof name != 'string' || !isGkComponentName(name)) return;
      if (!isSharedUi) {
        context.report({ node, messageId: 'reservedPrefix' });
      } else if (name != filename) {
        context.report({ node, messageId: 'invalidAlias' });
      }
    };

    const checkBindingPattern = (pattern: LooseNode | undefined) => {
      if (!pattern) return;
      if (pattern.type == 'Identifier') {
        checkDeclaredName(pattern, pattern.name);
      } else if (pattern.type == 'ObjectPattern') {
        for (const property of pattern.properties ?? []) {
          checkBindingPattern(
            property.type == 'RestElement' ? property.argument : property.value,
          );
        }
      } else if (pattern.type == 'ArrayPattern') {
        for (const element of pattern.elements ?? []) {
          checkBindingPattern(element);
        }
      } else if (
        pattern.type == 'AssignmentPattern' ||
        pattern.type == 'RestElement'
      ) {
        checkBindingPattern(pattern.left ?? pattern.argument);
      }
    };

    const findVariable = (node: LooseNode, name: string) => {
      let scope = context.sourceCode.getScope(
        node as Parameters<typeof context.sourceCode.getScope>[0],
      );
      while (scope) {
        const variable = scope.set.get(name);
        if (variable) return variable;
        scope = scope.upper as typeof scope;
      }
    };

    const getVariableInitializer = (identifier: LooseNode) => {
      const variable = findVariable(identifier, identifier.name);
      const definition = variable?.defs.find(
        (candidate) => candidate.node?.type == 'VariableDeclarator',
      );
      return (definition?.node as LooseNode | undefined)?.init as
        | LooseNode
        | undefined;
    };

    const isSharedGkReference = (
      value: LooseNode | undefined,
      seen = new Set<unknown>(),
    ): boolean => {
      if (value?.type != 'Identifier') return false;
      const variable = findVariable(value, value.name);
      if (!variable || seen.has(variable)) return false;
      seen.add(variable);
      for (const definition of variable.defs) {
        const definitionNode = definition.node as LooseNode;
        if (
          (definitionNode?.type == 'ImportDefaultSpecifier' ||
            (definitionNode?.type == 'ImportSpecifier' &&
              definitionNode.imported?.name == 'default')) &&
          resolveImportPath(definitionNode.parent?.source?.value)?.startsWith(
            'shared/ui/Gk',
          )
        ) {
          return true;
        }
        if (
          definitionNode?.type == 'VariableDeclarator' &&
          isSharedGkReference(definitionNode.init, seen)
        ) {
          return true;
        }
      }
      return false;
    };

    const checkGkAlias = (
      node: LooseNode,
      target: LooseNode | undefined,
      value: LooseNode | undefined,
    ) => {
      if (
        target?.type != 'Identifier' ||
        value?.type != 'Identifier' ||
        !isSharedGkReference(value) ||
        target.name == value.name
      ) {
        return;
      }
      context.report({ node, messageId: 'invalidAlias' });
    };

    const checkGkAliasPattern = (
      node: LooseNode,
      target: LooseNode | undefined,
      value: LooseNode | undefined,
    ) => {
      if (target?.type == 'Identifier') {
        checkGkAlias(node, target, value);
      } else if (
        target?.type == 'ArrayPattern' &&
        value?.type == 'ArrayExpression'
      ) {
        target.elements?.forEach((element: LooseNode, index: number) =>
          checkGkAliasPattern(node, element, value.elements?.[index]),
        );
      } else if (
        target?.type == 'ObjectPattern' &&
        value?.type == 'ObjectExpression'
      ) {
        for (const targetProperty of target.properties ?? []) {
          if (targetProperty.type != 'Property') continue;
          const valueProperty = value.properties?.find(
            (candidate: LooseNode) =>
              candidate.type == 'Property' &&
              ((candidate.key?.name &&
                candidate.key.name == targetProperty.key?.name) ||
                candidate.key?.value == targetProperty.key?.value),
          );
          checkGkAliasPattern(node, targetProperty.value, valueProperty?.value);
        }
      } else if (target?.type == 'AssignmentPattern') {
        checkGkAliasPattern(node, target.left, value);
      }
    };

    const getStaticString = (node: LooseNode | undefined) => {
      if (typeof node?.value == 'string') return node.value;
      if (
        node?.type == 'TemplateLiteral' &&
        node.expressions?.length == 0 &&
        node.quasis?.length == 1
      ) {
        return node.quasis[0].value.cooked ?? node.quasis[0].value.raw;
      }
    };

    const checkExplicitName = (options: LooseNode) => {
      if (options?.type != 'ObjectExpression') return;
      const nameProperty = options.properties?.find(
        (property: LooseNode) =>
          property.type == 'Property' &&
          ((property.key?.type == 'Identifier' &&
            property.key.name == 'name') ||
            property.key?.value == 'name'),
      );
      const explicitName = getStaticString(nameProperty?.value);
      if (!explicitName) return;
      if (isSharedUi && isGkComponent && explicitName != filename) {
        context.report({
          node: nameProperty,
          messageId: 'invalidExplicitName',
        });
      } else if (!isSharedUi && isGkComponentName(explicitName)) {
        context.report({ node: nameProperty, messageId: 'reservedPrefix' });
      }
    };

    const resolveComponentOptions = (
      value: LooseNode | undefined,
      seen = new Set<unknown>(),
    ): LooseNode | undefined => {
      if (value?.type == 'ObjectExpression') return value;
      if (value?.type != 'Identifier') return;
      const variable = findVariable(value, value.name);
      if (!variable || seen.has(variable)) return;
      seen.add(variable);
      return resolveComponentOptions(getVariableInitializer(value), seen);
    };

    const isCreateAppCall = (value: LooseNode | undefined) => {
      if (value?.type != 'CallExpression') return false;
      const callee = value.callee;
      if (callee?.type != 'Identifier') return false;
      const variable = findVariable(callee, callee.name);
      if (!variable || variable.defs.length == 0) {
        return callee.name == 'createApp';
      }
      return variable.defs.some((definition) => {
        const definitionNode = definition.node as LooseNode;
        return (
          definitionNode?.type == 'ImportSpecifier' &&
          definitionNode.imported?.name == 'createApp' &&
          definitionNode.parent?.source?.value == 'vue'
        );
      });
    };

    const isVueAppValue = (
      value: LooseNode | undefined,
      seen = new Set<unknown>(),
    ): boolean => {
      if (isCreateAppCall(value)) return true;
      if (value?.type == 'Identifier') {
        const variable = findVariable(value, value.name);
        if (!variable || seen.has(variable)) return false;
        seen.add(variable);
        return isVueAppValue(getVariableInitializer(value), seen);
      }
      return (
        value?.type == 'CallExpression' &&
        value.callee?.type == 'MemberExpression' &&
        isVueAppValue(value.callee.object, seen)
      );
    };

    return {
      Program(node: LooseNode) {
        if (!sourcePath) return;
        if (
          isSharedUi &&
          (extension == '.vue' || extension == '.tsx') &&
          !isGkComponent
        ) {
          reportMissingPrefix(node);
        } else if (!isSharedUi && isGkComponentName(filename)) {
          context.report({ node, messageId: 'reservedPrefix' });
        }
      },
      ImportDeclaration(node: LooseNode) {
        const importPath = resolveImportPath(node.source.value);
        const importedName = importPath
          ? toComponentName(importPath)
          : undefined;
        const importsGkComponent =
          importPath?.startsWith('shared/ui/') &&
          importedName &&
          isGkComponentName(importedName);

        for (const specifier of node.specifiers ?? []) {
          const localName = specifier.local?.name;
          if (typeof localName != 'string') continue;
          const importsDefault =
            specifier.type == 'ImportDefaultSpecifier' ||
            (specifier.type == 'ImportSpecifier' &&
              specifier.imported?.name == 'default');
          if (
            importsDefault &&
            importsGkComponent &&
            localName != importedName
          ) {
            context.report({ node: specifier, messageId: 'invalidAlias' });
          } else if (isGkComponentName(localName) && !importsGkComponent) {
            context.report({ node: specifier, messageId: 'reservedPrefix' });
          }
        }
      },
      VariableDeclarator(node: LooseNode) {
        checkBindingPattern(node.id);
        checkGkAliasPattern(node, node.id, node.init);
      },
      FunctionDeclaration(node: LooseNode) {
        checkDeclaredName(node, node.id?.name);
      },
      ClassDeclaration(node: LooseNode) {
        checkDeclaredName(node, node.id?.name);
      },
      AssignmentExpression(node: LooseNode) {
        checkGkAliasPattern(node, node.left, node.right);
      },
      CallExpression(node: LooseNode) {
        const callee = node.callee;
        const isDefineComponent =
          callee?.type == 'Identifier' && callee.name == 'defineComponent';
        if (
          isDefineComponent &&
          extension == '.ts' &&
          isSharedUi &&
          !isGkComponent
        ) {
          reportMissingPrefix(node);
        }

        if (
          callee?.type == 'MemberExpression' &&
          ((!callee.computed && callee.property?.name == 'component') ||
            (callee.computed && callee.property?.value == 'component')) &&
          isVueAppValue(callee.object)
        ) {
          context.report({ node, messageId: 'globalRegistration' });
        }

        const isDefineOptions =
          callee?.type == 'Identifier' && callee.name == 'defineOptions';
        if (
          (isDefineComponent || (isDefineOptions && extension == '.vue')) &&
          node.arguments?.[0]
        ) {
          const options = resolveComponentOptions(node.arguments[0]);
          if (options) checkExplicitName(options);
        }
      },
    } as unknown as Rule.RuleListener;
  },
};

export default {
  rules: {
    'component-conventions': componentConventionsRule,
  },
};
