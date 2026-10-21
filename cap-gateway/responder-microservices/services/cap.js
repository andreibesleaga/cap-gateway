import { XMLParser } from 'fast-xml-parser';
import { findInfoBlocks, isEnglish, buildEnglishCopy, appendAfterLastInfo } from './capXml.js';

// Result of every call: { translation, message, reason? }
//   translation: 'translated' | 'passthrough' | 'failed'  (sent to clients as the X-Translation header)
//   message:     the alert as XML text, or as a parsed object when exportJson is true
// The original alert is never modified: 'translated' appends en-US <info> copies, the other two return it as is.

// values are kept as strings so identifiers, dates and the XML declaration round-trip unchanged
const parser = new XMLParser({
  attributeNamePrefix: '@_',
  ignoreAttributes: false,
  parseAttributeValue: false,
  parseTagValue: false,
  trimValues: true,
});

const sameLanguage = (a, b) => a.toLowerCase() === b.toLowerCase();

/**
 * Chooses which <info> blocks get an English copy (see docs/adr/0001-append-english-info-block.md):
 * none if the alert has no <info> or already has an English one (a missing <language> is en-US);
 * otherwise every block in the language of the first <info>, the alert's first language sequence.
 */
export function selectSourceBlocks(blocks) {
  if (blocks.length === 0) return { reason: 'no <info> block' };
  if (blocks.some(b => isEnglish(b.language))) return { reason: 'English <info> present' };
  const source = blocks[0].language;
  return { source, selected: blocks.filter(b => sameLanguage(b.language, source)) };
}

export function createCapService({ engine, logger }) {
  const reply = (translation, xml, exportJson, reason) => ({
    translation,
    message: exportJson ? parser.parse(xml) : xml,
    ...(reason ? { reason } : {}),
  });

  async function translate(xml, exportJson = false) {
    const blocks = findInfoBlocks(xml);
    const { source, selected, reason } = selectSourceBlocks(blocks);
    if (!selected) {
      logger.info('translate: passthrough (%s)', reason);
      return reply('passthrough', xml, exportJson, reason);
    }

    let translations;
    try {
      // one engine call per block, all blocks in parallel; any failure fails the whole alert
      translations = await Promise.all(
        selected.map(b =>
          b.fields.length ? engine.translate(source, Object.fromEntries(b.fields.map(f => [f.key, f.text]))) : {}
        )
      );
    } catch (error) {
      const why = error.reason ?? error.message;
      logger.warn('translate: failed (%s, engine %s, %s)', source, engine.name, why);
      return reply('failed', xml, exportJson, `engine ${engine.name}: ${why}`);
    }

    const copies = selected.map((b, i) => buildEnglishCopy(xml, b, translations[i]));
    const out = appendAfterLastInfo(xml, blocks.at(-1), copies);
    logger.info('translate: translated (%s, %d block(s), engine %s)', source, copies.length, engine.name);
    return reply('translated', out, exportJson);
  }

  return { translate };
}
