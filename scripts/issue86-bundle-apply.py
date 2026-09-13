from pathlib import Path


def replace_once(text, old, new, label):
  count = text.count(old)
  if count != 1:
    raise RuntimeError(f'{label}: expected exactly one match, found {count}')
  return text.replace(old, new, 1)


# Public HTML must carry the same heading projection options as Markdown.
path = Path('src/projections/html-visibility.js')
text = path.read_text(encoding='utf-8')
text = replace_once(
  text,
  '  const presentation = buildCanonicalPresentation(projectedEvents);',
  '  const presentation = buildCanonicalPresentation(projectedEvents, options);',
  'HTML visibility presentation options'
)
text = replace_once(
  text,
  '  return renderBaseHtmlUnits(projectedEvents).map(unit => {',
  '  return renderBaseHtmlUnits(projectedEvents, options).map(unit => {',
  'HTML visibility base options'
)
path.write_text(text, encoding='utf-8')

# Keep the classic browser bundle on the same public projection chain as ESM.
path = Path('scripts/build-browser-bundle.mjs')
text = path.read_text(encoding='utf-8')
text = replace_once(
  text,
  """    markdownSource,
    presentationSource,
    revisionVisibilitySource,
    presentationRevisionsSource,
""",
  """    styleSource,
    headingMetadataSource,
    markdownSource,
    markdownRevisionsSource,
    markdownVisibilitySource,
    presentationSource,
    revisionVisibilitySource,
    presentationRevisionsSource,
""",
  'bundle source variable list'
)
text = replace_once(
  text,
  """    readFile(resolve(ROOT, 'src/projections/markdown.js'), 'utf8'),
    readFile(resolve(ROOT, 'src/projections/presentation.js'), 'utf8'),
    readFile(resolve(ROOT, 'src/projections/revision-visibility.js'), 'utf8'),
    readFile(resolve(ROOT, 'src/projections/presentation-revisions.js'), 'utf8'),
""",
  """    readFile(resolve(ROOT, 'src/projections/style.js'), 'utf8'),
    readFile(resolve(ROOT, 'src/projections/heading-metadata.js'), 'utf8'),
    readFile(resolve(ROOT, 'src/projections/markdown.js'), 'utf8'),
    readFile(resolve(ROOT, 'src/projections/markdown-revisions.js'), 'utf8'),
    readFile(resolve(ROOT, 'src/projections/markdown-visibility.js'), 'utf8'),
    readFile(resolve(ROOT, 'src/projections/presentation.js'), 'utf8'),
    readFile(resolve(ROOT, 'src/projections/revision-visibility.js'), 'utf8'),
    readFile(resolve(ROOT, 'src/projections/presentation-revisions.js'), 'utf8'),
""",
  'bundle source reads'
)
text = replace_once(
  text,
  """  const markdown = moduleBody(markdownSource, {
    exportedFunction: 'renderCanonicalMarkdown',
    localFunction: 'renderCanonicalMarkdown'
  });
""",
  """  let style = multiExportModuleBody(styleSource, [
    'getDefaultProjectionTheme',
    'configureProjectionTheme',
    'resetProjectionTheme',
    'resolveProjectionTheme'
  ]);
  style = replaceOnce(
    style,
    'export const STYLE_ROLES',
    'const STYLE_ROLES',
    'STYLE_ROLES export'
  );
  const headingMetadata = multiExportModuleBody(
    headingMetadataSource,
    [
      'resolveHeadingPolicy',
      'formatHeadingTimestamp',
      'deriveHeadingMetadata',
      'withCoreHeadingMetadata',
      'headingMetadataComponents',
      'renderHeadingDebugComment'
    ],
    ["import { STYLE_ROLES } from './style.js';"]
  );
  const markdownBase = moduleBody(markdownSource, {
    importLines: [
      "import { renderHeadingDebugComment } from './heading-metadata.js';"
    ],
    exportedFunction: 'renderCanonicalMarkdown',
    localFunction: 'renderBaseMarkdown'
  });
  const markdownRevisions = moduleBody(markdownRevisionsSource, {
    importLines: [
      "import { renderCanonicalMarkdown as renderBaseMarkdown } from './markdown.js';"
    ],
    exportedFunction: 'renderCanonicalMarkdown',
    localFunction: 'renderRevisionMarkdown'
  });
  const markdownVisibility = moduleBody(markdownVisibilitySource, {
    importLines: [
      "import { withCoreHeadingMetadata } from './heading-metadata.js';",
      "import { renderCanonicalMarkdown as renderRevisionMarkdown } from './markdown-revisions.js';",
      "import { projectRevisionVisibility } from './revision-visibility.js';"
    ],
    exportedFunction: 'renderCanonicalMarkdown',
    localFunction: 'renderCanonicalMarkdown'
  });
""",
  'bundle Markdown projection chain'
)
text = replace_once(
  text,
  """    importLines: [
      "import { buildCanonicalPresentation as buildBasePresentation } from './presentation.js';",
      "import { isHistoricalRevision } from './revision-visibility.js';"
    ],
""",
  """    importLines: [
      "import { deriveHeadingMetadata } from './heading-metadata.js';",
      "import { buildCanonicalPresentation as buildBasePresentation } from './presentation.js';",
      "import { isHistoricalRevision } from './revision-visibility.js';"
    ],
""",
  'bundle presentation heading import'
)
text = replace_once(
  text,
  """  let htmlBase = multiExportModuleBody(
    htmlSource,
    [
      'renderCanonicalBlockHtml',
      'renderCanonicalHtmlUnits',
      'renderCanonicalHtml'
    ],
    [
      "import { marked } from 'marked';",
      "import { buildCanonicalPresentation } from './presentation-revisions.js';"
    ]
  );
""",
  """  let htmlPrepared = htmlSource;
  htmlPrepared = removeImportBlock(
    htmlPrepared,
    "import {\n  headingMetadataComponents,\n  renderHeadingDebugComment\n} from './heading-metadata.js';",
    './heading-metadata.js'
  );
  let htmlBase = multiExportModuleBody(
    htmlPrepared,
    [
      'renderCanonicalBlockHtml',
      'renderCanonicalHtmlUnits',
      'renderCanonicalHtml'
    ],
    [
      "import { marked } from 'marked';",
      "import { buildCanonicalPresentation } from './presentation-revisions.js';",
      "import { resolveProjectionTheme, STYLE_ROLES } from './style.js';"
    ]
  );
""",
  'bundle HTML imports'
)
text = replace_once(
  text,
  """    'function renderCanonicalHtmlUnits(events)',
    'function renderBaseHtmlUnits(events)',
""",
  """    'function renderCanonicalHtmlUnits(events, options = {})',
    'function renderBaseHtmlUnits(events, options = {})',
""",
  'bundle HTML unit signature'
)
text = replace_once(
  text,
  """    'function renderCanonicalHtml(events)',
    'function renderBaseHtml(events)',
""",
  """    'function renderCanonicalHtml(events, options = {})',
    'function renderBaseHtml(events, options = {})',
""",
  'bundle HTML signature'
)
text = replace_once(
  text,
  """    'return renderCanonicalHtmlUnits(events)',
    'return renderBaseHtmlUnits(events)',
""",
  """    'return renderCanonicalHtmlUnits(events, options)',
    'return renderBaseHtmlUnits(events, options)',
""",
  'bundle HTML call'
)
text = replace_once(
  text,
  """    `// - src/projections/markdown.js\n` +
    `// - src/projections/presentation.js\n` +
""",
  """    `// - src/projections/style.js\n` +
    `// - src/projections/heading-metadata.js\n` +
    `// - src/projections/markdown.js\n` +
    `// - src/projections/markdown-revisions.js\n` +
    `// - src/projections/markdown-visibility.js\n` +
    `// - src/projections/presentation.js\n` +
""",
  'bundle source comments'
)
text = replace_once(
  text,
  """    `${turns}\n\n` +
    `${markdown}\n\n` +
    `${presentation}\n\n` +
    `${revisionVisibility}\n\n` +
    `${presentationRevisions}\n\n` +
""",
  """    `${turns}\n\n` +
    `${style}\n\n` +
    `${headingMetadata}\n\n` +
    `${markdownBase}\n\n` +
    `${markdownRevisions}\n\n` +
    `${presentation}\n\n` +
    `${revisionVisibility}\n\n` +
    `${markdownVisibility}\n\n` +
    `${presentationRevisions}\n\n` +
""",
  'bundle source bodies'
)
path.write_text(text, encoding='utf-8')
