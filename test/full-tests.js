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

describe('penthouse functionality tests', function() {
	var page1cssPath = path.join(__dirname, 'static-server', 'page1.css'),
		sharedCssFilePath = path.join(__dirname, 'static-server', 'shared.css'),
		originalCss = read(page1cssPath).toString(),
		page1, server, port;

	// phantomjs takes a while to start up
	this.timeout(5000);

	before(function(done) {
		startServer(function(instance, serverPort) {
			server = instance;
			port = serverPort;
			page1 = ('http://localhost:' + port + '/page1.html');
			done();
		});
	});

	after(function(done) {
		server.close();
		done();
	});

	it('should save css to a file', function(done) {
		penthouse({
			url: page1,
			css: page1cssPath
		}, function(err, result) {
			if (err) {
				done(err);
				return;
			}
			try {
				css.parse(result);
				done();
			} catch (ex) {
				done(ex);
			}
		});
	});

	it('should return a subset of the original AST rules when the viewport is small', function(done) {
		var widthLargerThanTotalTestCSS = 1000,
			heightSmallerThanTotalTestCSS = 100;
		penthouse({
			url: page1,
			css: page1cssPath,
			width: widthLargerThanTotalTestCSS,
			height: heightSmallerThanTotalTestCSS
		}, function(err, result) {
			if (err) {
				done(err);
			}
			try {
				var resultAst = css.parse(result);
				var orgAst = css.parse(originalCss);
				resultAst.stylesheet.rules.should.have.length.lessThan(orgAst.stylesheet.rules.length);
				done();
			} catch (ex) {
				done(ex);
			}
		});
	});

	it('should keep :before, :after rules (because el above fold)', function(done) {
		var pusedoRemainCssFilePath = path.join(__dirname, 'static-server', 'psuedo--remain.css'),
			pusedoRemainCss = read(pusedoRemainCssFilePath).toString();

		penthouse({
			url: page1,
			css: pusedoRemainCssFilePath
		}, function(err, result) {
			try {
				var resultAst = css.parse(result);
				var orgAst = css.parse(pusedoRemainCss);
				resultAst.should.eql(orgAst);
				done();
			} catch (ex) {
				done(ex);
			}
		});
	});


	it('should remove :hover, :active, etc rules - always', function(done) {
		var pusedoRemoveCssFilePath = path.join(__dirname, 'static-server', 'psuedo--remove.css');

		penthouse({
			url: page1,
			css: pusedoRemoveCssFilePath
		}, function(err, result) {
			try {
				result.trim().should.equal('');
				done();
			} catch (ex) {
				done(ex);
			}

		});
	});


	/*==@-rule handling==*/

	/* - Case 0 : Non nested @-rule [REMAIN]
		(@charset, @import, @namespace)
	*/
	it('should keep complete case 0 @-rules (@import, @charset, @namespace)', function(done) {
		var atRuleCase0RemainCssFilePath = path.join(__dirname, 'static-server', 'at-rule-case-0--remain.css'),
			atRuleCase0RemainCss = read(atRuleCase0RemainCssFilePath).toString();

		penthouse({
			url: page1,
			css: atRuleCase0RemainCssFilePath
		}, function(err, result) {
			try {
				var resultAst = css.parse(result);
				var orgAst = css.parse(atRuleCase0RemainCss);
				resultAst.should.eql(orgAst);
				done();
			} catch (ex) {
				done(ex);
			}

		});
	});


	/*	- Case 1: @-rule with CSS properties inside [REMAIN]
		(NOTE: @font-face is removed later in code, unless it is used.
				Therefor currently this test has to include CSS 'using' the @font-face)
	*/
	it('should keep complete case 1 @-rules (@font-face, @page)', function(done) {
		var atRuleCase1RemainCssFilePath = path.join(__dirname, 'static-server', 'at-rule-case-1--remain.css'),
			atRuleCase1RemainCss = read(atRuleCase1RemainCssFilePath).toString();

		penthouse({
			url: page1,
			css: atRuleCase1RemainCssFilePath
		}, function(err, result) {
			try {
				var resultAst = css.parse(result);
				var orgAst = css.parse(atRuleCase1RemainCss);
				resultAst.should.eql(orgAst);
				done();
			} catch (ex) {
				done(ex);
			}

		});
	});

	/*Case 2: @-rule with CSS properties inside [REMOVE]
		currently none..
	*/

	/*Case 3: @-rule with full CSS (rules) inside [REMAIN]
		@media, @document, @supports..
	*/
	it('should keep case 3 @-rules (@media, @document..)', function(done) {
		var atRuleCase3RemainCssFilePath = path.join(__dirname, 'static-server', 'at-rule-case-3--remain.css'),
			atRuleCase3RemainCss = read(atRuleCase3RemainCssFilePath).toString();

		penthouse({
			url: page1,
			css: atRuleCase3RemainCssFilePath
		}, function(err, result) {
			try {
				var resultAst = css.parse(result);
				var orgAst = css.parse(atRuleCase3RemainCss);
				resultAst.should.eql(orgAst);
				done();
			} catch (ex) {
				done(ex);
			}

		});
	});

	/*Case 4: @-rule with full CSS (rules) inside [REMOVE]
		- currently just @keyframe
	*/

	it('should remove case 4 @-rules (@keyframe..)', function(done) {
		var atRuleCase4RemoveCssFilePath = path.join(__dirname, 'static-server', 'at-rule-case-4--remove.css');

		penthouse({
			url: page1,
			css: atRuleCase4RemoveCssFilePath
		}, function(err, result) {
			try {
				result.trim().should.equal('');
				done();
			} catch (ex) {
				done(ex);
			}

		});
	});


	it('should keep self clearing rules when needed to stay outside the fold', function(done) {
		var clearSelfRemainCssFilePath = path.join(__dirname, 'static-server', 'clearSelf--remain.css'),
			clearSelfRemainCss = read(clearSelfRemainCssFilePath).toString();

		penthouse({
			url: 'http://localhost:' + port + '/clearSelf.html',
			css: clearSelfRemainCssFilePath
		}, function(err, result) {
			try {
				var resultAst = css.parse(result);
				var orgAst = css.parse(clearSelfRemainCss);
				resultAst.should.eql(orgAst);
				done();
			} catch (ex) {
				done(ex);
			}

		});
	});

	/* non core (non breaking) functionality tests */
	it('should remove empty rules', function(done) {
		var emptyRemoveCssFilePath = path.join(__dirname, 'static-server', 'empty-rules--remove.css');

		penthouse({
			url: page1,
			css: emptyRemoveCssFilePath
		}, function(err, result) {
			try {
				result.trim().should.equal('');
				done();
			} catch (ex) {
				done(ex);
			}

		});
	});

	it('should remove @fontface rule, because it is not used', function(done) {
		var fontFaceRemoveCssFilePath = path.join(__dirname, 'static-server', 'fontface--remove.css'),
			fontFaceRemoveCss = read(fontFaceRemoveCssFilePath).toString(),
			ffRemover = require('../lib/phantomjs/unused-fontface-remover.js');

		var result = ffRemover(fontFaceRemoveCss);

		try {
			var resultAst = css.parse(result);
			var orgAst = css.parse(fontFaceRemoveCss);
			resultAst.stylesheet.rules.should.have.length.lessThan(orgAst.stylesheet.rules.length);
			done();
		} catch (ex) {
			done(ex);
		}

	});

	it('should preformat css (rm comments etc)', function(done) {
		var cssPreformatCssFilePath = path.join(__dirname, 'static-server', 'preformat-css--remove.css'),
			cssPreformatCss = read(cssPreformatCssFilePath).toString(),
			cssPreformatter = require('../lib/phantomjs/css-preformatter.js');

		var result = cssPreformatter(cssPreformatCss);

		try {
			var resultAst = css.parse(result);
			var orgAst = css.parse(cssPreformatCss);
			//with comments stripped out, fewer 'rules' (comments included) in AST
			resultAst.stylesheet.rules.should.have.length.lessThan(orgAst.stylesheet.rules.length);
			//but except for comments, (also inside declarations), everything should be the same
			var orgAstRulesExceptComments = orgAst.stylesheet.rules.filter(function(rule){
				if(typeof rule.declarations !== "undefined") {
					rule.declarations = rule.declarations.filter(function(declaration){
						return declaration.type !== "comment"
					})
				}
				return rule.type !== "comment";
			})
			orgAstRulesExceptComments.should.eql(resultAst.stylesheet.rules);

			done();
		} catch (ex) {
			done(ex);
		}

	});

});

function startServer(done) {
	var portfinder = require('portfinder');

	portfinder.getPort(function(err, port) {
		//
		// `port` is guaranteed to be a free port
		// in this scope.

		var app = require('./static-server/app.js');
		var server = app.listen(port);

		done(server, port);
	});
}
