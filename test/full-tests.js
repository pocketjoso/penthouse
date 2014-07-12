var penthouse = require('../lib/'),
    chai = require('chai'),
    should = chai.should(),
    css = require('css'),
    read = require('fs').readFileSync,
    path = require('path');

describe('penthouse functionality tests', function () {
    var originalCssFilePath = path.join(__dirname, 'static-server', 'main.css'),
        originalCss = read(originalCssFilePath).toString(),
        server, port;

    // phantomjs takes a while to start up
    this.timeout(2000);

    before(function (done) {
        startServer(function (instance, serverPort) {
            server = instance;
            port = serverPort;
            done();
        });
    });

    after(function () {
        server.close();
    });
	
    it('should return a css file', function (done) {
        penthouse({
            url: 'http://localhost:' + port,
            css: originalCssFilePath
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
            url: 'http://localhost:' + port,
            css: originalCssFilePath,
            width: widthLargerThanTotalTestCSS,
            height: heightLargerThanTotalTestCSS
        }, function (err, result) {
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
            url: 'http://localhost:' + port,
            css: originalCssFilePath,
            width: widthLargerThanTotalTestCSS,
            height: heightSmallerThanTotalTestCSS
        }, function (err, result) {
            if(err) { done(err); }
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
	
	
	it('@fontface rule should remain, because it is used', function (done) {
        var fontFaceRemainCssFilePath = path.join(__dirname, 'static-server', 'fontface--remain.css'),
			fontFaceRemainCss = read(fontFaceRemainCssFilePath).toString();
		
        penthouse({
            url: 'http://localhost:' + port,
            css: fontFaceRemainCssFilePath
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
	
	it('@fontface rule should be removed, because it is not used', function (done) {
        var fontFaceRemoveCssFilePath = path.join(__dirname, 'static-server', 'fontface--remove.css'),
			fontFaceRemoveCss = read(fontFaceRemoveCssFilePath).toString();
		
        penthouse({
            url: 'http://localhost:' + port,
            css: fontFaceRemoveCssFilePath
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
	
	it(':before, :after rules should remain (because el above fold)', function (done) {
        var pusedoRemainCssFilePath = path.join(__dirname, 'static-server', 'psuedo--remain.css'),
			pusedoRemainCss = read(pusedoRemainCssFilePath).toString();
		
        penthouse({
            url: 'http://localhost:' + port,
            css: pusedoRemainCssFilePath
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
	
	it(':hover, :active, etc rules should always be removed', function (done) {
        var pusedoRemoveCssFilePath = path.join(__dirname, 'static-server', 'psuedo--remove.css');
		
        penthouse({
            url: 'http://localhost:' + port,
            css: pusedoRemoveCssFilePath
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
            url: 'http://localhost:' + port,
            css: emptyRemoveCssFilePath
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
            url: 'http://localhost:' + port,
            css: keyframeRemoveCssFilePath
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
            url: 'http://localhost:' + port + '/clearSelf.html',
            css: clearSelfRemainCssFilePath
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
            url: 'http://localhost:' + port,
            css: keyframeRemoveCssFilePath
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
