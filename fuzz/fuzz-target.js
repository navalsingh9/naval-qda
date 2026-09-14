const { splitParagraphs, buildParagraphIndex } = require('../backend/sources');

module.exports.fuzz = function (data) {
  const text = data.toString('utf8');

  try {
    splitParagraphs(text);
    buildParagraphIndex(text);
  } catch (e) {
    // Thrown errors are fine; only crashes/hangs/timeouts are bugs.
  }
};
