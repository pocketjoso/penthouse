#!/usr/bin/env node
/*
 * Cross platform Node based build script
 * https://github.com/arturadib/shelljs
 *
 * Heavily based on Tero Piirainen's makefile for riotjs-admin
 * https://github.com/muut/riotjs-admin/blob/master/make.js
 */

require('shelljs/make');

var fullName = "Penthouse CSS Critical Path Generator"
var read = require('fs').readFileSync;
var info = JSON.parse(read('package.json'));
var mochaCmd = 'node ./node_modules/mocha/bin/mocha';
var header = '(function() { "use strict"; \n';
var standaloneToken = 'var standaloneMode = true;\n';
var footer = '})();';

//die on errors
config.fatal = true;

// Make a single file out of everything
function concat() {

    var banner = '/*\n' + [
        fullName,
        info.homepage,
        'Author: ' + info.author.name,
        'License: ' + info.license.type,
        'Version: ' + info.version
    ].join('\n')
    + cat('lib/phantomjs/usage.txt') + '*/\n\n\n';

		var js = banner
		+ header
		+ cat('lib/options-parser.js')
		+ cat('lib/phantomjs/unused-fontface-remover.js')
		+ cat('lib/phantomjs/css-preformatter.js')
		+ standaloneToken

		+ cat('lib/phantomjs/core.js')
		+ footer;

    // dist
    js.to('penthouse.js');

}

target.all = function() {
    target.test();
    // too many errors to enable as default, but useful still
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
