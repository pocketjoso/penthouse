'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = cleanup;

var _debug = require('debug');

var _debug2 = _interopRequireDefault(_debug);

var _commentRemover = require('./comment-remover');

var _commentRemover2 = _interopRequireDefault(_commentRemover);

var _embeddedBase64Remover = require('./embedded-base64-remover');

var _embeddedBase64Remover2 = _interopRequireDefault(_embeddedBase64Remover);

var _unusedKeyframeRemover = require('./unused-keyframe-remover');

var _unusedKeyframeRemover2 = _interopRequireDefault(_unusedKeyframeRemover);

var _unusedFontfaceRemover = require('./unused-fontface-remover');

var _unusedFontfaceRemover2 = _interopRequireDefault(_unusedFontfaceRemover);

var _unwantedPropertiesRemover = require('./unwanted-properties-remover');

var _unwantedPropertiesRemover2 = _interopRequireDefault(_unwantedPropertiesRemover);

var _ruleSelectorRemover = require('./rule-selector-remover');

var _ruleSelectorRemover2 = _interopRequireDefault(_ruleSelectorRemover);

var _finalRuleRemover = require('./final-rule-remover');

var _finalRuleRemover2 = _interopRequireDefault(_finalRuleRemover);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const debuglog = (0, _debug2.default)('penthouse:css-cleanup');

// NOTE: mutates the ast
function cleanup({
  ast,
  selectorNodeMap,
  criticalSelectors,
  propertiesToRemove,
  maxEmbeddedBase64Length
}) {
  debuglog('start');

  (0, _commentRemover2.default)(ast);
  debuglog('commentRemover');

  (0, _ruleSelectorRemover2.default)(ast, selectorNodeMap, criticalSelectors);
  debuglog('ruleSelectorRemover');

  (0, _unusedKeyframeRemover2.default)(ast);
  debuglog('unusedKeyframeRemover');

  // remove data-uris that are too long
  (0, _embeddedBase64Remover2.default)(ast, maxEmbeddedBase64Length);
  debuglog('embeddedbase64Remover');

  // remove bad and unused @fontface rules
  (0, _unusedFontfaceRemover2.default)(ast);
  debuglog('unusedFontFaceRemover');

  // remove irrelevant css properties via rule walking
  (0, _unwantedPropertiesRemover2.default)(ast, propertiesToRemove);
  debuglog('propertiesToRemove');

  // remove empty and unwanted rules and at-rules
  (0, _finalRuleRemover2.default)(ast);
  debuglog('finalRuleRemover');
}