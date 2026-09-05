import { readFile, writeFile } from 'node:fs/promises';

const path = 'src/projections/markdown.js';
let text = await readFile(path, 'utf8');

const oldMetadata = `/**
 * Renders a transcript heading with optional consumer-supplied projection metadata.
 *
 * @param {Object<string, *>} event - The canonical event whose source projection metadata is being used.
 * @param {string} label - The canonical Markdown heading label before consumer decoration.
 * @returns {string} The heading with consumer-specific ANSI colour and suffix metadata applied.
 */
function projectedHeadingMetadataSuffix(event) {
  const projection = event?.projection ?? {};
  const metadata = projection.heading_metadata ?? {};
  const colors = projection.colors ?? {};
  const reset = colors.reset ?? '';
  const styled = (text, colorName) => {
    const color = colors[colorName] ?? '';
    return color ? \`\${color}\${text}\${reset}\` : text;
  };
`;
const newMetadata = `/**
 * Renders the optional consumer-supplied projection metadata suffix for a transcript heading.
 *
 * @param {Object<string, *>} event - The canonical event whose source projection metadata is being used.
 * @returns {string} Consumer-specific heading metadata suffix with configured ANSI decoration applied.
 */
function projectedHeadingMetadataSuffix(event) {
  const projection = event?.projection ?? {};
  const metadata = projection.heading_metadata ?? {};
  const colors = projection.colors ?? {};
  const reset = colors.reset ?? '';
  /**
   * Applies one optional projection colour to generated heading metadata.
   *
   * @param {string} text - Heading-metadata text to decorate.
   * @param {string} colorName - Projection colour-map key used for the metadata field.
   * @returns {string} Styled metadata text, or the original text when no colour is configured.
   */
  const styled = (text, colorName) => {
    const color = colors[colorName] ?? '';
    return color ? \`\${color}\${text}\${reset}\` : text;
  };
`;
if (!text.includes(oldMetadata)) throw new Error('Metadata JSDoc target not found.');
text = text.replace(oldMetadata, newMetadata);

const declaration = 'function projectedHeading(event, label) {';
const documentedDeclaration = `/**
 * Renders a canonical transcript heading with optional consumer projection decoration.
 *
 * @param {Object<string, *>} event - Canonical event supplying projection colours and metadata.
 * @param {string} label - Canonical Markdown heading label before consumer decoration.
 * @returns {string} Heading text with configured colour and metadata suffix applied.
 */
function projectedHeading(event, label) {`;
if (!text.includes(declaration)) throw new Error('Heading JSDoc target not found.');
text = text.replace(declaration, documentedDeclaration);

await writeFile(path, text, 'utf8');
