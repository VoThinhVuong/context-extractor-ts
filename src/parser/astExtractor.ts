import Parser from 'tree-sitter';
import path from 'path';
import { readFileContent } from '../utils/fileHelpers';

// tree-sitter language packages ship native bindings without TS types; use any.
/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */
type TsLang = any;
const JavaScript: TsLang = require('tree-sitter-javascript');
const { typescript: TypeScript, tsx: TSX }: { typescript: TsLang; tsx: TsLang } =
  require('tree-sitter-typescript');
const Python: TsLang = require('tree-sitter-python');
const Go: TsLang = require('tree-sitter-go');
const Java: TsLang = require('tree-sitter-java');

export interface ParsedFile {
  filePath: string;
  language: string;
  signatures: string[];
  rawSkeletonText: string;
}

type LanguageKey = 'typescript' | 'tsx' | 'javascript' | 'jsx' | 'python' | 'go' | 'java';

const LANGUAGE_MAP: Record<LanguageKey, TsLang> = {
  typescript: TypeScript,
  tsx: TSX,
  javascript: JavaScript,
  jsx: JavaScript,
  python: Python,
  go: Go,
  java: Java,
};

const EXT_TO_LANGUAGE: Record<string, LanguageKey> = {
  '.ts': 'typescript',
  '.tsx': 'tsx',
  '.js': 'javascript',
  '.jsx': 'jsx',
  '.py': 'python',
  '.go': 'go',
  '.java': 'java',
};

/** Top-level declaration node types worth extracting per language. */
const DECLARATION_TYPES: Record<LanguageKey, Set<string>> = {
  typescript: new Set([
    'function_declaration',
    'class_declaration',
    'interface_declaration',
    'type_alias_declaration',
    'enum_declaration',
    'abstract_class_declaration',
    'export_statement',
  ]),
  tsx: new Set([
    'function_declaration',
    'class_declaration',
    'interface_declaration',
    'type_alias_declaration',
    'enum_declaration',
    'export_statement',
  ]),
  javascript: new Set([
    'function_declaration',
    'class_declaration',
    'export_statement',
    'lexical_declaration',
    'variable_declaration',
  ]),
  jsx: new Set([
    'function_declaration',
    'class_declaration',
    'export_statement',
    'lexical_declaration',
  ]),
  python: new Set(['function_definition', 'class_definition', 'decorated_definition']),
  go: new Set([
    'function_declaration',
    'method_declaration',
    'type_declaration',
    'var_declaration',
    'const_declaration',
  ]),
  java: new Set([
    'class_declaration',
    'interface_declaration',
    'method_declaration',
    'enum_declaration',
    'record_declaration',
  ]),
};

/** Node types representing an implementation body — signature ends where these begin. */
const BODY_NODE_TYPES = new Set([
  'statement_block', // JS/TS function/method body
  'block',           // Go/Java block
  'class_body',      // JS/TS class body
  'declaration_list', // Go var/const group
  'suite',           // Python indented block
]);

/**
 * Returns the signature of a node — the source text up to (not including) its body block.
 * Falls back to the first line of the node if no body block child is found.
 */
function extractSignature(node: Parser.SyntaxNode, source: string): string {
  let endIndex = node.endIndex;

  for (const child of node.children) {
    if (BODY_NODE_TYPES.has(child.type)) {
      endIndex = child.startIndex;
      break;
    }
  }

  const raw = source.slice(node.startIndex, endIndex).trim();
  return raw.split('\n')[0].trim(); // First line only keeps signatures compact
}

/**
 * Walks the direct children of a syntax node and collects signatures for
 * children whose type appears in the allowed set.
 */
function collectSignatures(
  node: Parser.SyntaxNode,
  allowedTypes: Set<string>,
  source: string,
): string[] {
  const sigs: string[] = [];

  for (const child of node.children) {
    if (allowedTypes.has(child.type)) {
      const sig = extractSignature(child, source);
      if (sig.length > 2) {
        sigs.push(sig);
      }
    }
  }

  return sigs;
}

/**
 * Parses a source file with tree-sitter and extracts top-level declaration signatures.
 * Returns a ParsedFile with the detected language, signature list, and raw skeleton text.
 * Throws if the file extension is unsupported or the file cannot be read.
 */
export async function extractFileSignatures(filePath: string): Promise<ParsedFile> {
  const ext = path.extname(filePath).toLowerCase();
  const langKey = EXT_TO_LANGUAGE[ext];

  if (!langKey) {
    throw new Error(`Unsupported file extension "${ext}" for path: ${filePath}`);
  }

  const source = await readFileContent(filePath);
  const language = LANGUAGE_MAP[langKey];
  const allowedTypes = DECLARATION_TYPES[langKey];

  const parser = new Parser();
  parser.setLanguage(language);
  const tree = parser.parse(source);

  const signatures = collectSignatures(tree.rootNode, allowedTypes, source);
  const rawSkeletonText = signatures.join('\n');

  return { filePath, language: langKey, signatures, rawSkeletonText };
}
