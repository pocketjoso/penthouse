# penthouse

> Critical Path CSS Generator

[![NPM version](https://badge.fury.io/js/penthouse.svg)](http://badge.fury.io/js/penthouse)
[![Build Status](https://travis-ci.org/pocketjoso/penthouse.svg?branch=master)](https://travis-ci.org/pocketjoso/penthouse)
[![Downloads](https://img.shields.io/npm/dm/penthouse.svg?style=flat)](https://www.npmjs.com/package/penthouse)

## About

Penthouse is a tool generating critical path CSS for your web pages and web apps in order to speed up page rendering. Supply the tool with your site's full CSS, and the page you want to create the critical CSS for, and it will return all the CSS needed to render the above the fold content of the page. Read more about critical path css [here](http://www.phpied.com/css-and-the-critical-path/).

The process is automatic and the generated CSS is production ready as is. If you run into problems however, check out the [Problems section](#problems-with-generated-css) further down on this page.

## Usage

Penthouse can be used:

* [as a Node module](#as-a-node-module)
* [as a Grunt task](https://github.com/fatso83/grunt-penthouse)
* as a Gulp task (just require Node module straight from your script)
* via [the online version](#online-version)
* [from the command line](#from-command-line)

### As a Node module

```
yarn add --dev penthouse
```
(or `npm install`, if not using [yarn](https://yarnpkg.com))

This will add penthouse to the list of dependencies.

`Penthouse` returns a promise (since version `0.11`),
but if you prefer you can also pass in a traditional node-style `callback`
function as the second argument.

```js
const penthouse = require('penthouse'),
    path = require('path'),
    fs = require('fs'),
    __basedir = './';

penthouse({
    url: 'http://google.com',       // can be local html file path
    css: path.join(__basedir + 'static/main.css'),
    // OPTIONAL params
    width: 1300,                    // viewport width
    height: 900,                    // viewport height
    forceInclude: [
      '.keepMeEvenIfNotSeenInDom',
      /^\.regexWorksToo/
    ],
    timeout: 30000,                 // ms; abort critical CSS generation after this timeout
    strict: false,                  // set to true to throw on CSS errors (will run faster if no errors)
    maxEmbeddedBase64Length: 1000,  // characters; strip out inline base64 encoded resources larger than this
    userAgent: 'Penthouse Critical Path CSS Generator', // specify which user agent string when loading the page
    renderWaitTime: 100,            // ms; render wait timeout before CSS processing starts (default: 100)
    blockJSRequests: true,          // set to false to load (external) JS (default: true)
    phantomJsOptions: {             // see `phantomjs --help` for the list of all available options
      // 'proxy': 'http://proxy.company.com:8080',
      // 'ssl-protocol': 'SSLv3'
    },
    customPageHeaders: {
      'Accept-Encoding': 'identity' // add if getting compression errors like 'Data corrupted'
    }
})
.then(criticalCss => {
    // use the critical css
    fs.writeFileSync('outfile.css', criticalCss);
})
.catch(err => {
    // handle the error
})
```

The Penthouse Node module can also be used in Gulp.

### Online version

<https://jonassebastianohlsson.com/criticalpathcssgenerator/>

### From command line

The command line version is no longer supported. Either use the [Node module](#as-a-node-module), or download the last
supported command line version and follow the instructions in the README there: [v.0.3.6](https://github.com/pocketjoso/penthouse/releases/tag/v0.3.6).

## Troubleshooting

### Problems with generated CSS

Before going further, make sure that you fix any errors in your own CSS, as detected by [this AST explorer](http://astexplorer.net/), as they can cause problems with critical CSS generation.

Also test your url + css in the hosted critical path css generator, to determine whether the problem
is with the input your passing (css + url), or with your local setup:
https://jonassebastianohlsson.com/criticalpathcssgenerator

#### Unstyled content showing when using the critical css

The two most common reasons for this:

1. You have an element appearing early in the DOM, but with styles applied to move outside of the critical viewport (using absolute position or transforms). Penthouse will does not look at the absolute position and transform values and will just see the element as not being part of the critical viewport, and hence Penthouse will not consider its styles critical.
Solution: Consider whether it really should appear so early in the DOM, or use the `forceInclude` property.

2. During render with critical css your page contains some content that Penthouse never saw in the HTML during critical css generation. Perhaps you're a logged in user with the page showing extra content, that were never part of it when Penthouse saw it, or perhaps JS injected some extra content to the page before the full CSS (which contains the styles for that content) loaded.
Solution: Ensure all elements you want styled in the critical css appears in the HTML of the url (or html file) you send Penthouse. You can also use the `forceInclude` parameter to force styles to remain in the critical css.

#### Special glyphs not showing/showing incorrectly

Problems with special characters like &#8594; after converting? Make sure you use the correct hexadecimal format in your CSS. You can always get this format from your browser console, by entering '&#8594;'`.charCodeAt(0).toString(16)` (answer for this arrow glyph is `2192`). When using hexadecimal format in CSS it needs to be prepended with a backslash, like so: `\2192` (f.e. `content: '\2192';`)

### Other problems

#### Penthouse errors
Check that the filepath to the repo you are running Penthouse from does not contain any unusual characters - they are [known to cause problems](https://github.com/pocketjoso/penthouse/issues/156#issuecomment-299729664).
