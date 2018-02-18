'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = commentRemover;
function commentRemover(ast) {
  // remove top level comments
  ast.children.each((node, item, list) => {
    if (node.type === 'Comment') {
      list.remove(item);
    }
  });
}