// Renders the file templates in .devcontainer/templates into the workspace.
//
// For every file under templates/, the matching workspace file is created by
// substituting {{PLACEHOLDER}} tokens with values from .devcontainer/project.json.
// Existing files are never overwritten, which is what makes a re-run safe.
//
// Placeholders are defined below; add new ones here and use {{NAME}} in templates.

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, extname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url)); // .devcontainer
const root = join(here, '..'); // workspace root
const templatesDir = join(here, 'templates');

const project = JSON.parse(readFileSync(join(here, 'project.json'), 'utf8'));

const placeholders = {
  PROJECT_NAME: project.name,
  PROJECT_TITLE: project.title ?? project.name,
  NPM_SCOPE: project.npmScope ?? `@${project.name}`,
  PNPM_VERSION: project.pnpmVersion ?? '12.11.2',
};

function render(content, relPath) {
  return content.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    if (key in placeholders) return placeholders[key];
    console.warn(`  warn   unknown placeholder ${match} in ${relPath}`);
    return match;
  });
}

// Only render files that are known to be text. Binary assets (for example a
// custom logo.jpg) are copied byte-for-byte so placeholders cannot corrupt them.
const TEXT_EXTENSIONS = new Set([
  '.cjs',
  '.css',
  '.cts',
  '.example',
  '.html',
  '.js',
  '.json',
  '.md',
  '.mjs',
  '.mts',
  '.prisma',
  '.svg',
  '.ts',
  '.tsx',
  '.txt',
  '.yaml',
  '.yml',
]);
const TEXT_BASENAMES = new Set([
  '.env',
  '.gitattributes',
  '.gitignore',
  '.prettierignore',
  '.prettierrc',
  'Dockerfile',
  'Makefile',
]);

function isTextTemplate(file) {
  return TEXT_BASENAMES.has(basename(file)) || TEXT_EXTENSIONS.has(extname(file).toLowerCase());
}

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

let created = 0;
let skipped = 0;

for (const src of walk(templatesDir)) {
  let rel = relative(templatesDir, src);
  // templates/root/* maps to the workspace root, not a "root/" subdirectory.
  if (rel.startsWith(`root${sep}`)) rel = rel.slice(`root${sep}`.length);
  const dest = join(root, rel);
  if (existsSync(dest)) {
    console.log(`  skip   ${rel} (exists)`);
    skipped++;
    continue;
  }
  mkdirSync(dirname(dest), { recursive: true });
  if (isTextTemplate(src)) {
    writeFileSync(dest, render(readFileSync(src, 'utf8'), rel));
  } else {
    copyFileSync(src, dest);
  }
  console.log(`  create ${rel}`);
  created++;
}

console.log(`\nTemplates: ${created} created, ${skipped} skipped`);
