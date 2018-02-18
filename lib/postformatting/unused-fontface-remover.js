'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = unusedFontfaceRemover;

var _cssTree = require('css-tree');

var _cssTree2 = _interopRequireDefault(_cssTree);

var _debug = require('debug');

var _debug2 = _interopRequireDefault(_debug);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const debuglog = (0, _debug2.default)('penthouse:css-cleanup:unused-font-face-remover');

function decodeFontName(node) {
  let name = _cssTree2.default.generate(node);
  // TODO: use string decode
  if (name[0] === '"' || name[0] === "'") {
    name = name.substr(1, name.length - 2);
  }
  return name;
}

function getAllFontNameValues(ast) {
  const fontNameValues = new Set();

  debuglog('getAllFontNameValues');
  _cssTree2.default.walk(ast, {
    visit: 'Declaration',
    enter: function enter(node) {
      // walker pass through `font-family` declarations inside @font-face too
      // this condition filters them, to walk through declarations inside a rules only
      if (this.rule) {
        _cssTree2.default.lexer.findDeclarationValueFragments(node, 'Type', 'family-name').forEach(entry => {
          const familyName = decodeFontName({
            type: 'Value',
            children: entry.nodes
          });
          debuglog('found used font-family: ' + familyName);
          fontNameValues.add(familyName);
        });
      }
    }
  });
  debuglog('getAllFontNameValues AFTER');

  return fontNameValues;
}

function unusedFontfaceRemover(ast) {
  const fontNameValues = getAllFontNameValues(ast);

  // remove @font-face at-rule when:
  // - it's never unused
  // - has no a `src` descriptor
  _cssTree2.default.walk(ast, {
    visit: 'Atrule',
    enter: (atrule, atruleItem, atruleList) => {
      if (_cssTree2.default.keyword(atrule.name).basename !== 'font-face') {
        return;
      }

      let hasSrc = false;
      let used = true;

      _cssTree2.default.walk(atrule, {
        visit: 'Declaration',
        enter: declaration => {
          const name = _cssTree2.default.property(declaration.property).name;

          if (name === 'font-family') {
            const familyName = decodeFontName(declaration.value);

            // was this @font-face used?
            if (!fontNameValues.has(familyName)) {
              debuglog('drop unused @font-face: ' + familyName);
              used = false;
            }
          } else if (name === 'src') {
            hasSrc = true;
          }
        }
      });

      if (!used || !hasSrc) {
        if (used && !hasSrc) {
          debuglog('drop @font-face with no src descriptor');
        }
        atruleList.remove(atruleItem);
      }
    }
  });
}