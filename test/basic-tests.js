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
    page1 = path.join(__dirname, 'static-server', 'page1.html'),
		originalCss = read(page1cssPath).toString();

	// phantomjs takes a while to start up
	this.timeout(5000);

	it('should return css', function (done) {
    penthouse({
      url: page1,
      css: page1cssPath
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
			css : page1cssPath,
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
			css : page1cssPath,
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

	it('should not crash on special chars', function (done) {
		penthouse({
			url: page1,
			css: path.join(__dirname, 'static-server', 'special-chars.css')
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
});
