'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _cssTree = require('css-tree');

var _cssTree2 = _interopRequireDefault(_cssTree);

var _debug = require('debug');

var _debug2 = _interopRequireDefault(_debug);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

const debuglog = (0, _debug2.default)('penthouse:preformatting:selectors-profile');

var pseudoSelectorsToKeep = [':before', ':after', ':visited', ':first-letter', ':first-line'];
// detect these selectors regardless of whether one or two semicolons are used
var pseudoSelectorsToKeepRegex = pseudoSelectorsToKeep.map(function (s) {
  return ':?' + s;
}).join('|'); // separate in regular expression
// we will replace all instances of these pseudo selectors; hence global flag
var PSUEDO_SELECTOR_REGEXP = new RegExp(pseudoSelectorsToKeepRegex, 'g');

function matchesForceInclude(selector, forceInclude) {
  return forceInclude.some(function (includeSelector) {
    if (includeSelector.type === 'RegExp') {
      const source = includeSelector.source,
            flags = includeSelector.flags;

      const re = new RegExp(source, flags);
      return re.test(selector);
    }
    return includeSelector.value === selector;
  });
}

function normalizeSelector(selectorNode, forceInclude) {
  const selector = _cssTree2.default.generate(selectorNode);
  // some selectors can't be matched on page.
  // In these cases we test a slightly modified selector instead
  let modifiedSelector = selector.trim();

  if (matchesForceInclude(modifiedSelector, forceInclude)) {
    return true;
  }

  if (modifiedSelector.indexOf(':') > -1) {
    // handle special case selectors, the ones that contain a semicolon (:)
    // many of these selectors can't be matched to anything on page via JS,
    // but that still might affect the above the fold styling

    // ::selection we just remove
    if (/:?:(-moz-)?selection/.test(modifiedSelector)) {
      return false;
    }

    // for the pseudo selectors that depend on an element, test for presence
    // of the element (in the critical viewport) instead
    // (:hover, :focus, :active would be treated same
    // IF we wanted to keep them for critical path css, but we don’t)
    modifiedSelector = modifiedSelector.replace(PSUEDO_SELECTOR_REGEXP, '');

    // if selector is purely pseudo (f.e. ::-moz-placeholder), just keep as is.
    // we can't match it to anything on page, but it can impact above the fold styles
    if (modifiedSelector.replace(/:[:]?([a-zA-Z0-9\-_])*/g, '').trim().length === 0) {
      return true;
    }

    // handle browser specific pseudo selectors bound to elements,
    // Example, button::-moz-focus-inner, input[type=number]::-webkit-inner-spin-button
    // remove browser specific pseudo and test for element
    modifiedSelector = modifiedSelector.replace(/:?:-[a-z-]*/g, '');
  }

  return modifiedSelector;
}

exports.default = (() => {
  var _ref = _asyncToGenerator(function* (ast, forceInclude) {
    debuglog('buildSelectorProfile START');
    const selectors = new Set();
    const selectorNodeMap = new WeakMap();

    _cssTree2.default.walk(ast, {
      visit: 'Rule',
      enter: function enter(rule, item, list) {
        // ignore rules inside @keyframes at-rule
        if (this.atrule && _cssTree2.default.keyword(this.atrule.name).basename === 'keyframes') {
          return;
        }

        // ignore a rule with a bad selector
        if (rule.prelude.type !== 'SelectorList') {
          return;
        }

        // collect selectors and build a map
        rule.prelude.children.each(selectorNode => {
          const selector = normalizeSelector(selectorNode, forceInclude);
          if (typeof selector === 'string') {
            selectors.add(selector);
          }
          selectorNodeMap.set(selectorNode, selector);
        });
      }
    });

    debuglog('buildSelectorProfile DONE');
    return {
      selectorNodeMap,
      selectors: Array.from(selectors)
    };
  });

  function buildSelectorProfile(_x, _x2) {
    return _ref.apply(this, arguments);
  }

  return buildSelectorProfile;
})();