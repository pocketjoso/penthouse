// Penthouse CSS Critical Path Generator
// https://github.com/pocketjoso/penthouse
// Author: Jonas Ohlsson
// License: MIT
// Version 0.2.53

// USAGE (when run standalone):
// phantomjs penthouse.js [URL to page] [CSS file] > [critical path CSS file]

// to run on HTTPS sites two flags must be passed in, directly after phantomjs in the call:
// --ignore-ssl-errors=true --ssl-protocol=tlsv1

// optional parameters: [WIDTH], [HEIGHT] - must follow [CSS file] param in this order. Defaults to 1300, 900.

// DEPENDENCIES
// + "phantomjs" : "~1.9.7"

'use strict';

var page = require('webpage').create(),
    fs = require('fs'),
    system = require('system');

//shortcut for logging
var log = function (msg) {
    console.log(msg);
};

//don't confuse analytics more than necessary when visiting websites
page.settings.userAgent = 'Penthouse Critical Path CSS Generator';

/* prevent page JS errors from being output to final CSS */
page.onError = function (msg, trace) {
    //do nothing
};


var main = function () {

    var options;

    options = parseArguments();

    try {
        var f = fs.open(options.cssFilePath, "r");
        options.css = preFormatCSS(f.read());
    } catch (e) {
        console.error(e);
        phantom.exit(1);
    }

    // start the critical path CSS generation
    getCriticalPathCss(options);
};

/* Final function
 * Get's called from getCriticalPathCss when CSS extraction from page is done*/
page.onCallback = function(data) {
	//final cleanup

  //remove all animation rules, as keyframes have already been removed
  var data = data.replace(/(-webkit-|-moz-|-ms-|-o-)?animation[ ]?:[^;{}]*;/gm, '');
	//remove all empty rules, and remove leading/trailing whitespace
	var finalCss = data.replace(/[^{}]*\{\s*\}/gm, '').trim();
	//remove unused @fontface rules
	finalCss = rmUnusedFontFace(finalCss);
	//we're done, log the result as the output from phantomjs execution of this script!
	log(finalCss);

	phantom.exit();
};

var parseArguments = function () {
    var options = {};

    //url needs to be passed in
    if (system.args.length < 3) {
        log('Usage: penthouse <some URL> <path to css file>');
        phantom.exit(1);
    }

    options.url = system.args[1];
    options.cssFilePath = system.args[2];
    options.width = system.args[3] || 1300;
    options.height = system.args[4] || 900;

    return options;
};

/* === preFormatCSS ===
 * preformats the css to ensure we won't run into and problems in our parsing
 * removes comments (actually would be anough to remove/replace {} chars.. TODO
 * replaces } char inside content: "" properties.
 */
var preFormatCSS = function (css) {
    //remove comments from css (including multi-line coments)
    css = css.replace(/\/\*[\s\S]*?\*\//g, '');

	//replace Windows \r\n with \n,
	//otherwise final output might get converted into /r/r/n
	css = css.replace(/\r\n/gm, '\n');

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
			start: m.index
			,end: m.index + m[0].length
			,replaceStr: m[0].replace(/\}/gm,"\\7d")
		});
	}

	for(var i=0; i<matchedData.length;i++){
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
 * @param options.css the css as a string
 * @param options.width the width of viewport
 * @param options.height the height of viewport
 ---------------------------------------------------------*/
var getCriticalPathCss = function (options) {

    page.viewportSize = {
        width: options.width,
        height: options.height
    };

    page.open(options.url, function (status) {
        var css;
        if (status !== 'success') {
            log('Unable to access network');
            phantom.exit();
        } else {
            page.evaluate(function (css) {
				//==variables==
				var h = window.innerHeight,
					renderWaitTime = 100, //ms
                    finished = false,
                    currIndex = 0,
                    forceRemoveNestedRule = false,
					split;

				//==methods==
                var getNewValidCssSelector = function (i) {
                    var newSel = split[i];
					/* HANDLE Nested @-rules */

					/*Case 1: @-rule with CSS properties inside [REMAIN]
						(@font-face rules get checked at end to see whether they are used or not (too early here)
						(@page - don't have a proper check in place currently to handle css selector part - just keep in order not to break)
					*/
                    if (/@(font-face|page)/gi.test(newSel)) {
						//skip over this rule
                        currIndex = css.indexOf("}", currIndex) + 1;
                        return getNewValidCssSelector(i + 2);
                    }
					/*Case 2: @-rule with CSS properties inside [REMOVE]
						currently none..
					*/

					/*Case 3: @-rule with full CSS (rules) inside [REMAIN]
						- just skip this particular line (i.e. keep), and continue checking the CSS inside as normal
					*/
					else if (/@(media|document|supports)/gi.test(newSel)) {
                        return getNewValidCssSelector(i + 1);
                    }
					/*Case 4: @-rule with full CSS (rules) inside [REMOVE]
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
					var selPos = css.indexOf(sel, currIndex),
						//check what comes next: { or ,
						nextComma = css.indexOf(',', selPos),
						nextOpenBracket = css.indexOf('{', selPos);

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

				//==MAIN function==
				//split CSS so we can value the (selector) rules separately.

				//but first, handle stylesheet initial non nested @-rules.
				//they don't come with any associated rules, and should all be kept,
				//so just keep them in critical css, but don't include them in split
				var splitCSS = css.replace(/@(import|charset|namespace)[^;]*;/g,"");
				split = splitCSS.split(/[{}]/g);
				//give some time (renderWaitTime) for sites like facebook that build their page dynamically,
				//otherwise we can miss some selectors (and therefor rules)
				//--tradeoff here: if site is too slow with dynamic content,
				//	it doesn't deserve to be in critical path.
				setTimeout(function(){
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
							} else
								aboveFold = false; //force removal of selector

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
							currIndex = css.indexOf("}", currIndex) + 1;
						}
					}

					//we're done - call final function to exit outside of phantom evaluate scope
					window.callPhantom(css);


				},renderWaitTime);

            }, options.css);
        }
    });
};

main();
