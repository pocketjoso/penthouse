# penthouse

> Critical Path CSS Generator

[![NPM version][npm-image]][npm-url]
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
    url: 'http://google.com',       // can also use file:/// protocol for local files or html content as string
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
    maxEmbeddedBase64Length: 1000,  // characters; strip out inline base64 encoded resources larger than this
    userAgent: 'Penthouse Critical Path CSS Generator', // specify which user agent string when loading the page
    renderWaitTime: 100,            // ms; render wait timeout before CSS processing starts (default: 100)
    blockJSRequests: true,          // set to false to load (external) JS (default: true)
    customPageHeaders: {
      'Accept-Encoding': 'identity' // add if getting compression errors like 'Data corrupted'
    },
    strict: false,                  // set to true to throw on CSS errors
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


### Enable debug logging
Logging is done via the [`debug`](https://github.com/visionmedia/debug) module under the `penthouse` namespace. You can view more about the logging on their [documentation](https://github.com/visionmedia/debug#usage).

```sh
# Basic verbose logging for all components
env DEBUG="penthouse,penthouse:*" node script.js
```

### Not working on Linux
Install missing dependencies to get the headless Chrome to run:

```
sudo apt-get install libnss3
```
You might possibly need an even longer list of deps, depending on your dist,
see [this answer](https://github.com/GoogleChrome/puppeteer/issues/404#issuecomment-323555784)

### Problems with generated CSS

A good first step can be to test your url + css in the hosted critical path css generator, to determine whether the problem
is with the input your passing (css + url), or with your local setup:
https://jonassebastianohlsson.com/criticalpathcssgenerator

#### Unstyled content showing when using the critical css

If you see flashes of unstyled content showing after applying your critical css then something is wrong. Below are the most commont causes and some general related advice:

##### Your page contains dynamic or JS injected/activated content.
Generally you have to ensure that all elements you want styled in the critical css appears (visible) in the HTML of your page (with Javascript disabled). The first render of your page, the one critical css helps make much faster, happens _before_ JS has loaded, which is why Penthouse runs with JavaScript disabled. So if your html is essentially empty, or your real content is hidden before a loading spinner or similar you have to adress this before you can get the performance benefits of using critical css.

If your html is fine, but varies based on things such as the logged in user, third party advertising etc, then you can use the `forceInclude` parameter to force specific extra styles to remain in the critical css, even if Penthouse doesn’t see them on the page during critical css generation.

##### Early DOM content moved out of critical viewport via CSS
This problem can happen if you have an element appearing early in the DOM, but with styles applied to move outside of the critical viewport (using absolute position or transforms). Penthouse does not look at the absolute position and transform values and will just see the element as not being part of the critical viewport, and hence Penthouse will not consider it’s styles critical (so the unstyled element will show when the critical css is used).
Solution: Consider whether it really should appear so early in the DOM, or use the `forceInclude` property to make sure the styles to "hide"/move it are left in the critical css.

#### Special glyphs not showing/showing incorrectly

Problems with special characters like &#8594; after converting? Make sure you use the correct hexadecimal format in your CSS. You can always get this format from your browser console, by entering '&#8594;'`.charCodeAt(0).toString(16)` (answer for this arrow glyph is `2192`). When using hexadecimal format in CSS it needs to be prepended with a backslash, like so: `\2192` (f.e. `content: '\2192';`)

[npm-image]: https://badge.fury.io/js/penthouse.svg
[npm-url]: https://npmjs.org/package/penthouse

[travis-url]: https://travis-ci.org/pocketjoso/penthouse
[travis-image]: https://secure.travis-ci.org/pocketjoso/penthouse.svg?branch=master

[dlcounter-image]: https://img.shields.io/npm/dm/penthouse.svg?style=flat
