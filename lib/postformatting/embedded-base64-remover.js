'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = embeddedbase64Remover;

var _cssTree = require('css-tree');

var _cssTree2 = _interopRequireDefault(_cssTree);

var _debug = require('debug');

var _debug2 = _interopRequireDefault(_debug);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const debuglog = (0, _debug2.default)('penthouse:css-cleanup:embeddedbase64Remover');

const BASE64_ENCODE_PATTERN = /data:[^,]*;base64,/;

function embeddedbase64Remover(ast, maxEmbeddedBase64Length) {
  debuglog('config: maxEmbeddedBase64Length = ' + maxEmbeddedBase64Length);
  _cssTree2.default.walk(ast, {
    visit: 'Declaration',
    enter: (declaration, item, list) => {
      let tooLong = false;

      _cssTree2.default.walk(declaration, {
        visit: 'Url',
        enter: function enter(url) {
          const value = url.value.value;
          if (BASE64_ENCODE_PATTERN.test(value) && value.length > maxEmbeddedBase64Length) {
            tooLong = true;
          }
        }
      });

      if (tooLong) {
        const value = _cssTree2.default.generate(declaration.value);
        debuglog('DROP: ' + `${declaration.property}: ${value.slice(0, 50)}..., (${value.length} chars)`);
        list.remove(item);
      }
    }
  });
}