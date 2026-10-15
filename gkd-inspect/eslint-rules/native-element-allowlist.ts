import type { JSSyntaxElement, Rule } from 'eslint';
import type { AST } from 'vue-eslint-parser';

export const allowedNativeElementNames = Object.freeze([
  // Generic containers
  'div',
  'span',

  // Native interaction
  'a',
  'button',
  'input',

  // Images and drawing
  'img',
  'canvas',
  'svg',

  // Tables
  'table',
  'caption',
  'colgroup',
  'col',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'th',
  'td',

  // Vue built-ins
  'template',
  'slot',
  'component',
]);

const allowedNativeElements = new Set(allowedNativeElementNames);

type LooseNode = JSSyntaxElement & Record<string, any>;

const getStaticString = (node: LooseNode | undefined): string | null => {
  if (!node) return null;
  if (node.type == 'Literal' && typeof node.value == 'string') {
    return node.value;
  }
  if (node.type == 'TemplateLiteral' && node.expressions.length == 0) {
    return node.quasis[0]?.value.cooked ?? null;
  }
  return null;
};

const getMemberPropertyName = (node: LooseNode): string | null => {
  if (!node.computed && node.property.type == 'Identifier') {
    return node.property.name;
  }
  return getStaticString(node.property);
};

const isNativeElementName = (name: string) => /^[a-z]/u.test(name);

const nativeElementAllowlistRule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'enforce the project allowlist for native element names',
    },
    schema: [],
    messages: {
      disallowed:
        'Native element <{{name}}> is not in the project allowlist. Use an allowed element or update the allowlist intentionally.',
    },
  },
  create(context) {
    const report = (node: JSSyntaxElement, name: string) => {
      if (!isNativeElementName(name) || allowedNativeElements.has(name)) {
        return;
      }
      context.report({
        node,
        messageId: 'disallowed',
        data: { name },
      });
    };

    const scriptVisitor = {
      JSXOpeningElement(node: LooseNode) {
        if (node.name.type == 'JSXIdentifier') {
          report(node.name, node.name.name);
        }
      },
      CallExpression(node: LooseNode) {
        const tagName = getStaticString(node.arguments[0]);
        if (!tagName) return;

        if (node.callee.type == 'Identifier' && node.callee.name == 'h') {
          report(node.arguments[0], tagName);
          return;
        }

        if (
          node.callee.type == 'MemberExpression' &&
          node.callee.object.type == 'Identifier' &&
          node.callee.object.name == 'document' &&
          getMemberPropertyName(node.callee) == 'createElement'
        ) {
          report(node.arguments[0], tagName);
        }
      },
    } as unknown as Rule.RuleListener;

    const templateVisitor = {
      VElement(node: AST.VElement) {
        report(node.startTag, node.rawName);
      },
    };

    const services = context.sourceCode.parserServices as {
      defineTemplateBodyVisitor?: (
        templateBodyVisitor: typeof templateVisitor,
        scriptVisitor: Rule.RuleListener,
      ) => Rule.RuleListener;
    };
    if (services.defineTemplateBodyVisitor) {
      return services.defineTemplateBodyVisitor(templateVisitor, scriptVisitor);
    }
    return scriptVisitor;
  },
};

const typescriptSourceFilesOnlyRule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'require TypeScript or Vue source file extensions',
    },
    schema: [],
    messages: {
      forbiddenExtension:
        'Source files must use .ts, .tsx, or .vue instead of .{{extension}}.',
    },
  },
  create(context) {
    return {
      Program(node) {
        const extension = context.filename.match(/\.([^.\\/]+)$/u)?.[1];
        if (!extension) return;
        context.report({
          node,
          messageId: 'forbiddenExtension',
          data: { extension },
        });
      },
    };
  },
};

export default {
  rules: {
    'native-element-allowlist': nativeElementAllowlistRule,
    'typescript-source-files-only': typescriptSourceFilesOnlyRule,
  },
};
