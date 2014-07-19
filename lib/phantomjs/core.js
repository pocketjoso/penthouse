'use strict';

var page = require('webpage').create(),
	fs = require('fs'),
	system = require('system'),
	DEBUG = false,
	stdout = system.stdout; // for using this as a file

var combineArgsString = function (argsArr) {
	return [].join.call(argsArr, ' ') + '\n';
};

// monkey patch for directing errors to stderr
// https://github.com/ariya/phantomjs/issues/10150#issuecomment-28707859
var errorlog = function () {
	system.stderr.write(combineArgsString(arguments));
};

var debug = function () {
	if (DEBUG) errorlog('DEBUG: ' + combineArgsString(arguments));
};

//don't confuse analytics more than necessary when visiting websites
page.settings.userAgent = 'Penthouse Critical Path CSS Generator';

/* prevent page JS errors from being output to final CSS */
page.onError = function (msg, trace) {
	//do nothing
};

var main = function (options) {
	debug('main(): ', JSON.stringify(options));

	var jobs = [];

	try {
		var f = fs.open(options.cssFile, "r");
		options.css = preFormatCSS(f.read());
	} catch (e) {
		errorlog(e);
		phantom.exit(1);
	}

	// since the various async operations might overlap it might make
	// sense to not let them share the same object
	function createOptionsObject (urlIndex) {
		var clone = JSON.parse(JSON.stringify(options));
		delete clone.urls;
		delete clone.cssFile;
		clone.url = options.urls[urlIndex];
		return clone;
	}

	// support the standard old operation of logging to the console
	if (options.urls.length === 1) {
		debug('Creating single job');
		jobs.push(function (done) {
			debug('Starting single job');
			getCssAndWriteToFile(stdout, createOptionsObject(0), done);
		});
	} else {
		options.urls.forEach(function (url, index) {
			debug('Creating job ', index);

			jobs.push(function (done) {
				debug('Starting job ', index);

				var fp = fs.open('critical-' + (index + 1) + '.css', 'w');

				getCssAndWriteToFile(fp, createOptionsObject(index), function (err) {
					fp.close();

					if (err) {
						debug('Job', index, 'FAILED');
						done(err);
						return;
					}

					done();
				});
			});
		});
	}

	queueAsync(jobs, function (err) {
		if (err) {
			errorlog(err);
			phantom.exit(1);
		} else {
			phantom.exit(0);
		}
	})
};

// Queue async operations
// @author fatso83@github
// Expect callbacks on the form  ( callback : (err?) => void )
function queueAsync (functions, callback) {
	var fns = functions.slice(0);
	var fn, iter, index = 0;

	// functional looping, aka SICP 101 :)
	iter = function () {
		if (!fns.length) {
			// tell the mothership we want to go home
			callback();
			return;
		}

		// get first from queue
		fn = fns.splice(0, 1)[0];
		fn.index = index++;
		fn(function (err) {
			if (err) {
				debug('Job', fn.index, 'FAILED');
				callback(err);
			}
			else {
				debug('Job', fn.index, 'completed');
				iter();
			}
		});
	};
	iter();
}

//final cleanup
//remove all empty rules, and remove leading/trailing whitespace
function cleanup (css) {
	return css.replace(/[^{}]*\{\s*\}/gm, '').trim();
}

/**
 * Get the CSS and write to file
 * fp - a stream to write to
 * options - an options object with width, height, url and css
 * callback - a function that is called on finish, optionally with an error
 */
var getCssAndWriteToFile = function (fp, options, callback) {
	// start the critical path CSS generation

	// usually it is a bad idea to overwrite globals
	// in this case it is ok, since we are queing the async
	// operations that are modifying this field, so the
	// function calls will never overlap in time
	page.onCallback = function (css) {
		debug('phantom.onCallback');

		try {

			if(css) {
			// we are done - write the resulting css to the file stream
				var finalCss = cleanup(css);
				finalCss = rmUnusedFontFace(finalCss);
				fp.write(finalCss);
			} else {
				// No css. This is not an error on our part
				errorlog("No CSS. This means passed in CSS matched nothing on the URL: " + options.url);
			}

			callback();
		} catch (ex) {
			debug('phantom.onCallback -> error', ex);
			callback(ex);
		}
	};

	getCriticalPathCss(options);

};


/* === preFormatCSS ===
 * preformats the css to ensure we won't run into and problems in our parsing
 * removes comments (actually would be anough to remove/replace {} chars.. TODO
 * replaces } char inside content: "" properties.
 */
var preFormatCSS = function (css) {
	//remove comments from css (including multi-line coments)
	css = css.replace(/\/\*[\s\S]*?\*\//g, '');

	//we also need to replace eventual close curly bracket characters inside content: "" property declarations, replace them with their ASCI code equivalent
	//\7d (same as:   '\' + '}'.charCodeAt(0).toString(16)  );

	var m,
		regexP = /(content\s*:\s*['"][^'"]*)}([^'"]*['"])/gm,
		matchedData = [];

	//for each content: "" rule that contains at least one end bracket ('}')
	while ((m = regexP.exec(css)) !== null) {
		//we need to replace ALL end brackets in the rule
		//we can't do it in here, because it will mess up ongoing exec, store data and do after

		//unshift - add to beginning of array - we need to remove rules in reverse order,
		//otherwise indeces will become incorrect.
		matchedData.unshift({
			start : m.index, end : m.index + m[0].length, replaceStr : m[0].replace(/\}/gm, "\\7d")
		});
	}

	for (var i = 0; i < matchedData.length; i++) {
		var item = matchedData[0];
		css = css.substring(0, item.start) + item.replaceStr + css.substring(item.end);
	}

	return css;
};

/*=== rmUnusedFontFace ===
* find @fontface declarations where font isn't used in
* above the fold css, and removes those.
---------------------------------------------------------*/
var rmUnusedFontFace = function (css) {
		var toDeleteSections = [];

		//extract full @font-face rules
		var fontFaceRegex = /(@font-face[ \s\S]*?\{([\s\S]*?)\})/gm,
				ff;

		while ((ff = fontFaceRegex.exec(css)) !== null) {

				//grab the font name declared in the @font-face rule
				//(can still be in quotes, f.e. "Lato Web"
				var t = /font-family[^:]*?:[ ]*([^;]*)/.exec(ff[1]);
				if (typeof t[1] === "undefined")
						continue; //no font-family in @fontface rule!

				//rm quotes
				var fontName = t[1].replace(/['"]/gm, "");

				// does this fontname appear as a font-family or font (shorthand) value?
				var fontNameRegex = new RegExp("([^{}]*?)\{[^}]*?font(-family)?[^:]*?:[^;]*" + fontName + "[^,;]*[,;]", "gmi");


				var fontFound = false,
						m;

				while ((m = fontNameRegex.exec(css)) !== null) {
						if (m[1].indexOf("@font-face") === -1) {
								//log("FOUND, keep rule");
								fontFound = true;
								break;
						}
				}
				if (!fontFound) {
						//"NOT FOUND, rm!

						//can't remove rule here as it will screw up ongoing while (exec ...) loop.
						//instead: save indices and delete AFTER for loop
						var closeRuleIndex = css.indexOf("}", ff.index);
						//unshift - add to beginning of array - we need to remove rules in reverse order,
						//otherwise indeces will become incorrect again.
						toDeleteSections.unshift({start: ff.index, end: closeRuleIndex + 1});
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
var getCriticalPathCss = function (options) {
	debug('getCriticalPathCss():', JSON.stringify(options));

	page.viewportSize = {
		width  : options.width,
		height : options.height
	};

	page.open(options.url, function (status) {
		if (status !== 'success') {
			errorlog('Unable to access network');
			phantom.exit(1);
		} else {

			debug('Starting sandboxed evaluation of CSS\n', options.css);
			// sandboxed environments - no outside references
			// arguments and return value must be primitives
			// @see http://phantomjs.org/api/webpage/method/evaluate.html
			page.evaluate(function sandboxed(css) {
				var h = window.innerHeight,
						renderWaitTime = 100,//ms TODO: user specifiable through options object
						finished = false,
						currIndex = 0,
						forceRemoveNestedRule = false;

					//split CSS so we can value the (selector) rules separately.
					//first, handle special case @import (keep in css, but don't include in split, as has different syntax)
					var splitCSS = css.replace(/@import[^;]*;/g,"");
					var split = splitCSS.split(/[{}]/g);

					var getNewValidCssSelector = function (i) {
							var newSel = split[i];
							/* HANDLE @-rules */

							/*Case 1: @-rule with CSS properties inside [TO KEEP]
								(@font-face rules get checked at end to see whether they are used or not (too early here)
								(@page - don't have a proper check in place currently to handle css selector part - just keep in order not to break)
							*/
							if (/@(font-face|page)/gi.test(newSel)) {
								//skip over this rule
								currIndex = css.indexOf("}", currIndex) + 1;
								return getNewValidCssSelector(i + 2);
							}
							/*Case 2: @-rule with CSS properties inside [TO REMOVE]
								currently none..
							*/

							/*Case 3: @-rule with full CSS (rules) inside [TO KEEP]
								- just skip this particular line (i.e. keep), and continue checking the CSS inside as normal
							*/
							else if (/@(media|document|supports)/gi.test(newSel)) {
									return getNewValidCssSelector(i + 1);
							}
							/*Case 4: @-rule with full CSS (rules) inside [TO REMOVE]
								- delete this rule and all its contents - doesn't belong in critical path CSS
							*/
							else if (/@([a-z\-])*keyframe/gi.test(newSel)) {
									//force delete on child css rules
									forceRemoveNestedRule = true;
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

				var removeSelector = function(sel, selectorsKept){
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
							var prevComma = css.lastIndexOf(",", selPos);
							css = css.substring(0, prevComma) + css.substring(nextOpenBracket);
						}
					}
					else {
						//no part of selector (list) matched elements above fold on page - remove whole rule CSS rule
						var endRuleBracket = css.indexOf('}', nextOpenBracket);

						css = css.substring(0, selPos) + css.substring(endRuleBracket + 1);
					}
				}


				var processCssRules = function () {
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

						for (var j = 0; j < selSplit.length; j++) {
							var sel = selSplit[j];

							//some selectors can't be matched on page.
							//In these cases we test a slightly modified selectors instead, temp.
							var temp = sel;

							if (sel.indexOf(":") > -1) {
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
									continue;
								}

								//handle browser specific psuedo selectors bound to elements,
								//Example, button::-moz-focus-inner, input[type=number]::-webkit-inner-spin-button
								//remove browser specific pseudo and test for element
								temp = temp.replace(/:?:-[a-z-]*/g, '');
							}

							if (!forceRemoveNestedRule) {
								//now we have a selector to test, first grab any matching elements
								try {
									var el = document.querySelectorAll(temp);
								} catch (e) {
									//not a valid selector, remove it.
									removeSelector(sel, 0);
									continue;
								}

								//check if selector matched element(s) on page..
								var aboveFold = false;

								for (var k = 0; k < el.length; k++) {
									var testEl = el[k];
									//temporarily force clear none in order to catch elements that clear previous content themselves and who w/o their styles could show up unstyled in above the fold content (if they rely on f.e. "clear:both;" to clear some main content)
									testEl.style.clear = "none";

									//check to see if any matched element is above the fold on current page
									//(in current viewport size)
									if (testEl.getBoundingClientRect().top < h) {
										//then we will save this selector
										aboveFold = true;
										selectorsKept++;

										//update currIndex so we only search from this point from here on.
										currIndex = css.indexOf(sel, currIndex);

										//set clear style back to what it was
										testEl.style.clear = "";
										//break, because matching 1 element is enough
										break;
									}
									//set clear style back to what it was
									testEl.style.clear = "";
								}
							} else {
								aboveFold = false;
							} //force removal of selector

							//if selector didn't match any elements above fold - delete selector from CSS
							if (aboveFold === false) {
								var selPos = css.indexOf(sel, currIndex);
								//update currIndex so we only search from this point from here on.
								currIndex = css.indexOf(sel, currIndex);
								//remove seletor (also removes rule, if nnothing left)
								removeSelector(sel, selectorsKept);
							}
						}
						//if rule stayed, move our cursor forward for matching new selectors
						if (selectorsKept > 0) {
							currIndex = css.indexOf("}", currIndex) + 1;
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

			}, options.css);
		}
	});
};


var parser, parse, usage, options;

// test to see if we are running as a standalone script
// or as part of the node module
if (typeof embeddedParser !== 'undefined') { //standalone
	parse = parseOptions;
	usage = usageString;
} else {  // we are running in node
	parser = require('../options-parser');
	parse = parser.parse;
	usage = parser.usageString;
}

try {
	options = parse(system.args.slice(1));
} catch (ex) {
	errorlog('Caught error parsing arguments: ' + ex.message);
	errorlog('Usage: phantomjs penthouse.js ' + usage);
	phantom.exit(1);
}

// set defaults
if (!options.width) options.width = 1300;
if (!options.height) options.height = 900;

main(options);