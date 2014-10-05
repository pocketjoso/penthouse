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

    it('should return the contents of a css file', function (done) {
      penthouse({
        urls    : [ page1],
        cssFile : page1cssPath
      }, function (err, result) {
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

    it('should return a subset of the original AST rules when the viewport is small', function (done) {
      var widthLargerThanTotalTestCSS = 1000,
        heightSmallerThanTotalTestCSS = 100;
      penthouse({
        urls    : [page1],
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


	it('should keep @fontface rule, because it is used', function (done) {
        var fontFaceRemainCssFilePath = path.join(__dirname, 'static-server', 'fontface--remain.css'),
			fontFaceRemainCss = read(fontFaceRemainCssFilePath).toString();

        penthouse({
            urls: [page1],
            cssFile: fontFaceRemainCssFilePath
        }, function (err, result) {
            try {
                var resultAst = css.parse(result);
                var orgAst = css.parse(fontFaceRemainCss);
				resultAst.should.eql(orgAst);
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

	it('should keep @media rules', function (done) {
        var keyframeRemoveCssFilePath = path.join(__dirname, 'static-server', 'media--remain.css'),
			keyframeRemoveCss = read(keyframeRemoveCssFilePath).toString();

        penthouse({
            urls: [page1],
            cssFile: keyframeRemoveCssFilePath
        }, function (err, result) {
            try {
                var resultAst = css.parse(result);
                var orgAst = css.parse(keyframeRemoveCss);
				resultAst.should.eql(orgAst);
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

	it('should remove @keyframe rules', function (done) {
        var keyframeRemoveCssFilePath = path.join(__dirname, 'static-server', 'keyframe--remove.css');

        penthouse({
            urls: [page1],
            cssFile: keyframeRemoveCssFilePath
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
