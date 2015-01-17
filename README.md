#penthouse
> Critical Path CSS Generator

[![NPM version](https://badge.fury.io/js/penthouse.svg)](http://badge.fury.io/js/penthouse)
[![Build Status](https://travis-ci.org/pocketjoso/penthouse.svg?branch=master)](https://travis-ci.org/pocketjoso/penthouse)

## About
Penthouse is a tool generating critical path css for your web pages and web apps in order to speed up page rendering. Supply the tool with your site's full CSS, and the page you want to create the critical CSS for, and it will return all the CSS needed to render the above the fold content of the page. Read more about critical path css [here](http://www.phpied.com/css-and-the-critical-path/).

The process is automatic and the generated css is production as is. If you run in to problems however, check out the [Problems section](https://github.com/pocketjoso/penthouse/#problems-with-generated-css) further down on this page.

## Usage

Penthouse can be used:
 * from the command line
 * [as a Node module](https://github.com/pocketjoso/penthouse/#as-a-node-module)
 * [as a Grunt task](https://github.com/fatso83/grunt-penthouse)
 * as a Gulp task (just require Node module straight from your script)
 * via [the online version](https://github.com/pocketjoso/penthouse#online-version)

### From command line

#### Installation

Install [PhantomJS](https://github.com/ariya/phantomjs) first, and make sure it works for you. Then download the `penthouse.js` file.

#### Usage

	phantomjs penthouse.js [URL to page] [CSS file] > [critical path CSS file]

	//for example
	phantomjs penthouse.js http://mySite.com/page1 allStyles.css > page1-critical-styles.css
	phantomjs penthouse.js http://mySite.com/page2 allStyles.css > page2-critical-styles.css

##### HTTPS

To run on HTTPS pages two extra flags must be passed in, directly after phantomjs in the call:

	--ignore-ssl-errors=true --ssl-protocol=tlsv1
	//as such:
	phantomjs --ignore-ssl-errors=true --ssl-protocol=tlsv1 penthouse.js [URL to page] [CSS file] > [critical path CSS file]

##### Optional parameters
By default penthouse gives you the css needed to render a viewport of size `1300x900`. This css will cover all smaller viewport sizes, unless you're delivering a different DOM or doing something crazy. You can pass in your a different `viewport width` and `viewport height` if you want; these two params must follow the `[CSS file]` like this:

	phantomjs penthouse.js [URL to page] [CSS file] [Viewport WIDTH] [Viewport HEIGHT] > [critical path CSS file]


### As a Node module

#### Installation

    npm install --save-dev penthouse

This will add penthouse to the list of dependencies

#### Usage

Require as normal and execute with a callback

    var penthouse = require('penthouse'),
        path = require('path');

    penthouse({
        url : 'http://google.com',
        css : path.join(__basedir + 'static/main.css'),
        width : 400,   // viewport width
        height : 240   // viewport height
    }, function(err, criticalCss) {
        console.log(criticalCss);
    });

The Penthouse Node module can also be used as in Gulp.

## Online version
http://jonassebastianohlsson.com/criticalpathcssgenerator/


## Problems with generated CSS

###Background images or Fonts missing
Change any relative paths (f.e. `background-image: url("../images/x.gif");`) to absolute (starting with a `/`): `background-image: url("/images/x.gif");`, and then try again.

###Unstyled content showing
The most common problem is with clearing floats. Instead of clearing elements appearing after floated elements (f.e. using `clear:both;`), clear the floats themselves by using the [clear-fix pattern](http://css-tricks.com/snippets/css/clear-fix/). Float clearing will now work also in the generated critical css.

If you for some reason have an element appearing early in the DOM, but that you apply styles to move outside of the above the fold content (using absolute position or transforms), consider whether it really should appear so early in the DOM.

###Special glyphs not showing/showing incorrectly
Problems with special characters like &#8594; after converting? Make sure you use the correct hexadecimal format in your CSS. You can always get this format from your browser console, by entering '&#8594;'`.charCodeAt(0).toString(16)` (answer for this arrow glyph is `2192`). When using hexadecimal format in CSS it needs to be prepended with a backslash, like so: `\2192` (f.e. `content: '\2192';`)

###Other problems
Please report your issue (check that it's not already there first though!), and I will try to fix it as soon as possible.

## Changelog
2015-01-17    v0.2.53    Fix bug from 2.52, improved tests (@pocketjoso)  
2015-01-11    v0.2.52   Fix minor removal bug with minified css (@pocketjoso)  
2014-10-24    v0.2.51   Remove animation declarations (@pocketjoso)  
2014-07-27    v0.2.5    Handle all non nested @-rules (@pocketjoso)  
2014-07-20    v0.2.4    Fix extra line break bug on Windows (@pocketjoso)  
2014-07-19    v0.2.3    Improved @-rule handling (@pocketjoso)  
2014-07-12    v0.2.2    Remove :hover, and invalid, selectors (@pocketjoso)  
2014-06-20    v0.2.1    Handle previous content clearing styles (@pocketjoso)  
2014-06-10    v0.2.0    Node module and standalone executable (@fatso83)  
2014-06-05    v0.1.0    Published on NPM (@pocketjoso)  
2014-06-04    v0.0.0    PhantomJS script /core logic (@pocketjoso)
