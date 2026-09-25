/**
 * Counts logical text lines without treating a trailing newline as an extra line.
 *
 * @param {string} text - UTF-8 text whose logical line count is required.
 * @returns {number} Number of logical lines in the supplied text.
 */
export function countLogicalLines(text) {
  if (typeof text !== 'string') throw new TypeError('text must be a string.');
  if (!text.length) return 0;
  const lines = text.split(/\r\n|\r|\n/);
  if (lines.at(-1) === '') lines.pop();
  return lines.length;
}

/**
 * Evaluates one maintained file against the repository line-count policy.
 *
 * New/ordinary maintained files use maxLines. Explicit legacy ceilings allow an
 * already-oversized file to remain unchanged, but any growth above its recorded
 * ceiling is a policy violation.
 *
 * @param {Object<string, *>} input - File-size policy facts.
 * @param {string} input.path - Repository-relative file path.
 * @param {number} input.lineCount - Current logical line count.
 * @param {number} input.maxLines - Normal maintained-file line limit.
 * @param {Object<string, number>} input.legacyMaxLines - Explicit legacy ceilings by path.
 * @returns {string[]} Human-readable policy violations; empty means compliant.
 */
export function evaluateFileSizePolicy({ path, lineCount, maxLines, legacyMaxLines }) {
  if (typeof path !== 'string' || !path) return ['file path is required'];
  if (!Number.isInteger(lineCount) || lineCount < 0) return [`${path}: invalid line count`];
  if (!Number.isInteger(maxLines) || maxLines < 1) return [`${path}: invalid max line policy`];

  const legacyCeiling = legacyMaxLines?.[path];
  if (Number.isInteger(legacyCeiling)) {
    if (lineCount <= legacyCeiling) return [];
    return [`${path}: ${lineCount} lines exceeds recorded legacy ceiling ${legacyCeiling}; split before growth`];
  }
  if (lineCount <= maxLines) return [];
  return [`${path}: ${lineCount} lines exceeds maintained-file limit ${maxLines}; split by responsibility`];
}
