# penthouse

> Critical Path CSS Generator

[![NPM version][npm-image]](npm-url)
[![Build Status][travis-image]][travis-url]
[![Downloads][dlcounter-image]][npm-url]

## About

Penthouse is the original critical path css generator, helping you out to speed up page rendering for your websites. Supply your site's full CSS and the page you want to create the critical CSS for, and Penthouse will return the critical CSS needed to perfectly render the above the fold content of the page. Read more about critical path css [here](http://www.phpied.com/css-and-the-critical-path/).

The process is automatic and the generated CSS is production ready as is. Behind the scenes Penthouse is using [puppeteer](https://github.com/GoogleChrome/puppeteer) to generate the critical css via the chromium:headless.

## Usage

Penthouse can be used:

* [as a Node module](#as-a-node-module)
* via [the online version](#online-version)

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
penthouse({
    url: 'http://google.com',       // can also use file:/// protocol for local files
    cssString: 'body { color; red }', // the original css to extract critcial css from
    // css: 'pathTo/main.css',      // path to original css file on disk

    // OPTIONAL params
    width: 1300,                    // viewport width
    height: 900,                    // viewport height
    keepLargerMediaQueries: false,  // when true, will not filter out larger media queries
    forceInclude: [ // selectors to keep
      '.keepMeEvenIfNotSeenInDom',
      /^\.regexWorksToo/
    ],
    propertiesToRemove: [
      '(.*)transition(.*)',
      'cursor',
      'pointer-events',
      '(-webkit-)?tap-highlight-color',
      '(.*)user-select'
    ],
    timeout: 30000,                 // ms; abort critical CSS generation after this timeout
    pageLoadSkipTimeout: 0,         // ms; stop waiting for page load after this timeout (for sites with broken page load event timings)
    strict: false,                  // set to true to throw on CSS errors (will run faster if no errors)
    maxEmbeddedBase64Length: 1000,  // characters; strip out inline base64 encoded resources larger than this
    userAgent: 'Penthouse Critical Path CSS Generator', // specify which user agent string when loading the page
    renderWaitTime: 100,            // ms; render wait timeout before CSS processing starts (default: 100)
    blockJSRequests: true,          // set to false to load (external) JS (default: true)
    customPageHeaders: {
      'Accept-Encoding': 'identity' // add if getting compression errors like 'Data corrupted'
    },
    screenshots: {
      // turned off by default
      // basePath: 'homepage', // absolute or relative; excluding file extension
      // type: 'jpeg', // jpeg or png, png default
      // quality: 20 // only applies for jpeg type
      // -> these settings will produce homepage-before.jpg and homepage-after.jpg
    },
    puppeteer: {
      getBrowser: undefined,        // A function that resolves with a puppeteer browser to use instead of launching a new browser session
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

## Troubleshooting

### Not working on Linux
Install missing dependencies to get the headless Chrome to run:

```
sudo apt-get install libnss3
```
You might possibly need an even longer list of deps, depending on your dist,
see [this answer](https://github.com/GoogleChrome/puppeteer/issues/404#issuecomment-323555784)

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

[npm-image]: https://badge.fury.io/js/penthouse.svg
[npm-url]: https://npmjs.org/package/penthouse

[travis-url]: https://travis-ci.org/pocketjoso/penthouse
[travis-image]: https://secure.travis-ci.org/pocketjoso/penthouse.svg?branch=master

[dlcounter-image]: https://img.shields.io/npm/dm/penthouse.svg?style=flat
