'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = finalRuleRemover;

var _cssTree = require('css-tree');

var _cssTree2 = _interopRequireDefault(_cssTree);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function finalRuleRemover(ast, propertiesToRemove) {
  // remove empty rules
  _cssTree2.default.walk(ast, {
    visit: 'Rule',
    leave: (rule, item, list) => {
      if (rule.block.children.isEmpty()) {
        list.remove(item);
      }
    }
  });

  // remove unwanted and empty at-rules
  _cssTree2.default.walk(ast, {
    visit: 'Atrule',
    leave: (atrule, item, list) => {
      const name = _cssTree2.default.keyword(atrule.name).basename;

      /* ==@-rule handling== */
      /* - Case 0 : Non nested @-rule [REMAIN]
         (@charset, @import, @namespace)
      */
      if (name === 'charset' || name === 'import' || name === 'namespace') {
        return;
      }

      /* Case 1: @-rule with CSS properties inside [REMAIN]
         @font-face, @keyframes - keep here, but remove later in code, unless it is used.
      */
      if (name === 'font-face' || name === 'keyframes' || name === 'viewport') {
        return;
      }

      /* Case 3: @-rule with CSS rules inside [REMAIN] */
      // non matching media queries are stripped out in non-matching-media-query-remover.js
      if (name === 'media' || name === 'document' || name === 'supports') {
        if (atrule.block && !atrule.block.children.isEmpty()) {
          return;
        }
      }

      // otherwise remove the at-rule
      list.remove(item);
    }
  });
}