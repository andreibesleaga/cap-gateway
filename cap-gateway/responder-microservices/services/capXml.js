// Text-level helpers for CAP 1.2 alerts that the gateway has already validated against cap.xsd.
// They locate <info> blocks and their fields by position, so that the original document is never
// re-serialised: the output is the input with new blocks inserted, byte for byte.

// Free-text <info> fields (CAP 1.2 section 3.2.2: "the text describing/naming/denoting ...").
// Everything else (enumerations, codes, dates, URIs, geometry, valueName/value pairs) is copied verbatim.
export const TRANSLATABLE_FIELDS = Object.freeze([
  'event',
  'audience',
  'senderName',
  'headline',
  'description',
  'instruction',
  'contact',
  'resourceDesc',
  'areaDesc',
]);

const NAME = '[A-Za-z_][\\w.-]*';

// Comments, CDATA sections and processing instructions blanked out (same length, so offsets still match)
const mask = xml => xml.replace(/<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>/g, m => ' '.repeat(m.length));

// <prefix:name ...>content</prefix:name>, not self-closing; group 1 = prefix, group 2 = content
const elementRegex = (name, flags = 'g') =>
  new RegExp(`<((?:${NAME}:)?)${name}(?:\\s[^>]*?)?(?<!/)>([\\s\\S]*?)</\\1${name}\\s*>`, flags);

const ENTITIES = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };
const decodeEntities = s =>
  s.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|lt|gt|amp|quot|apos);/g, (_, e) =>
    e[0] === '#' ? String.fromCodePoint(e[1] === 'x' ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : ENTITIES[e]
  );

// Character data of a simple-type element: entities decoded, CDATA unwrapped, comments/PIs dropped
export const textContent = raw =>
  raw
    .replace(/<!--[\s\S]*?-->|<\?[\s\S]*?\?>/g, '')
    .split(/(<!\[CDATA\[[\s\S]*?\]\]>)/)
    .map((part, i) => (i % 2 ? part.slice(9, -3) : decodeEntities(part)))
    .join('');

// Escapes text for element content and drops characters XML 1.0 does not allow
export const escapeXmlText = s =>
  s
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F￾￿]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

// Content range (absolute offsets) of every match of `name` inside [from, to) of the masked document
function contentRanges(masked, name, from, to) {
  const ranges = [];
  const re = elementRegex(name);
  const scope = masked.slice(from, to);
  for (let m = re.exec(scope); m; m = re.exec(scope)) {
    const start = from + m.index + m[0].indexOf('>') + 1;
    ranges.push({ start, end: start + m[2].length });
  }
  return ranges;
}

/**
 * Finds the <info> blocks of an alert in document order.
 * @returns {{start:number,end:number,language:string,languageRange:object|null,fields:object[]}[]}
 *   language is the <language> value ("en-US" when absent, as CAP 1.2 defines); each field is
 *   { key, name, start, end, text } with non-empty text; keys are unique within a block.
 */
export function findInfoBlocks(xml) {
  const masked = mask(xml);
  const blocks = [];
  const re = elementRegex('info');
  for (let m = re.exec(masked); m; m = re.exec(masked)) {
    const start = m.index;
    const end = start + m[0].length;
    const [languageRange = null] = contentRanges(masked, 'language', start, end);
    const language = languageRange ? textContent(xml.slice(languageRange.start, languageRange.end)).trim() : 'en-US';
    const fields = [];
    for (const name of TRANSLATABLE_FIELDS) {
      const found = contentRanges(masked, name, start, end)
        .map(r => ({ ...r, name, text: textContent(xml.slice(r.start, r.end)).trim() }))
        .filter(f => f.text);
      found.forEach((f, i) => fields.push({ ...f, key: found.length > 1 ? `${name}.${i + 1}` : name }));
    }
    blocks.push({ start, end, language, languageRange, fields });
  }
  return blocks;
}

export const isEnglish = language => /^en(-|$)/i.test(language);

// The block's original text with <language> set to en-US and each field replaced by its translation
export function buildEnglishCopy(xml, block, translations) {
  const edits = block.fields.map(f => ({ start: f.start, end: f.end, text: escapeXmlText(translations[f.key]) }));
  if (block.languageRange) edits.push({ ...block.languageRange, text: 'en-US' });
  let out = xml.slice(block.start, block.end);
  for (const e of edits.sort((a, b) => b.start - a.start)) {
    out = out.slice(0, e.start - block.start) + e.text + out.slice(e.end - block.start);
  }
  return out;
}

// Inserts the copies after the last original <info>, each on its own line at the same indentation
export function appendAfterLastInfo(xml, lastBlock, copies) {
  const lineStart = xml.lastIndexOf('\n', lastBlock.start) + 1;
  const indent = xml.slice(lineStart, lastBlock.start);
  const eol = xml.includes('\r\n') ? '\r\n' : '\n';
  const separator = lineStart > 0 && /^[ \t]*$/.test(indent) ? eol + indent : '';
  const inserted = copies.map(copy => separator + copy).join('');
  return xml.slice(0, lastBlock.end) + inserted + xml.slice(lastBlock.end);
}
