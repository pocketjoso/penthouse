#penthouse
##Critical Path CSS Generator

[![NPM version](https://badge.fury.io/js/penthouse.svg)](http://badge.fury.io/js/penthouse)

Online version on: http://jonassebastianohlsson.com/criticalpathcssgenerator/

### Usage

#### Command line
[PhantomJS](https://github.com/ariya/phantomjs/) has to be set up first.

	penthouse [URL to page] [CSS file] > [critical path CSS file]
	
	//for example
	penthouse.js http://mySite.com/home css/myFullSiteStyles.css > css/home-critical-path.css

#### Online version
If you don't want to install phantomJS and run via terminal, you can just use the online version instead - it uses the same code backend:
http://jonassebastianohlsson.com/criticalpathcssgenerator/

### License
MIT