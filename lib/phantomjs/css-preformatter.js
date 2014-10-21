/*jshint unused:false*/

/* === preFormatCSS ===
 * preformats the css to ensure we won't run into and problems in our parsing
 * removes comments (actually would be anough to remove/replace {} chars.. TODO
 * replaces } char inside content: '' properties.
 */

function cssPreformatter (css){
  //remove comments from css (including multi-line coments)
  css = css.replace(/\/\*[\s\S]*?\*\//g, '');

  //replace Windows \r\n with \n,
  //otherwise final output might get converted into /r/r/n
  css = css.replace(/\r\n/gm, '\n');

  //we also need to replace eventual close curly bracket characters inside content: '' property declarations, replace them with their ASCI code equivalent
  //\7d (same as:   '\' + '}'.charCodeAt(0).toString(16)  );

  var m,
    regexP = /(content\s*:\s*['"][^'"]*)}([^'"]*['"])/gm,
    matchedData = [];

  //for each content: '' rule that contains at least one end bracket ('}')
  while ((m = regexP.exec(css)) !== null) {
    //we need to replace ALL end brackets in the rule
    //we can't do it in here, because it will mess up ongoing exec, store data and do after

    //unshift - add to beginning of array - we need to remove rules in reverse order,
    //otherwise indeces will become incorrect.
    matchedData.unshift({
      start: m.index,
      end: m.index + m[0].length,
      replaceStr: m[0].replace(/\}/gm, '\\7d')
    });
  }

  for (var i = 0; i < matchedData.length; i++) {
    var item = matchedData[0];
    css = css.substring(0, item.start) + item.replaceStr + css.substring(item.end);
  }

  return css;
};

if(typeof module !== 'undefined') {
    module.exports = cssPreformatter;
}
