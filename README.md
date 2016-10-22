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
npm install --save-dev penthouse
```

This will add penthouse to the list of dependencies.

Require as normal and execute with a callback:

```js
var penthouse = require('penthouse'),
    path = require('path'),
    fs = require('fs'),
    __basedir = './';

penthouse({
    url: 'http://google.com',
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
      'proxy': 'http://proxy.company.com:8080',
      'ssl-protocol': 'SSLv3'
    }
}, function(err, criticalCss) {
    if (err) {
        // handle error
        throw err;
    }

    fs.writeFileSync('outfile.css', criticalCss);
});
```

The Penthouse Node module can also be used in Gulp.

### Online version

<https://jonassebastianohlsson.com/criticalpathcssgenerator/>

### From command line

The command line version is no longer supported. Either use the [Node module](#as-a-node-module), or download the last
supported command line version and follow the instructions in the README there: [v.0.3.6](https://github.com/pocketjoso/penthouse/releases/tag/v0.3.6).

## Problems with generated CSS

### Invalid CSS

Before going further, make sure that you fix any errors in CSS as detected by [this CSS parser](http://iamdustan.com/reworkcss_ast_explorer/), as they can cause problem with critical CSS generation.

### Background images or Fonts missing

Change any relative paths (f.e. `background-image: url("../images/x.gif");`) to absolute (starting with a `/`): `background-image: url("/images/x.gif");`, and then try again.

### Unstyled content showing

If you for some reason have an element appearing early in the DOM, but that you apply styles to move outside of the above the fold content (using absolute position or transforms), consider whether it really should appear so early in the DOM.

### Special glyphs not showing/showing incorrectly

Problems with special characters like &#8594; after converting? Make sure you use the correct hexadecimal format in your CSS. You can always get this format from your browser console, by entering '&#8594;'`.charCodeAt(0).toString(16)` (answer for this arrow glyph is `2192`). When using hexadecimal format in CSS it needs to be prepended with a backslash, like so: `\2192` (f.e. `content: '\2192';`)

### Other problems

Please report your issue (check that it's not already there first though!), and I will try to fix it as soon as possible.
