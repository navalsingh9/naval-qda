const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fc = require('fast-check');
const { splitParagraphs, buildParagraphIndex } = require('./sources');

describe('splitParagraphs (property-based)', () => {
  it('never throws on arbitrary string input', () => {
    fc.assert(
      fc.property(fc.string(), (text) => {
        assert.doesNotThrow(() => splitParagraphs(text));
      })
    );
  });

  it('never returns an empty-string paragraph', () => {
    fc.assert(
      fc.property(fc.string(), (text) => {
        const paragraphs = splitParagraphs(text);
        return paragraphs.every((p) => p.length > 0);
      })
    );
  });

  it('every paragraph is a substring of the CRLF-normalized input', () => {
    fc.assert(
      fc.property(fc.string(), (text) => {
        const normalized = text.replace(/\r\n/g, '\n').trim();
        const paragraphs = splitParagraphs(text);
        return paragraphs.every((p) => normalized.includes(p));
      })
    );
  });

  it('paragraphs appear in the same left-to-right order as in the normalized input', () => {
    fc.assert(
      fc.property(fc.string(), (text) => {
        const normalized = text.replace(/\r\n/g, '\n').trim();
        const paragraphs = splitParagraphs(text);

        let cursor = 0;
        for (const p of paragraphs) {
          const foundAt = normalized.indexOf(p, cursor);
          if (foundAt === -1) return false;
          cursor = foundAt + p.length;
        }
        return true;
      })
    );
  });

  it('is idempotent: re-splitting the joined output reproduces the same paragraphs', () => {
    fc.assert(
      fc.property(fc.string(), (text) => {
        const first = splitParagraphs(text);
        const rejoined = first.join('\n\n');
        const second = splitParagraphs(rejoined);
        return JSON.stringify(first) === JSON.stringify(second);
      })
    );
  });
});

describe('buildParagraphIndex (property-based)', () => {
  it('never throws on arbitrary string input', () => {
    fc.assert(
      fc.property(fc.string(), (text) => {
        assert.doesNotThrow(() => buildParagraphIndex(text));
      })
    );
  });

  it('returns exactly one offset entry per paragraph from splitParagraphs', () => {
    fc.assert(
      fc.property(fc.string(), (text) => {
        const paragraphs = splitParagraphs(text);
        const offsets = buildParagraphIndex(text);
        return offsets.length === paragraphs.length;
      })
    );
  });

  it('offset indices are sequential starting at 0', () => {
    fc.assert(
      fc.property(fc.string(), (text) => {
        const offsets = buildParagraphIndex(text);
        return offsets.every((entry, i) => entry.index === i);
      })
    );
  });

  it("each entry's text matches the corresponding splitParagraphs() output", () => {
    fc.assert(
      fc.property(fc.string(), (text) => {
        const paragraphs = splitParagraphs(text);
        const offsets = buildParagraphIndex(text);
        return offsets.every((entry, i) => entry.text === paragraphs[i]);
      })
    );
  });

  it('startOffset is always a non-negative integer', () => {
    fc.assert(
      fc.property(fc.string(), (text) => {
        const offsets = buildParagraphIndex(text);
        return offsets.every((entry) => Number.isInteger(entry.startOffset) && entry.startOffset >= 0);
      })
    );
  });

  it(
    'when the raw content has no CRLF, startOffset always points at a real ' +
      'match of the paragraph text (documents the known gap: paragraphs are ' +
      'derived from \\r\\n-normalized text, but indexOf searches the raw ' +
      'content, so CRLF input can silently fall back to an inexact offset)',
    () => {
      fc.assert(
        fc.property(
          fc.string().filter((text) => !text.includes('\r')),
          (text) => {
            const offsets = buildParagraphIndex(text);
            return offsets.every(
              (entry) => text.slice(entry.startOffset, entry.startOffset + entry.text.length) === entry.text
            );
          }
        )
      );
    }
  );

  it('offsets are non-decreasing across successive paragraphs', () => {
    fc.assert(
      fc.property(fc.string(), (text) => {
        const offsets = buildParagraphIndex(text);
        for (let i = 1; i < offsets.length; i += 1) {
          if (offsets[i].startOffset < offsets[i - 1].startOffset) return false;
        }
        return true;
      })
    );
  });
});
