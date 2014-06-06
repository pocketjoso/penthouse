// Penthouse CSS Critical Path Generator v0.1.0
// https://github.com/pocketjoso/penthouse
// Author: Jonas Ohlsson
// License: MIT

// USAGE:
// phantomjs penthouse.js [URL to page] [CSS file] > [critical path CSS file]
//
// dependencies
// + "phantomjs" : "~1.9.7"

'use strict';

/*
 * Variables
 *------------*/

var page = require('webpage').create(),
	fs = require('fs'),
	system = require('system'),
	url,
	cssFilePath,
	//resolution to ensure critical path css will cover
	resolution = {w: 1300, h: 900},
	css;

/*
 * Methods
 *-----------*/
//shortcut for logging
var log = function(msg) {window.console&&console.log&&console.log(msg)};


/*=== preFormatCSS ===
 * preformats the css to ensure we won't run into and problems in our parsing
 * removes comments (actually would be anough to remove/replace {} chars.. TODO
 * replaces } char inside content: "" properties.
  ---------------------------------------------------------*/
var preFormatCSS = function(css) {
	//remove comments from css (including multi-line coments) before we start working with it,
	//so we can rely on {} to be splitting rules.
	css = css.replace(/\/\*[\s\S]*?\*\//g, ''); 
	
	//we also need to replace eventual close curly bracket characters inside content: "" property declarations, replace them with their ASCI code equivalent
	//\7d = '\' + '}'.charCodeAt(0).toString(16);
	css = css.replace(/(content(.|[\r\n])*['"].*)}((.|[\r\n])*;)/gm,"$1"+"\\7d"+"$3");
	
	return css;
}

/*=== main ===
 * tests each selector in css file at specified resolution,
 * to see if any such elements appears above the fold on the page
 * modifies CSS - removes selectors that don't appear, and empty rules
 * logs new CSS, then exits PhantomJS
 ---------------------------------------------------------*/
var main = function(res){
	page.viewportSize = {
	  width: res.w,
	  height: res.h
	};

	page.open(url, function(status) {
		if (status !== 'success') {
			log('Unable to access network');
			phantom.exit();
		} else {
			css = page.evaluate(function(css) {
				var h = window.innerHeight,
					split = css.split(/[{}]/g),
					keepHover = false,
					finished = false,
					currIndex = 0,
					forceRemoveNestedRule = false; 

				var getNewValidCssSelector = function(i){
					var newSel = split[i];
					if(newSel.indexOf("@font-face") > -1){
						//just leave @font-face rules in. TODO: rm unused @fontface rules.
						currIndex = css.indexOf("}", currIndex)+1;
						return getNewValidCssSelector(i+2);
					}
					else if (newSel.indexOf("@media") > -1){ //media queries..
						//skip the media query line, which is not a css selector
					   return getNewValidCssSelector(i+1);
					}
					else if (/@([a-z\-])*keyframe/g.test(newSel)){
						//remove @keyframe rules completely - don't belong in critical path css
						//do it via forcing delete on child css rules (inside f.e. @keyframe declaration)
						forceRemoveNestedRule = true;
						return getNewValidCssSelector(i+1);
					}
					else if (newSel.trim().length === 0){
						//end of nested rule (f.e. @media, @keyframe), or file..;
						
						if (i+1 >= split.length){
							//end of file
							finished = true;
							return false;
						}
						//end of nested selector, f.e. end of media query
						forceRemoveNestedRule = false;
						return getNewValidCssSelector(i+1);
					} 
					else if (newSel.indexOf(";") > -1){
						//remove incorrect css rule
						var incorrectRuleStart = css.indexOf(newSel, currIndex),
							incorrectRuleEnd = css.indexOf("}", incorrectRuleStart);
							
						css = css.substring(0, incorrectRuleStart) + css.substring(incorrectRuleEnd+1, css.length);
						return getNewValidCssSelector(i+1);
					}
					return i;					
				}

				for(var i=0; i < split.length; i=i+2){
					//step over non DOM CSS selectors (@font-face, @media..)
					i = getNewValidCssSelector(i);
					var fullSel = split[i];
					
					if(finished) {
						return css;
					}
					
					//fullSel can contain combined selectors
					//,f.e.  body, html {}
					//split and check one such selector at the time.
					var selSplit = fullSel.split(',');
					//keep track - if we remove all selectors, we also want to remove the whole rule.
					var selectorsKept = 0;
					
					for(var j=0; j<selSplit.length;j++){
						var sel = selSplit[j];
						
						//some selectors can't be matched on page.
						//In these cases we test a slightly modified selectors instead, temp.
						var temp = sel;
						
						//if not to keep hover, let it go through here as is - won't match anything on page and therefor will be removed from CSS
						if(!keepHover && sel.indexOf(":hover") > -1) {
							var xxx = 3;
						} else if (sel.indexOf(":") > -1) {
							//handle special case selectors, the ones that contain a semi colon (:)
							//many of these selectors can't be matched to anything on page via JS,
							//but that still might affect the above the fold styling
							
							//these psuedo selectors depend on an element,
							//so test element instead (would do the same for f.e. :focus, :active IF we wanted to keep them for critical path css, but we don't)
							temp = temp.replace(/(:hover|:?:before|:?:after)*/g,'');
							
							//if selector is purely psuedo (f.e. ::-moz-placeholder), just keep as is.
							//we can't match it to anything on page, but it can impact above the fold styles
							if(temp.replace(/:[:]?([a-zA-Z0-9\-\_])*/g,'').trim().length === 0) {
								currIndex = css.indexOf(sel, currIndex) + sel.length;
								continue;
							}
							
							//handle browser specific psuedo selectors bound to elements,
							//Example, button::-moz-focus-inner, input[type=number]::-webkit-inner-spin-button
							//remove browser specific pseudo and test for element
							temp = temp.replace(/:?:-[a-z-]*/g,'');
						}
						
						if(!forceRemoveNestedRule){
							//now we have a selector to test, first grab any matching elements
							try {
								el = document.querySelectorAll(temp);
							} catch(e){
								continue;
							}
												
							//check if selector matched element(s) on page..
							var aboveFold = false;
							for(var k=0; k<el.length; k++){
								var testEl = el[k];
								
								//check to see if any matched element is above the fold on current page
								//(in current viewport size)
								if(testEl.getBoundingClientRect().top < h) {
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
						if(aboveFold === false) {
							var selPos = css.indexOf(sel, currIndex);
							//update currIndex so we only search from this point from here on.
							currIndex = css.indexOf(sel, currIndex);
							
							//check what comes next: { or ,
							var nextComma = css.indexOf(',', selPos);
							var nextOpenBracket = css.indexOf('{', selPos);
							
							if(selectorsKept > 0 || (nextComma > 0 && nextComma < nextOpenBracket)){
								//we already kept selectors from this rule, so rule will stay
								
								//more selectors in selectorList, cut until (and including) next comma
								if(nextComma > 0 && nextComma < nextOpenBracket) {
									css = css.substring(0,selPos) + css.substring(nextComma+1, css.length);
								}
								//final selector, cut until open bracket. Also remove previous comma, as the (new) last selector should not be followed by a comma.
								else {
									var prevComma = css.lastIndexOf(",", selPos);
									css = css.substring(0,prevComma) + css.substring(nextOpenBracket, css.length);
								}
							}
							else {
								//no part of selector matched elements above fold on page - remove whole rule CSS rule
								var endRuleBracket = css.indexOf('}',nextOpenBracket);
								
								css = css.substring(0,selPos) + css.substring(endRuleBracket+1, css.length);
							}
						}
					}
					//if rule stayed, move our cursor forward for matching new selectors
					if(selectorsKept>0){
						currIndex = css.indexOf("}", currIndex)+1;
					}
				}
				return css;

			},css);
			
			
			
			//final cleanup
			//remove all empty rules, and remove leading/trailing whitespace
			css = css.replace(/^([^{}]*\{\s*\})/gm, '').trim();
			
			//we're done, log the result as the output from phantomjs execution of this script!
			log(css);
			phantom.exit();
		}
	});
}



/*
 * Init/API/Events
 *-----------*/
 //don't confuse analytics more than necessary when visiting websites
page.settings.userAgent = 'Penthouse Critical Path CSS Generator';
//url needs to be passed in
if (system.args.length < 3) {
  log('Usage: penthouse.js [some URL] [path to css file]');
  phantom.exit();
}
url = system.args[1];
cssFilePath = system.args[2];

try {
    var f = fs.open(cssFilePath, "r");
    css = f.read();
	css = preFormatCSS(css);
} catch (e) {
    console.log(e);
	phantom.exit();
}


//start the critical path CSS generation
// - exists the program from within
main(resolution);