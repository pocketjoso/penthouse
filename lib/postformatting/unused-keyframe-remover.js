'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = unusedKeyframeRemover;

var _cssTree = require('css-tree');

var _cssTree2 = _interopRequireDefault(_cssTree);

var _debug = require('debug');

var _debug2 = _interopRequireDefault(_debug);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const debuglog = (0, _debug2.default)('penthouse:css-cleanup:unused-keyframe-remover');

function getAllKeyframes(ast) {
  return new Set(_cssTree2.default.lexer.findAllFragments(ast, 'Type', 'keyframes-name').map(entry => {
    const keyframeName = _cssTree2.default.generate(entry.nodes.first());
    debuglog('found used keyframe animation: ' + keyframeName);
    return keyframeName;
  }));
}

function unusedKeyframeRemover(ast) {
  debuglog('getAllAnimationKeyframes');
  const usedKeyFrames = getAllKeyframes(ast);
  debuglog('getAllAnimationKeyframes AFTER, usedKeyFrames: ' + usedKeyFrames.size);

  // remove all unused keyframes
  _cssTree2.default.walk(ast, {
    visit: 'Atrule',
    enter: (atrule, item, list) => {
      const keyword = _cssTree2.default.keyword(atrule.name);

      if (keyword.basename === 'keyframes') {
        const keyframeName = _cssTree2.default.generate(atrule.prelude);

        if (!usedKeyFrames.has(keyframeName)) {
          debuglog(`drop unused @${keyword.name}: ${keyframeName}`);
          list.remove(item);
        }
      }
    }
  });
}