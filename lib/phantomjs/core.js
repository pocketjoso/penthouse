'use strict';
var standaloneMode = standaloneMode || false;

var page = require('webpage').create(),
	fs = require('fs'),
	system = require('system'),
	DEBUG = false,
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
//final cleanup
//remove all empty rules, and remove leading/trailing whitespace
	try {
		var f = fs.open(options.css, 'r');

		//preformat css
		var cssPreformat;
		if (standaloneMode) {
			cssPreformat = cssPreformatter;
		} else {
			cssPreformat = require('./css-preformatter.js');
		}
		options.css = cssPreformat(f.read());
	} catch (e) {
		errorlog(e);
		phantomExit(1);
	}

  // start the critical path CSS generation
  getCriticalPathCss(options);
};

function cleanup(css) {
	//remove all animation rules, as keyframes have already been removed
	css = css.replace(/(-webkit-|-moz-|-ms-|-o-)?animation[ ]?:[^;{}]*;/gm, '');
	//remove all empty rules, and remove leading/trailing whitespace
	return css.replace(/[^{}]*\{\s*\}/gm, '').trim();
}

/* Final function
 * Get's called from getCriticalPathCss when CSS extraction from page is done*/
page.onCallback = function(css) {
  debug('phantom.onCallback');

  try {
    if (css) {
      // we are done - clean up the final css
      var finalCss = cleanup(css);

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
      stdout.write(css);
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
			page.evaluate(function sandboxed(css) {
				// need to encode/decode css for phantomjs' bridge serialization,
				// otherwise certain non ASCII chars causes it to hang, f.e. Unicode Character 'LINE SEPARATOR' (U+2028)
				css = decodeURIComponent(css);

				var h = window.innerHeight,
					renderWaitTime = 100, //ms TODO: user specifiable through options object
					finished = false,
					currIndex = 0,
					forceRemoveNestedRule = false;

				//split CSS so we can value the (selector) rules separately.
				//but first, handle stylesheet initial non nested @-rules.
				//they don't come with any associated rules, and should all be kept,
				//so just keep them in critical css, but don't include them in split
				var splitCSS = css.replace(/@(import|charset|namespace)[^;]*;/g, '');
				var split = splitCSS.split(/[{}]/g);

				var getNewValidCssSelector = function(i) {
					var newSel = split[i];
					/* HANDLE Nested @-rules */

					/*Case 1: @-rule with CSS properties inside [REMAIN]
						Can't remove @font-face rules here, don't know if used or not.
						Another check at end for this purpose.
					*/
					if (/@(font-face)/gi.test(newSel)) {
						//skip over this rule
						currIndex = css.indexOf('}', currIndex) + 1;
						return getNewValidCssSelector(i + 2);
					}
					/*Case 2: @-rule with CSS properties inside [REMOVE]
						@page
						This case doesn't need any special handling,
						as this "selector" won't match anything on the page,
						and will therefor be removed, together with it's css props
					*/

					/*Case 4: @-rule with full CSS (rules) inside [REMOVE]
						@media print|speech|aural, @keyframes
						Delete this rule and all its contents - doesn't belong in critical path CSS
					*/
					else if (/@(media (print|speech|aural)|(([a-z\-])*keyframes))/gi.test(newSel)) {
						//force delete on child css rules
						forceRemoveNestedRule = true;
						return getNewValidCssSelector(i + 1);
					}

					/*Case 3: @-rule with full CSS (rules) inside [REMAIN]
						This test is executed AFTER Case 4,
						since we here match every remaining @media,
						after @media print has been removed by Case 4 rule)
						- just skip this particular line (i.e. keep), and continue checking the CSS inside as normal
					*/
					else if (/@(media|(-moz-)?document|supports)/gi.test(newSel)) {
						return getNewValidCssSelector(i + 1);
					}
					/*
						Resume normal execution after end of @-media rule with inside CSS rules (Case 3)
						Also identify abrupt file end.
					*/
					else if (newSel.trim().length === 0) {
						//abrupt file end
						if (i + 1 >= split.length) {
							//end of file
							finished = true;
							return false;
						}
						//end of @-rule (Case 3)
						forceRemoveNestedRule = false;
						return getNewValidCssSelector(i + 1);
					}
					return i;
				};

				var removeSelector = function(sel, selectorsKept) {
					var selPos = css.indexOf(sel, currIndex);

					//check what comes next: { or ,
					var nextComma = css.indexOf(',', selPos);
					var nextOpenBracket = css.indexOf('{', selPos);

					if (selectorsKept > 0 || (nextComma > 0 && nextComma < nextOpenBracket)) {
						//we already kept selectors from this rule, so rule will stay

						//more selectors in selectorList, cut until (and including) next comma
						if (nextComma > 0 && nextComma < nextOpenBracket) {
							css = css.substring(0, selPos) + css.substring(nextComma + 1);
						}
						//final selector, cut until open bracket. Also remove previous comma, as the (new) last selector should not be followed by a comma.
						else {
							var prevComma = css.lastIndexOf(',', selPos);
							css = css.substring(0, prevComma) + css.substring(nextOpenBracket);
						}
					} else {
						//no part of selector (list) matched elements above fold on page - remove whole rule CSS rule
						var endRuleBracket = css.indexOf('}', nextOpenBracket);

						css = css.substring(0, selPos) + css.substring(endRuleBracket + 1);
					}
				};


				var processCssRules = function() {
					for (var i = 0; i < split.length; i = i + 2) {
						//step over non DOM CSS selectors (@-rules)
						i = getNewValidCssSelector(i);

						//reach end of CSS
						if (finished) {
							//call final function to exit outside of phantom evaluate scope
							window.callPhantom(css);
						}

						var fullSel = split[i];
						//fullSel can contain combined selectors
						//,f.e.  body, html {}
						//split and check one such selector at the time.
						var selSplit = fullSel.split(',');
						//keep track - if we remove all selectors, we also want to remove the whole rule.
						var selectorsKept = 0;
						var aboveFold;

						for (var j = 0; j < selSplit.length; j++) {
							var sel = selSplit[j];

							//some selectors can't be matched on page.
							//In these cases we test a slightly modified selectors instead, temp.
							var temp = sel;

							if (sel.indexOf(':') > -1) {
								//handle special case selectors, the ones that contain a semi colon (:)
								//many of these selectors can't be matched to anything on page via JS,
								//but that still might affect the above the fold styling

								//these psuedo selectors depend on an element,
								//so test element instead (would do the same for f.e. :hover, :focus, :active IF we wanted to keep them for critical path css, but we don't)
								temp = temp.replace(/(:?:before|:?:after)*/g, '');

								//if selector is purely psuedo (f.e. ::-moz-placeholder), just keep as is.
								//we can't match it to anything on page, but it can impact above the fold styles
								if (temp.replace(/:[:]?([a-zA-Z0-9\-\_])*/g, '').trim().length === 0) {
									currIndex = css.indexOf(sel, currIndex) + sel.length;
									selectorsKept++;
									continue;
								}

								//handle browser specific psuedo selectors bound to elements,
								//Example, button::-moz-focus-inner, input[type=number]::-webkit-inner-spin-button
								//remove browser specific pseudo and test for element
								temp = temp.replace(/:?:-[a-z-]*/g, '');
							}

							if (!forceRemoveNestedRule) {
								//now we have a selector to test, first grab any matching elements
								var el;
								try {
									el = document.querySelectorAll(temp);
								} catch (e) {
									//not a valid selector, remove it.
									removeSelector(sel, 0);
									continue;
								}

								//check if selector matched element(s) on page..
								aboveFold = false;

								for (var k = 0; k < el.length; k++) {
									var testEl = el[k];
									//temporarily force clear none in order to catch elements that clear previous content themselves and who w/o their styles could show up unstyled in above the fold content (if they rely on f.e. 'clear:both;' to clear some main content)
									testEl.style.clear = 'none';

									//check to see if any matched element is above the fold on current page
									//(in current viewport size)
									if (testEl.getBoundingClientRect().top < h) {
										//then we will save this selector
										aboveFold = true;
										selectorsKept++;

										//update currIndex so we only search from this point from here on.
										currIndex = css.indexOf(sel, currIndex);

										//set clear style back to what it was
										testEl.style.clear = '';
										//break, because matching 1 element is enough
										break;
									}
									//set clear style back to what it was
									testEl.style.clear = '';
								}
							} else {
								aboveFold = false;
							} //force removal of selector

							//if selector didn't match any elements above fold - delete selector from CSS
							if (aboveFold === false) {
								//update currIndex so we only search from this point from here on.
								currIndex = css.indexOf(sel, currIndex);
								//remove seletor (also removes rule, if nnothing left)
								removeSelector(sel, selectorsKept);
							}
						}
						//if rule stayed, move our cursor forward for matching new selectors
						if (selectorsKept > 0) {
							currIndex = css.indexOf('}', currIndex) + 1;
						}
					}

					//we're done - call final function to exit outside of phantom evaluate scope
					window.callPhantom(css);
				};

				//give some time (renderWaitTime) for sites like facebook that build their page dynamically,
				//otherwise we can miss some selectors (and therefor rules)
				//--tradeoff here: if site is too slow with dynamic content,
				//	it doesn't deserve to be in critical path.
				setTimeout(processCssRules, renderWaitTime);

			}, encodeURIComponent(options.css));
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
