#!/usr/bin/env node
/* 
 * Cross platform Node based build script 
 * https://github.com/arturadib/shelljs
 *
 * Heavily based on Tero Piirainen's makefile for riotjs-admin
 * https://github.com/muut/riotjs-admin/blob/master/make.js
 */

require('shelljs/make');
var mochaCmd = 'node ./node_modules/mocha/bin/mocha'; 

//die on errors
config.fatal = true;

// initialize repository
function init() {
  mkdir('-p', 'dist');
}

// Make a single file out of everything
function concat() {

  init();

  // riot.js
  var banner = cat(['lib/phantomjs/info.txt', 'lib/phantomjs/usage.txt' ]);
  var js = banner + cat('lib/options-parser.js');

  js += cat('lib/phantomjs/core.js');

  // dist
  js.to('dist/penthouse.js');

}

target.all = function() {
    target.test();
    // too many errors to enable as default
    //target.lint();
    target.build();
};

// Test the functionality (node.js)
target.test = function() {
    exec(mochaCmd + ' test');
};

// lint the source - requires jshint (npm install -g jshint)
target.lint = function() {
  exec('jshint lib');
};

// concat target
target.build = concat;

// watch for changes: ./make.js watch
target.watch = function() {

  // test on any changes
  exec(mochaCmd + ' -w test');
};
