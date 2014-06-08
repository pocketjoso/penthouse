#penthousee
##Critical Path CSS Generator for PhantomJS

[![NPM version](https://badge.fury.io/js/penthouse.svg)](http://badge.fury.io/js/penthouse)

Online version on: http://jonassebastianohlsson.com/criticalpathcssgenerator/

### Usage

#### Command line
[PhantomJS](https://github.com/ariya/phantomjs/) has to be set up first.

	phantomjs --config=[path to config]config.json penthouse.js [URL to page] [CSS file] > [critical path CSS file]
	
	//for example
	phantomjs --config=config.json penthouse.js http://mySite.com/home css/myFullSiteStyles.css > css/home-critical-path.css
	
Config is required to handle SSL and https urls.

#### Online use
If you don't want to install phantomJS and run via terminal, you can just use the online version instead - it uses the same code backend:
http://jonassebastianohlsson.com/criticalpathcssgenerator/

### License
MIT