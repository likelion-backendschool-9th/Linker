import path from 'node:path';

/** Literal module references, including aliases and relative paths to the private adapter. */
function moduleName(node) {
  if (typeof node?.value === 'string') return node.value;
  if (node?.type === 'TemplateLiteral' && node.expressions.length === 0)
    return node.quasis[0].value.cooked;
  return null;
}

const loadingImports = {
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      shared:
        'Use @/components/ui/loading-indicator (or Button pending); vendor/adapter loading imports are private.',
    },
  },
  create(context) {
    const filename = path.resolve(context.filename).replaceAll('\\', '/');
    const testFile = /\.test\.[cm]?[jt]sx?$/.test(filename);
    const adapter = filename.endsWith('/src/components/ui/loading-orb.tsx');
    const entry = filename.endsWith('/src/components/ui/loading-indicator.tsx');
    function check(node, specifier) {
      const name = moduleName(specifier);
      if (!name || testFile) return;
      const vendor = name === 'thinking-orbs' || name.startsWith('thinking-orbs/');
      const resolved = name.startsWith('.')
        ? path.resolve(path.dirname(filename), name).replaceAll('\\', '/')
        : name.replace(/^@\//, '/src/');
      const internal = /\/src\/components\/ui\/loading-orb(?:\.[jt]sx?)?$/.test(resolved);
      if ((vendor && !adapter) || (internal && !entry))
        context.report({ node, messageId: 'shared' });
    }
    return {
      ImportDeclaration: (node) => check(node, node.source),
      ExportNamedDeclaration: (node) => check(node, node.source),
      ExportAllDeclaration: (node) => check(node, node.source),
      ImportExpression: (node) => check(node, node.source),
      CallExpression: (node) => {
        if (node.callee.type === 'Identifier' && node.callee.name === 'require')
          check(node, node.arguments[0]);
      },
    };
  },
};

export default loadingImports;
