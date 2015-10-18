/*
Penthouse CSS Critical Path Generator
https://github.com/pocketjoso/penthouse
Author: Jonas Ohlsson
License: MIT
Version: 0.3.6

USAGE:
    phantomjs penthouse.js [options] <URL to page> <CSS file>
    Options:
    --width <width>      The viewport width in pixels. Defaults to 1300 
    --height <height>    The viewport height in pixels. Defaults to 900 

    to run on HTTPS sites two flags must be passed in, directly after phantomjs in the call:
    --ignore-ssl-errors=true --ssl-protocol=tlsv1

DEPENDENCIES
    + "phantomjs" : "~1.9.7"

*/


(function() { "use strict"; 
/*
 * parser for the script - can be used both for the standalone node binary and the phantomjs script
 */

/*jshint unused:false*/

var usageString = '[--width <width>] [--height <height>] <url> <main.css>';

function buildError(msg, problemToken, args) {
    var error = new Error(msg + problemToken);
    error.token = problemToken;
    error.args = args;
    throw error;
}

// Parses the arguments passed in
// @returns { width, height, url, css }
// throws an error on wrong options or parsing error
function parseOptions(argsOriginal) {
    var args = argsOriginal.slice(0),
        validOptions = ['--width', '--height'],
        parsed = {},
        val,
        len = args.length,
        optIndex,
        option;

    if (len < 2) buildError('Not enough arguments, ', args);

    while (args.length > 2 && args[0].match(/^(--width|--height)$/)) {
        optIndex = validOptions.indexOf(args[0]);
        if (optIndex === -1) buildError('Logic/Parsing error ', args[0], args);

        // lose the dashes
        option = validOptions[optIndex].slice(2);
        val = args[1];

        parsed[option] = parseInt(val, 10);
        if (isNaN(parsed[option])) buildError('Parsing error when parsing ', val, args);

        // remove the two parsed arguments from the list
        args = args.slice(2);
    }
    parsed.url = args[0];
    parsed.css = args[1];

    if (!parsed.url) {
        buildError('Missing url/path to html file', '', args);
    }

    if (!parsed.css) {
        buildError('Missing css file', '', args);
    }


    return parsed;
}

if (typeof module !== 'undefined') {
    module.exports = exports = {
        parse: parseOptions,
        usage: usageString
    };
}
/*
module for removing unused fontface rules - can be used both for the standalone node binary and the phantomjs script
*/
/*jshint unused:false*/

function unusedFontfaceRemover (css){
  var toDeleteSections = [];

  //extract full @font-face rules
  var fontFaceRegex = /(@font-face[ \s\S]*?\{([\s\S]*?)\})/gm,
    ff;

  while ((ff = fontFaceRegex.exec(css)) !== null) {

    //grab the font name declared in the @font-face rule
    //(can still be in quotes, f.e. 'Lato Web'
    var t = /font-family[^:]*?:[ ]*([^;]*)/.exec(ff[1]);
    if (typeof t[1] === 'undefined')
      continue; //no font-family in @fontface rule!

    //rm quotes
    var fontName = t[1].replace(/['"]/gm, '');

    // does this fontname appear as a font-family or font (shorthand) value?
    var fontNameRegex = new RegExp('([^{}]*?){[^}]*?font(-family)?[^:]*?:[^;]*' + fontName + '[^,;]*[,;]', 'gmi');


    var fontFound = false,
      m;

    while ((m = fontNameRegex.exec(css)) !== null) {
      if (m[1].indexOf('@font-face') === -1) {
        //log('FOUND, keep rule');
        fontFound = true;
        break;
      }
    }
    if (!fontFound) {
      //NOT FOUND, rm!

      //can't remove rule here as it will screw up ongoing while (exec ...) loop.
      //instead: save indices and delete AFTER for loop
      var closeRuleIndex = css.indexOf('}', ff.index);
      //unshift - add to beginning of array - we need to remove rules in reverse order,
      //otherwise indeces will become incorrect again.
      toDeleteSections.unshift({
        start: ff.index,
        end: closeRuleIndex + 1
      });
    }
  }
  //now delete the @fontface rules we registed as having no matches in the css
  for (var i = 0; i < toDeleteSections.length; i++) {
    var start = toDeleteSections[i].start,
      end = toDeleteSections[i].end;
    css = css.substring(0, start) + css.substring(end);
  }

  return css;
};



if(typeof module !== 'undefined') {
    module.exports = unusedFontfaceRemover;
}
var standaloneMode = true;
'use strict';
var standaloneMode = standaloneMode || false;

var cssAstFormatter = require('css'),
	DEBUG = false,
	fs = require('fs'),
	page = require('webpage').create(),
	system = require('system'),
	stdout = system.stdout; // for using this as a file

var combineArgsString = function(argsArr) {
	return [].join.call(argsArr, ' ') + '\n';
};

// monkey patch for directing errors to stderr
// https://github.com/ariya/phantomjs/issues/10150#issuecomment-28707859
var errorlog = function() {
	system.stderr.write(combineArgsString(arguments));
};

var debug = function() {
	if (DEBUG) errorlog('DEBUG: ' + combineArgsString(arguments));
};

// discard stdout from phantom exit;
var phantomExit = function(code) {
	if (page) {
		page.close();
	}
	setTimeout(function() {
		phantom.exit(code);
	}, 0);
};

//don't confuse analytics more than necessary when visiting websites
page.settings.userAgent = 'Penthouse Critical Path CSS Generator';

/* prevent page JS errors from being output to final CSS */
page.onError = function(msg, trace) {
	//do nothing
};

page.onResourceError = function(resourceError) {
  page.reason = resourceError.errorString;
  page.reason_url = resourceError.url;
};

var main = function(options) {
  debug('main()');

	try {
		var f = fs.open(options.css, 'r');
		options.ast = cssAstFormatter.parse(f.read());
	} catch (e) {
		errorlog(e);
		phantomExit(1);
	}

  // start the critical path CSS generation
  getCriticalPathCss(options);
};

/* Final function
 * Get's called from getCriticalPathCss when CSS extraction from page is done*/
page.onCallback = function(criticalRules) {
  debug('phantom.onCallback');

  try {
    if (criticalRules && criticalRules.length > 0) {

			var finalCss = cssAstFormatter.stringify({
				 stylesheet: {
					 rules: criticalRules
				 }
			 });

      // remove unused @fontface rules
			var ffRemover;
      if (standaloneMode) {
        ffRemover = unusedFontfaceRemover;
      } else {
        ffRemover = require('./unused-fontface-remover.js');
      }
      finalCss = ffRemover(finalCss);

			if(finalCss.trim().length === 0){
				errorlog('Note: Generated critical css was empty for URL: ' + options.url);
			}

      // return the critical css!
      stdout.write(finalCss);
      phantomExit(0);
    } else {
      // No css. This is not an error on our part
      // but still safer to warn the end user, in case they made a mistake
      errorlog('Note: Generated critical css was empty for URL: ' + options.url);
      // for consisteny, still generate output (will be empty)
      stdout.write('');
      phantomExit(0);
    }

  } catch (ex) {
    debug('phantom.onCallback -> error', ex);
    errorlog('error: ' + ex);
    phantomExit(1);
  }
};

/*
 * Tests each selector in css file at specified resolution,
 * to see if any such elements appears above the fold on the page
 * modifies CSS - removes selectors that don't appear, and empty rules
 *
 * @param options.url the url as a string
 * @param options.css the css as a string
 * @param options.width the width of viewport
 * @param options.height the height of viewport
 ---------------------------------------------------------*/
function getCriticalPathCss(options) {
	debug('getCriticalPathCss():');

	page.viewportSize = {
		width: options.width,
		height: options.height
	};

	page.open(options.url, function(status) {
		if (status !== 'success') {
			errorlog('Error opening url \'' + page.reason_url + '\': ' + page.reason);
			phantomExit(1);
		} else {

			debug('Starting sandboxed evaluation of CSS');
			// sandboxed environments - no outside references
			// arguments and return value must be primitives
			// @see http://phantomjs.org/api/webpage/method/evaluate.html
			page.evaluate(function sandboxed(ast) {
				var h = window.innerHeight,
					renderWaitTime = 100; //ms TODO: user specifiable through options object

				var isElementAboveFold = function (element) {
					//temporarily force clear none in order to catch elements that clear previous content themselves and who w/o their styles could show up unstyled in above the fold content (if they rely on f.e. 'clear:both;' to clear some main content)
					var originalClearStyle = element.style.clear || '';
					element.style.clear = 'none';
					var aboveFold = element.getBoundingClientRect().top < h;

					//set clear style back to what it was
					element.style.clear = originalClearStyle;
					return aboveFold;
				};

				var isSelectorCritical = function (selector) {
					if (selector.trim() === '*') {
						return true;
					}

					//some selectors can't be matched on page.
					//In these cases we test a slightly modified selectors instead, modifiedSelector.
					var modifiedSelector = selector;
					if (modifiedSelector.indexOf(':') > -1) {
						//handle special case selectors, the ones that contain a semi colon (:)
						//many of these selectors can't be matched to anything on page via JS,
						//but that still might affect the above the fold styling

						//these psuedo selectors depend on an element,
						//so test element instead (would do the same for f.e. :hover, :focus, :active IF we wanted to keep them for critical path css, but we don't)
						modifiedSelector = modifiedSelector.replace(/(:?:before|:?:after)*/g, '');

						//if selector is purely psuedo (f.e. ::-moz-placeholder), just keep as is.
						//we can't match it to anything on page, but it can impact above the fold styles
						if (modifiedSelector.replace(/:[:]?([a-zA-Z0-9\-\_])*/g, '').trim().length === 0) {
							return true;
						}

						//handle browser specific psuedo selectors bound to elements,
						//Example, button::-moz-focus-inner, input[type=number]::-webkit-inner-spin-button
						//remove browser specific pseudo and test for element
						modifiedSelector = modifiedSelector.replace(/:?:-[a-z-]*/g, '');
					}

					//now we have a selector to test, first grab any matching elements
					var elements;
					try {
						elements = document.querySelectorAll(modifiedSelector);
					} catch (e) {
						//not a valid selector, remove it.
						return false;
					}

					// some is not supported on Arrays in this version of QT browser,
					// meaning have to write much less terse code here.
					var elementIndex = 0;
					var aboveFold = false;
					while (!aboveFold && elementIndex < elements.length) {
						aboveFold = isElementAboveFold(elements[elementIndex]);
						elementIndex++;
					}
					return aboveFold;
				};

				var isCssRuleCritical = function(rule) {
					if (rule.type === 'rule') {
						// check what, if any selectors are found above fold
						rule.selectors = rule.selectors.filter(isSelectorCritical);
						return rule.selectors.length > 0;
					}
					/*==@-rule handling==*/
			    /* - Case 0 : Non nested @-rule [REMAIN]
			     (@charset, @import, @namespace)
			     */
					if (
						rule.type === 'charset' ||
						rule.type === 'import' ||
						rule.type === 'namespace'
					) {
						return true;
					}

					/*Case 1: @-rule with CSS properties inside [REMAIN]
						@font-face - keep here, but remove later in code, unless it is used.
					*/
					 if (rule.type === 'font-face') {
						 return true;
					 }

					/*Case 3: @-rule with full CSS (rules) inside [REMAIN]
					*/
					if (
						// TODO: remove media queries larger than critical dimensions
						rule.type === 'media' && rule.media !== 'print' ||
						rule.type === 'document' ||
						rule.type === 'supports'
					) {
						rule.rules = rule.rules.filter(isCssRuleCritical);
						return rule.rules.length > 0;
					}

					return false;

				};

				var processCssRules = function () {
					var criticalRules = ast.stylesheet.rules.filter(isCssRuleCritical);

					//we're done - call final function to exit outside of phantom evaluate scope
					window.callPhantom(criticalRules);
				};

				//give some time (renderWaitTime) for sites like facebook that build their page dynamically,
				//otherwise we can miss some selectors (and therefor rules)
				//--tradeoff here: if site is too slow with dynamic content,
				//	it doesn't deserve to be in critical path.
				setTimeout(processCssRules, renderWaitTime);

			}, options.ast);
		}
	});
}

var parser, parse, usage, options;

// test to see if we are running as a standalone script
// or as part of the node module
if (standaloneMode) {
	parse = parseOptions;
	usage = usageString;
} else {
	parser = require('../options-parser');
	parse = parser.parse;
	usage = parser.usage;
}

try {
	options = parse(system.args.slice(1));
} catch (ex) {

    errorlog('Caught error parsing arguments: ' + ex.message);

    // the usage string does not make sense to show if running via Node
    if(standaloneMode) {
        errorlog('\nUsage: phantomjs penthouse.js ' + usage);
    }

	phantomExit(1);
}

// set defaults
if (!options.width) options.width = 1300;
if (!options.height) options.height = 900;

main(options);
})();