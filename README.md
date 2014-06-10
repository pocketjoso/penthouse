#penthouse
> Critical Path CSS Generator

[![NPM version](https://badge.fury.io/js/penthouse.svg)](http://badge.fury.io/js/penthouse)


## Usage

This module can be used standalone or be `require`d as a normal Node module.

### As a standalone command line tool

#### Installation

    npm install -g penthouse

#### Usage

	penthouse [--width <width>] [--height <height>] <URL to page> <CSS file>

The width and height parameters are optional and have defaults of 1300 and 900 respectively.
	
Example

	penthouse http://mySite.com/home css/myFullSiteStyles.css > css/home-critical-path.css

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

## Online version
If you don't want to run via terminal, you can just use the online version instead - it uses the same code backend:
http://jonassebastianohlsson.com/criticalpathcssgenerator/

### License
MIT