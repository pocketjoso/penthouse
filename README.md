# penthouse

> Critical Path CSS Generator

[![NPM version][npm-image]][npm-url]
[![Build Status][travis-image]][travis-url]
[![Downloads][dlcounter-image]][npm-url]

## About

Penthouse is the original critical path css generator, helping you out to speed up page rendering for your websites. Supply your site's full CSS and the page you want to create the critical CSS for, and Penthouse will return the critical CSS needed to perfectly render the above the fold content of the page. Read more about critical path css [here](http://www.phpied.com/css-and-the-critical-path/).

The process is automatic and the generated CSS is production ready as is. Behind the scenes Penthouse is using [puppeteer](https://github.com/GoogleChrome/puppeteer) to generate the critical css via the chromium:headless.

## Usage

(If you don’t want to write code, you can use [the online hosted version](https://jonassebastianohlsson.com/criticalpathcssgenerator/).)

```
yarn add --dev penthouse
```
(or `npm install`, if not using [yarn](https://yarnpkg.com))

### Basic example

```js
penthouse({
  url: 'http://google.com',
  cssString: 'body { color: red }'
})
.then(criticalCss => {
  // use the critical css
  fs.writeFileSync('outfile.css', criticalCss);
})
```
Note: `Penthouse` returns a promise (since version `0.11`),
but if you prefer you can also pass in a traditional node-style `callback`
function as the second argument.

### More examples
https://github.com/pocketjoso/penthouse/tree/master/examples

### Performance when running many jobs
Penthouse is optimised for running many jobs in parallel.
One shared browser instance is re-used and each job runs in its own browser tab.
There's only so many jobs you can run in parallel before your machine starts running out of resources. To run many jobs effectively, see the [many urls example](https://github.com/pocketjoso/penthouse/tree/master/examples/many-urls.js).

## Options
Only `url` and `cssString` are required - all other options are optional.

| Name             | Type               | Default | Description   |
| ---------------- | ------------------ | ------------- |------------- |
| url           | `string` | | Accessible url. Use `file:///` protocol for local html files. |
| cssString     | `string` | | Original css to extract critical css from |
| css           | `string` | | Path to original css file on disk (if using instead of `cssString`) |
| width         | `integer` | `1300` | Width for critical viewport |
| height        | `integer` | `900` | Height for critical viewport |
| screenshots   | `object` | | Configuration for screenshots (not used by default). See [Screenshot example](https://github.com/pocketjoso/penthouse/tree/master/examples/screenshots.js)  |
| keepLargerMediaQueries | `boolean` | `false` | Keep media queries even for width/height values larger than critical viewport. |
| forceInclude | `array` | `[]` | Array of css selectors to keep in critical css, even if not appearing in critical viewport. Strings or regex (f.e. `['.keepMeEvenIfNotSeenInDom', /^\.button/]`) |
| propertiesToRemove | `array` | `['(.*)transition(.*)', 'cursor', 'pointer-events', '(-webkit-)?tap-highlight-color', '(.*)user-select']` ] | Css properties to filter out from critical css |
| timeout       | `integer` | `30000` | Ms; abort critical CSS generation after this time |
| puppeteer     | `object`  | | Settings for puppeteer. See [Custom puppeteer browser example](https://github.com/pocketjoso/penthouse/tree/master/examples/custom-browser.js) |
| pageLoadSkipTimeout | `integer` | `0` | Ms; stop waiting for page load after this time (for sites when page load event is unreliable) |
| renderWaitTime | `integer` | `100` | ms; wait time after page load before critical css extraction starts |
| blockJSRequests | `boolean` | `true` | set to false to load JS (not recommended)
| maxEmbeddedBase64Length | `integer` | `1000` | characters; strip out inline base64 encoded resources larger than this |
| maxElementsToCheckPerSelector | `integer` | `undefined` | Can be specified to limit nr of elements to inspect per css selector, reducing execution time.
| userAgent | `string` | `'Penthouse Critical Path CSS Generator'` | specify which user agent string when loading the page |
| customPageHeaders | `object` | | Set extra http headers to be sent with the request for the url. |
| strict | `boolean` | `false` | Make Penthouse throw on errors parsing the original CSS. Legacy option, not recommended. |

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
