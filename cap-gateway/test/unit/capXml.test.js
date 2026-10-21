import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readAlert } from '../support/files.mjs';
import {
  TRANSLATABLE_FIELDS,
  findInfoBlocks,
  textContent,
  escapeXmlText,
  isEnglish,
  buildEnglishCopy,
  appendAfterLastInfo,
} from '../../responder-microservices/services/capXml.js';

test('translatable fields are exactly the CAP free-text <info> fields', () => {
  assert.deepEqual([...TRANSLATABLE_FIELDS].sort(), [
    'areaDesc',
    'audience',
    'contact',
    'description',
    'event',
    'headline',
    'instruction',
    'resourceDesc',
    'senderName',
  ]);
});

test('findInfoBlocks returns one block per <info> with language and free-text fields', () => {
  const xml = readAlert('alert-ro.xml');
  const [block, ...rest] = findInfoBlocks(xml);
  assert.equal(rest.length, 0);
  assert.equal(block.language, 'ro-RO');
  assert.equal(xml.slice(block.start, block.start + 6), '<info>');
  assert.equal(xml.slice(block.end - 7, block.end), '</info>');
  assert.deepEqual(
    block.fields.map(f => f.key),
    ['event', 'headline', 'description', 'instruction', 'areaDesc']
  );
  assert.equal(block.fields.find(f => f.key === 'areaDesc').text, 'Județul Exemplu');
});

test('a Finnish alert is one fi-FI block whose free text keeps its letters (ä, ö)', () => {
  const [block, ...rest] = findInfoBlocks(readAlert('alert-fi.xml'));
  assert.equal(rest.length, 0);
  assert.equal(block.language, 'fi-FI');
  assert.deepEqual(
    block.fields.map(f => f.key),
    ['event', 'headline', 'description', 'instruction', 'areaDesc']
  );
  assert.equal(block.fields.find(f => f.key === 'headline').text, 'Tulvavaroitus');
  assert.match(block.fields.find(f => f.key === 'instruction').text, /matalalla sijaitsevilta alueilta ja siirtykää/);
});

test('a missing <language> is reported as en-US (CAP 1.2 default)', () => {
  const [block] = findInfoBlocks(readAlert('no-language.xml'));
  assert.equal(block.language, 'en-US');
  assert.equal(block.languageRange, null);
});

test('enumerated, coded and geometric fields are never selected for translation', () => {
  const [block] = findInfoBlocks(readAlert('rich-ro.xml'));
  assert.deepEqual(
    block.fields.map(f => f.key),
    [
      'event',
      'audience',
      'senderName',
      'headline',
      'description',
      'instruction',
      'contact',
      'resourceDesc',
      'areaDesc.1',
      'areaDesc.2',
    ]
  );
});

test('several blocks are found in document order', () => {
  const blocks = findInfoBlocks(readAlert('mixed-ro-fr.xml'));
  assert.deepEqual(
    blocks.map(b => b.language),
    ['ro-RO', 'fr-FR']
  );
});

test('comments and CDATA cannot fake markup; CDATA and entities are decoded', () => {
  const [block] = findInfoBlocks(readAlert('cdata-utf8.xml'));
  const byKey = Object.fromEntries(block.fields.map(f => [f.key, f.text]));
  assert.equal(byKey.headline, 'Avertizare de caniculă & secetă');
  assert.match(byKey.description, /^Temperaturi de peste 40 °C .* > 80 & disconfort/);
});

test('namespace prefixes are supported', () => {
  const [block] = findInfoBlocks(readAlert('prefixed-ro.xml'));
  assert.equal(block.language, 'ro-RO');
  assert.equal(block.fields.length, 5);
});

test('self-closing and empty elements are not fields', () => {
  const xml =
    '<alert><info><language>ro</language><event>E</event><headline/><description> </description></info></alert>';
  assert.deepEqual(
    findInfoBlocks(xml)[0].fields.map(f => f.key),
    ['event']
  );
});

test('an alert without <info> has no blocks', () => {
  assert.deepEqual(findInfoBlocks('<alert><identifier>x</identifier></alert>'), []);
});

test('textContent decodes character references and drops comments', () => {
  assert.equal(textContent('a&#x41;&#66;&lt;&gt;&amp;&quot;&apos;<!-- c -->b'), 'aAB<>&"\'b');
  assert.equal(textContent('x<![CDATA[<&>]]>y'), 'x<&>y');
});

test('escapeXmlText escapes markup and drops XML-illegal characters', () => {
  assert.equal(escapeXmlText('a < b & c > d\u0001\u000b'), 'a &lt; b &amp; c &gt; d');
  assert.equal(escapeXmlText('tab\tnew\nline'), 'tab\tnew\nline');
});

test('isEnglish accepts en and en-* only', () => {
  for (const l of ['en', 'en-US', 'EN-gb']) assert.ok(isEnglish(l), l);
  for (const l of ['eng', 'ro', 'fr-FR', 'fi-FI', 'enx']) assert.ok(!isEnglish(l), l);
});

test('buildEnglishCopy sets en-US and replaces only the field contents', () => {
  const xml = readAlert('alert-ro.xml');
  const [block] = findInfoBlocks(xml);
  const translations = Object.fromEntries(block.fields.map(f => [f.key, `EN:${f.key} <&>`]));
  const copy = buildEnglishCopy(xml, block, translations);
  assert.match(copy, /<language>en-US<\/language>/);
  assert.match(copy, /<description>EN:description &lt;&amp;&gt;<\/description>/);
  assert.match(copy, /<category>Met<\/category>/);
  assert.equal(copy.split('\n').length, xml.slice(block.start, block.end).split('\n').length);
});

test('appendAfterLastInfo inserts after the last block and leaves the original bytes intact', () => {
  const xml = readAlert('multi-ro.xml');
  const blocks = findInfoBlocks(xml);
  const out = appendAfterLastInfo(xml, blocks.at(-1), ['<info>A</info>', '<info>B</info>']);
  const at = blocks.at(-1).end;
  const inserted = '\n  <info>A</info>\n  <info>B</info>';
  assert.equal(out.slice(at, at + inserted.length), inserted);
  assert.equal(out.slice(0, at) + out.slice(at + inserted.length), xml);
});

test('appendAfterLastInfo keeps CRLF line ends and single-line documents compact', () => {
  const crlf = '<alert>\r\n  <info>x</info>\r\n</alert>';
  assert.equal(
    appendAfterLastInfo(crlf, findInfoBlocks(crlf)[0], ['<info>y</info>']),
    '<alert>\r\n  <info>x</info>\r\n  <info>y</info>\r\n</alert>'
  );
  const flat = '<alert><info>x</info></alert>';
  assert.equal(
    appendAfterLastInfo(flat, findInfoBlocks(flat)[0], ['<info>y</info>']),
    '<alert><info>x</info><info>y</info></alert>'
  );
});
