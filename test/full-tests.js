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

describe('penthouse functionality tests', function () {
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

    glob("critical-*.css", function(err, files) {
      if(err) { throw err; }

      async.map(files, fs.unlink, function(err, results){
        if(err) throw err;
        done();
      });
    });
  });



	it('should return a subset of the original AST rules when the viewport is small', function (done) {
        var widthLargerThanTotalTestCSS = 1000,
            heightSmallerThanTotalTestCSS = 100;
        penthouse({
            urls: [page1],
            cssFile: page1cssPath,
            width: widthLargerThanTotalTestCSS,
            height: heightSmallerThanTotalTestCSS
        }, function (err, result) {
            if(err) { done(err); }
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

	it('should keep :before, :after rules (because el above fold)', function (done) {
      var pusedoRemainCssFilePath = path.join(__dirname, 'static-server', 'psuedo--remain.css'),
			pusedoRemainCss = read(pusedoRemainCssFilePath).toString();

        penthouse({
            urls: [page1],
            cssFile: pusedoRemainCssFilePath
        }, function (err, result) {
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

	it('should remove :hover, :active, etc rules - always', function (done) {
        var pusedoRemoveCssFilePath = path.join(__dirname, 'static-server', 'psuedo--remove.css');

        penthouse({
            urls: [page1],
            cssFile: pusedoRemoveCssFilePath
        }, function (err, result) {
            try {
                result = result.trim();
				result.should.equal('');
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
	it('should keep complete case 0 @-rules (@import, @charset, @namespace)', function (done) {
        var atRuleCase0RemainCssFilePath = path.join(__dirname, 'static-server', 'at-rule-case-0--remain.css'),
			atRuleCase0RemainCss = read(atRuleCase0RemainCssFilePath).toString();

        penthouse({
            urls: [page1],
            cssFile: atRuleCase0RemainCssFilePath
        }, function (err, result) {
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
	it('should keep complete case 1 @-rules (@font-face, @page)', function (done) {
      var atRuleCase1RemainCssFilePath = path.join(__dirname, 'static-server', 'at-rule-case-1--remain.css'),
			atRuleCase1RemainCss = read(atRuleCase1RemainCssFilePath).toString();

        penthouse({
            urls: [page1],
            cssFile: atRuleCase1RemainCssFilePath
        }, function (err, result) {
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
	it('should keep case 3 @-rules (@media, @document..)', function (done) {
        var atRuleCase3RemainCssFilePath = path.join(__dirname, 'static-server', 'at-rule-case-3--remain.css'),
			atRuleCase3RemainCss = read(atRuleCase3RemainCssFilePath).toString();

        penthouse({
            urls: [page1],
            cssFile: atRuleCase3RemainCssFilePath
        }, function (err, result) {
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
	it('should remove case 4 @-rules (@keyframe..)', function (done) {
        var atRuleCase4RemoveCssFilePath = path.join(__dirname, 'static-server', 'at-rule-case-4--remove.css');

        penthouse({
            urls: [page1],
            cssFile: atRuleCase4RemoveCssFilePath
        }, function (err, result) {
            try {
				result = result.trim();
				result.should.equal('');
                done();
            } catch (ex) {
                done(ex);
            }

        });
    });

	it('should keep self clearing rules when needed to stay outside the fold', function (done) {
        var clearSelfRemainCssFilePath = path.join(__dirname, 'static-server', 'clearSelf--remain.css'),
			clearSelfRemainCss = read(clearSelfRemainCssFilePath).toString();

        penthouse({
            urls: ['http://localhost:' + port + '/clearSelf.html'],
            cssFile: clearSelfRemainCssFilePath
        }, function (err, result) {
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
	it('should remove empty rules', function (done) {
        var emptyRemoveCssFilePath = path.join(__dirname, 'static-server', 'empty-rules--remove.css');

        penthouse({
            urls: [page1],
            cssFile: emptyRemoveCssFilePath
        }, function (err, result) {
            try {
				result = result.trim();
				result.should.equal('');
                done();
            } catch (ex) {
                done(ex);
            }

        });
    });

	it('should remove @fontface rule, because it is not used', function (done) {
        var fontFaceRemoveCssFilePath = path.join(__dirname, 'static-server', 'fontface--remove.css'),
			fontFaceRemoveCss = read(fontFaceRemoveCssFilePath).toString();

        penthouse({
            urls: [page1],
            cssFile: fontFaceRemoveCssFilePath
        }, function (err, result) {
            try {
                var resultAst = css.parse(result);
                var orgAst = css.parse(fontFaceRemoveCss);
                resultAst.stylesheet.rules.should.have.length.lessThan(orgAst.stylesheet.rules.length);
                done();
            } catch (ex) {
                done(ex);
            }

        });
    });
	
});

function startServer(done) {
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
