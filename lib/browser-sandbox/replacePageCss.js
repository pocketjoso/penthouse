'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = replacePageCss;
function replacePageCss({ css }) {
  console.log('debug: replacePageCss');
  function removeStyles() {
    var styleElements = document.querySelectorAll('link[rel="stylesheet"], style');
    Array.prototype.forEach.call(styleElements, function (element) {
      element.parentNode.removeChild(element);
    });
  }
  function insertStyles(styles) {
    var styleTag = document.createElement('style');
    styleTag.type = 'text/css';
    // inject defaultWhiteBg to match before-render
    styles = 'body { background: #fff }' + styles;
    // if unreachable font-face src url in styles, phantomjs seems to crash here on Ubuntu :/
    styleTag.appendChild(document.createTextNode(styles));
    document.head.appendChild(styleTag);
  }
  removeStyles();
  console.log('debug: removed styles');
  insertStyles(css);
}