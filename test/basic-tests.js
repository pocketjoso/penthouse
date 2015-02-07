var penthouse = require('../lib/'),
	chai = require('chai'),
	should = chai.should(),
	css = require('css'),
	fs = require('fs'),
	read = fs.readFileSync,
	path = require('path'),
	async = require('async'),
	glob = require('glob');

//penthouse.DEBUG = true;

describe('basic tests of penthouse functionality', function () {
	var page1cssPath = path.join(__dirname, 'static-server', 'page1.css'),
		sharedCssFilePath = path.join(__dirname, 'static-server', 'shared.css'),
		originalCss = read(page1cssPath).toString(),
		page1, server, port;

	// phantomjs takes a while to start up
	this.timeout(5000);

	before(function (done) {
		startServer(function (instance, serverPort) {
			server = instance;
			port = serverPort;
			page1 = ('http://localhost:' + port + '/page1.html');
			done();
		});
	});

	after(function (done) {
		server.close();
		done();
	});

	it('should return css', function (done) {
    penthouse({
      url: page1,
      cssFile: page1cssPath
  	}, function (err, result) {
      if(err) { done(err); }
      try {
        css.parse(result);
        done();
      } catch (ex) {
        done(ex);
      }
    });
	});

	it('should return a css file whose parsed AST is equal to the the original\'s AST when the viewport is large', function (done) {
		var widthLargerThanTotalTestCSS = 1000,
			heightLargerThanTotalTestCSS = 1000;
		penthouse({
			url    : page1,
			cssFile : page1cssPath,
			width   : widthLargerThanTotalTestCSS,
			height  : heightLargerThanTotalTestCSS
		}, function (err, result) {
			if (err) {
				done(err);
				return;
			}
			try {
				var resultAst = css.parse(result);
				var orgAst = css.parse(originalCss);
				resultAst.should.eql(orgAst);
				done();
			} catch (ex) {
				done(ex);
			}

		});
	});

	it('should return a subset of the original AST rules when the viewport is small', function (done) {
		var widthLargerThanTotalTestCSS = 1000,
			heightSmallerThanTotalTestCSS = 100;
		penthouse({
			url    : page1,
			cssFile : page1cssPath,
			width   : widthLargerThanTotalTestCSS,
			height  : heightSmallerThanTotalTestCSS
		}, function (err, result) {
			if (err) { done(err); }
			try {
				var resultAst = css.parse(result);
				var orgAst = css.parse(originalCss);
				resultAst.stylesheet.rules.should.have.length.lessThan(orgAst.stylesheet.rules.length);
				// not be empty
				done();
			} catch (ex) {
				done(ex);
			}

		});
	});

});

function startServer (done) {
	var portfinder = require('portfinder');

	portfinder.getPort(function (err, port) {
		//
		// `port` is guaranteed to be a free port
		// in this scope.

		var app = require('./static-server/app.js');
		var server = app.listen(port);

		done(server, port);
	});
}
