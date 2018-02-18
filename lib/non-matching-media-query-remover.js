'use strict';

var _cssTree = require('css-tree');

var _cssTree2 = _interopRequireDefault(_cssTree);

var _cssMediaquery = require('css-mediaquery');

var _cssMediaquery2 = _interopRequireDefault(_cssMediaquery);

var _debug = require('debug');

var _debug2 = _interopRequireDefault(_debug);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const debuglog = (0, _debug2.default)('penthouse:preformatting:nonMatchingMediaQueryRemover');

// only filters out:
//  - @print
//  - min-width > width OR min-height > height
// and the latter only if !keepLargerMediaQueries (which is the default)
function _isMatchingMediaQuery(mediaQuery, matchConfig) {
  // TODO: use the media query parsing from css-tree instead
  let mediaAST;
  try {
    mediaAST = _cssMediaquery2.default.parse(mediaQuery);
  } catch (e) {
    // cant parse, most likely browser cant either
    return false;
  }

  var keep = mediaAST.some(function (mq) {
    // not sure why css-mediaquery library sometimes flags the inverse as type,
    // rather than the inverse field, but for our purposes we want to treat
    // them the same.
    const isInverse = mq.inverse || mq.type === 'not';
    if (!isInverse && mq.type === 'print' || isInverse && mq.type === 'screen') {
      return false;
    }
    // f.e. @media all {}
    // go for false positives over false negatives,
    // i.e. accept @media randomThing {}
    if (mq.expressions.length === 0) {
      return true;
    }
    return mq.expressions.some(function ({ modifier, feature, value }) {
      if (modifier === 'min') {
        const constructedQuery = `${isInverse ? 'not ' : ''}(min-${feature}: ${value})`;
        return _cssMediaquery2.default.match(constructedQuery, matchConfig);
      } else {
        return true;
      }
    });
  });

  return keep;
}

function nonMatchingMediaQueryRemover(ast, width, height, keepLargerMediaQueries) {
  debuglog('BEFORE');
  const matchConfig = {
    type: 'screen',
    width: (keepLargerMediaQueries ? 9999999999 : width) + 'px',
    height: (keepLargerMediaQueries ? 9999999999 : height) + 'px'
  };
  debuglog('matchConfig: ' + JSON.stringify(matchConfig, null, 2));

  _cssTree2.default.walk(ast, {
    visit: 'Atrule',
    enter: (atrule, item, list) => {
      // ignore (keep) all non media query rules
      if (_cssTree2.default.keyword(atrule.name).name !== 'media') {
        return;
      }
      // this can happen - why? (atrule.prelude === null)
      // and should we remove this rule here, or keep it?
      if (!atrule.prelude) {
        return;
      }
      const mediaQuery = _cssTree2.default.generate(atrule.prelude);
      const isMatching = _isMatchingMediaQuery(mediaQuery, matchConfig);
      if (!isMatching) {
        debuglog('DROP: ' + `(${mediaQuery}), `);
        list.remove(item);
      }
    }
  });

  return ast;
}

module.exports = nonMatchingMediaQueryRemover;