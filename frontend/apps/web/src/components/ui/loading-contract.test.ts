import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { Linter } from 'eslint';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import loadingImports from '../../../tooling/loading-import-rule.mjs';

const appRoot = path.resolve('src/app');
const entry = path.resolve('src/components/ui/loading-indicator');

function usesSharedFallback(filename: string, source: string) {
  const file = ts.createSourceFile(
    filename,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const names = new Set<string>();
  for (const node of file.statements) {
    if (!ts.isImportDeclaration(node) || !ts.isStringLiteral(node.moduleSpecifier)) continue;
    const name = node.moduleSpecifier.text;
    const resolved = name.startsWith('@/')
      ? path.resolve('src', name.slice(2))
      : path.resolve(path.dirname(filename), name);
    if (resolved.replace(/\.tsx?$/, '') !== entry) continue;
    const imports = node.importClause?.namedBindings;
    if (imports && ts.isNamedImports(imports)) {
      for (const item of imports.elements) {
        if ((item.propertyName ?? item.name).text === 'LoadingIndicator') names.add(item.name.text);
      }
    }
  }
  let used = false;
  for (const node of file.statements) {
    if (
      !ts.isFunctionDeclaration(node) ||
      !node.modifiers?.some((x) => x.kind === ts.SyntaxKind.DefaultKeyword)
    )
      continue;
    function visit(child: ts.Node) {
      if (
        (ts.isJsxOpeningElement(child) || ts.isJsxSelfClosingElement(child)) &&
        ts.isIdentifier(child.tagName) &&
        names.has(child.tagName.text)
      )
        used = true;
      ts.forEachChild(child, visit);
    }
    visit(node);
  }
  return used;
}

function routeLoaders(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((file) => {
    const full = path.join(directory, file.name);
    return file.isDirectory() ? routeLoaders(full) : file.name === 'loading.tsx' ? [full] : [];
  });
}

it('every existing and newly added route fallback renders the shared loading entry point', () => {
  const files = routeLoaders(appRoot);
  expect(files.length).toBeGreaterThan(0);
  expect(files.filter((file) => !usesSharedFallback(file, readFileSync(file, 'utf8')))).toEqual([]);
});

it('accepts alias and relative imports but rejects unused imports or per-page placeholders', () => {
  const file = path.join(appRoot, 'feed/loading.tsx');
  for (const specifier of [
    '@/components/ui/loading-indicator',
    '../../components/ui/loading-indicator',
  ]) {
    expect(
      usesSharedFallback(
        file,
        `import { LoadingIndicator as Wait } from '${specifier}'; export default function Loading(){return <Wait label="불러오는 중…"/>}`,
      ),
    ).toBe(true);
  }
  expect(
    usesSharedFallback(
      file,
      "import { LoadingIndicator } from '@/components/ui/loading-indicator'; export default function Loading(){return <p>대기</p>}",
    ),
  ).toBe(false);
  expect(usesSharedFallback(file, 'export default function Loading(){return <Skeleton/>}')).toBe(
    false,
  );
});

describe('private adapter/vendor import guard', () => {
  const linter = new Linter();
  function errors(code: string, filename = 'src/app/feed/loading.tsx') {
    return linter
      .verify(
        code,
        [
          {
            files: ['**/*.{ts,tsx,js}'],
            languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
            plugins: { linker: { rules: { loading: loadingImports } } },
            rules: { 'linker/loading': 'error' },
          },
        ],
        { filename },
      )
      .filter((x) => x.ruleId === 'linker/loading');
  }
  it.each([
    "import { ThinkingOrb } from 'thinking-orbs'",
    "export { ThinkingOrb } from 'thinking-orbs'",
    "export * from 'thinking-orbs/engine'",
    "const orb = import('thinking-orbs')",
    "const orb = require('thinking-orbs')",
    "import { LoadingOrb } from '@/components/ui/loading-orb'",
    "import { LoadingOrb } from '../../components/ui/loading-orb'",
  ])('rejects bypass: %s', (code) => expect(errors(code)).toHaveLength(1));

  it('allows only the renderer/entry boundaries and ordinary shared callers', () => {
    expect(
      errors("import { ThinkingOrb } from 'thinking-orbs'", 'src/components/ui/loading-orb.tsx'),
    ).toEqual([]);
    expect(
      errors(
        "import { LoadingOrb } from './loading-orb'",
        'src/components/ui/loading-indicator.tsx',
      ),
    ).toEqual([]);
    expect(errors("import { LoadingIndicator } from '@/components/ui/loading-indicator'")).toEqual(
      [],
    );
  });
});
