'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = unwantedPropertiesRemover;

var _cssTree = require('css-tree');

var _cssTree2 = _interopRequireDefault(_cssTree);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function unwantedPropertiesRemover(ast, propertiesToRemove) {
  const propertiesToRemoveRegexes = propertiesToRemove.map(text => new RegExp(text));

  _cssTree2.default.walk(ast, {
    visit: 'Declaration',
    enter: (declaration, item, list) => {
      const shouldRemove = propertiesToRemoveRegexes.some(pattern => pattern.test(declaration.property));

      if (shouldRemove) {
        list.remove(item);
      }
    }
  });
}