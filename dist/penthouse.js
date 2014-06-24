/*
    Penthouse CSS Critical Path Generator
    https://github.com/pocketjoso/penthouse
    Author: Jonas Ohlsson
    License: MIT
    Version 0.2.0
*/


// USAGE (when run standalone):
// phantomjs penthouse.js [CSS file] [URL to page] > [critical path CSS file]
// Options:
// --width <width>      The viewport width in pixels. Defaults to 1300 
// --height <height>    The viewport height in pixels. Defaults to 900 

// to run on HTTPS sites two flags must be passed in, directly after phantomjs in the call:
// --ignore-ssl-errors=true --ssl-protocol=tlsv1

// DEPENDENCIES
// + "phantomjs" : "~1.9.7"

/* 
parser for the script - can be used both for the standalone node binary and the phantomjs script
*/

var usageString = '[--width <width>] [--height <height>]  <main.css> <url> [<url> [...]]';

var embeddedParser = true; // we test for this symbol in the concatenated script

function error(msg, problemToken, args) {
    var error = new Error( msg  + problemToken);
    error.token = problemToken;
    error.args = args;
    throw error;
}

// Parses the arguments passed in
// @returns { width, height, url, cssFile }
// throws an error on wrong options or parsing error
function parseOptions(argsOriginal) {   
    var args = argsOriginal.slice(0),
    validOptions = ['--width', '--height'],
    parsed = {},
    len = args.length,
    optIndex,
    option;

    if(len < 2 ) error('Invalid number of arguments', args, args);

    while(args.length > 2 && args[0].match(/^(--width|--height)$/)) {
        optIndex = validOptions.indexOf(args[0]);
        if(optIndex === -1) error('Logic/Parsing error ', args[0], args);

        // lose the dashes
        option = validOptions[optIndex].slice(2);
        val = args[1];

        parsed[option] = parseInt(val, 10);
        if(isNaN(parsed[option])) error('Parsing error when parsing ', val, args); 

        // remove the two parsed arguments from the list
        args = args.slice(2);
    }

    parsed.cssFile = args[0];
    parsed.urls = args.slice(1);

    parsed.urls.forEach(function(url) {
        if( ! url.match(/https?:\/\//) ) { 
            error('Invalid url: ', parsed.url, args); 
        }
    });
    return parsed;
}

if(typeof module !== 'undefined') {
    module.exports = exports = {
        parse : parseOptions,
        usage : usageString
    };
} 
// PhantomJS script for extracting critical path css

'use strict';

var page = require('webpage').create(),
    fs = require('fs'),
    system = require('system');

// shortcut for logging
var log = function (msg) {
    console.log(msg);
};

// monkey patch for directing errors to stderr
// https://github.com/ariya/phantomjs/issues/10150#issuecomment-28707859
var errorlog = function () {
    system.stderr.write(Array.prototype.join.call(arguments, ' ') + '\n');
};

//don't confuse analytics more than necessary when visiting websites
page.settings.userAgent = 'Penthouse Critical Path CSS Generator';

/* prevent page JS errors from being output to final CSS */
page.onError = function (msg, trace) {
    //do nothing
};

var main = function (options) {

    try {
        var f = fs.open(options.cssFile, "r");
        options.css = preFormatCSS(f.read());
    } catch (e) {
        errorlog(e);
        phantom.exit(1);
    }

    // since the various async operations might overlap it might make 
    // sense to not let them share the same object
    function createOptionsObject(urlIndex) {
        var clone = JSON.parse(JSON.stringify(options));
        delete clone.urls;
        clone.url = options.urls[urlIndex];
        return clone;
    }

    // start the critical path CSS generation
    getCriticalPathCss(createOptionsObject(0), function (css) {
        //we're done, log the result as the output from phantomjs execution of this script
        log(css);
        phantom.exit();
    });
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
 * @param callback will be called with the result
 ---------------------------------------------------------*/
var getCriticalPathCss = function (options, callback) {

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
            css = page.evaluate(function (css) {
                var h = window.innerHeight,
                    split = css.split(/[{}]/g),
                    keepHover = false,
                    finished = false,
                    currIndex = 0,
                    forceRemoveNestedRule = false;

                var getNewValidCssSelector = function (i) {
                    var newSel = split[i];
                    if (newSel.indexOf("@font-face") > -1) {
                        //just leave @font-face rules in. TODO: rm unused @fontface rules.
                        currIndex = css.indexOf("}", currIndex) + 1;
                        return getNewValidCssSelector(i + 2);
                    }
                    else if (newSel.indexOf("@media") > -1) { //media queries..
                        //skip the media query line, which is not a css selector
                        return getNewValidCssSelector(i + 1);
                    }
                    else if (/@([a-z\-])*keyframe/g.test(newSel)) {
                        //remove @keyframe rules completely - don't belong in critical path css
                        //do it via forcing delete on child css rules (inside f.e. @keyframe declaration)
                        forceRemoveNestedRule = true;
                        return getNewValidCssSelector(i + 1);
                    }
                    else if (newSel.trim().length === 0) {
                        //end of nested rule (f.e. @media, @keyframe), or file..;

                        if (i + 1 >= split.length) {
                            //end of file
                            finished = true;
                            return false;
                        }
                        //end of nested selector, f.e. end of media query
                        forceRemoveNestedRule = false;
                        return getNewValidCssSelector(i + 1);
                    }
                    else if (newSel.indexOf(";") > -1) {
                        //remove incorrect css rule
                        var incorrectRuleStart = css.indexOf(newSel, currIndex),
                            incorrectRuleEnd = css.indexOf("}", incorrectRuleStart);

                        css = css.substring(0, incorrectRuleStart) + css.substring(incorrectRuleEnd + 1, css.length);
                        return getNewValidCssSelector(i + 1);
                    }
                    return i;
                };

                for (var i = 0; i < split.length; i = i + 2) {
                    //step over non DOM CSS selectors (@font-face, @media..)
                    i = getNewValidCssSelector(i);
                    var fullSel = split[i];

                    if (finished) {
                        return css;
                    }

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

                        //if not to keep hover, let it go through here as is - won't match anything on page and therefor will be removed from CSS
                        if (!keepHover && sel.indexOf(":hover") > -1) {
                            // TODO: Remove?
                            var NEVER_USED_REMOVE_ME = 3;
                        } else if (sel.indexOf(":") > -1) {
                            //handle special case selectors, the ones that contain a semi colon (:)
                            //many of these selectors can't be matched to anything on page via JS,
                            //but that still might affect the above the fold styling

                            //these psuedo selectors depend on an element,
                            //so test element instead (would do the same for f.e. :focus, :active IF we wanted to keep them for critical path css, but we don't)
                            temp = temp.replace(/(:hover|:?:before|:?:after)*/g, '');

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
                                continue;
                            }

                            //check if selector matched element(s) on page..
                            var aboveFold = false;
                            for (var k = 0; k < el.length; k++) {
                                var testEl = el[k];

                                //check to see if any matched element is above the fold on current page
                                //(in current viewport size)
                                if (testEl.getBoundingClientRect().top < h) {
                                    //then we will save this selector
                                    aboveFold = true;
                                    selectorsKept++;

                                    //update currIndex so we only search from this point from here on.
                                    currIndex = css.indexOf(sel, currIndex);

                                    //break, because matching 1 element is enough
                                    break;
                                }
                            }
                        } else
                            aboveFold = false; //force removal of rule

                        //if selector didn't match any elements above fold - delete selector from CSS
                        if (aboveFold === false) {
                            var selPos = css.indexOf(sel, currIndex);
                            //update currIndex so we only search from this point from here on.
                            currIndex = css.indexOf(sel, currIndex);

                            //check what comes next: { or ,
                            var nextComma = css.indexOf(',', selPos);
                            var nextOpenBracket = css.indexOf('{', selPos);

                            if (selectorsKept > 0 || (nextComma > 0 && nextComma < nextOpenBracket)) {
                                //we already kept selectors from this rule, so rule will stay

                                //more selectors in selectorList, cut until (and including) next comma
                                if (nextComma > 0 && nextComma < nextOpenBracket) {
                                    css = css.substring(0, selPos) + css.substring(nextComma + 1, css.length);
                                }
                                //final selector, cut until open bracket. Also remove previous comma, as the (new) last selector should not be followed by a comma.
                                else {
                                    var prevComma = css.lastIndexOf(",", selPos);
                                    css = css.substring(0, prevComma) + css.substring(nextOpenBracket, css.length);
                                }
                            }
                            else {
                                //no part of selector matched elements above fold on page - remove whole rule CSS rule
                                var endRuleBracket = css.indexOf('}', nextOpenBracket);

                                css = css.substring(0, selPos) + css.substring(endRuleBracket + 1, css.length);
                            }
                        }
                    }
                    //if rule stayed, move our cursor forward for matching new selectors
                    if (selectorsKept > 0) {
                        currIndex = css.indexOf("}", currIndex) + 1;
                    }
                }
                return css;

            }, options.css);

            //final cleanup
            //remove all empty rules, and remove leading/trailing whitespace
            css = css.replace(/[^{}]*\{\s*\}/gm, '').trim();

            css = rmUnusedFontFace(css);

            callback(css);
        }
    });
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
    //\7d = '\' + '}'.charCodeAt(0).toString(16);
    css = css.replace(/(content(.|[\r\n])*['"].*)}((.|[\r\n])*;)/gm, "$1" + "\\7d" + "$3");

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
        css = css.substring(0, start) + css.substring(end, css.length);
    }

    return css;
};

var parser, parse, usage, options;

// test to see if we are running as a standalone script
// or as part of the node module
if( typeof embeddedParser !== 'undefined') { //standalone
    parse = parseOptions;
    usage = usageString;
} else {  // we are running in node
    parser = require('../options-parser');
    parse = parser.parse;
    usage = parser.usageString;
}

try { 
    options = parse(system.args.slice(1));
} catch(ex) {
    errorlog('Caught error parsing arguments: ' + ex.message);
    errorlog('Usage: phantomjs penthouse.js ' + usage);
    phantom.exit(1);
}

// set defaults
if(!options.width) options.width = 1300;
if(!options.height) options.height = 900;

main(options);
