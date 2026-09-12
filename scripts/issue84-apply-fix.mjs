import { readFile, writeFile } from 'node:fs/promises';

const path = 'src/projections/html.js';
let source = await readFile(path, 'utf8');

const oldImport = "import { marked } from 'marked';";
const newImport = "import { marked, Renderer } from 'marked';";
if (!source.includes(oldImport)) {
  throw new Error('Expected marked import was not found.');
}
source = source.replace(oldImport, newImport);

const oldRender = `function renderMarkdown(markdown) {\n  const html = String(marked.parse(String(markdown ?? ''), {\n    async: false,\n    breaks: false,\n    gfm: true\n  }));\n  return annotateOrderedListOrdinals(html);\n}`;
const newRender = `function renderMarkdown(markdown) {\n  const renderer = new Renderer();\n  renderer.html = ({ text }) => htmlEscape(text);\n  const html = String(marked.parse(String(markdown ?? ''), {\n    async: false,\n    breaks: false,\n    gfm: true,\n    renderer\n  }));\n  return annotateOrderedListOrdinals(html);\n}`;
if (!source.includes(oldRender)) {
  throw new Error('Expected renderMarkdown implementation was not found.');
}
source = source.replace(oldRender, newRender);

await writeFile(path, source, 'utf8');
