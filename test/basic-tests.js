var penthouse = require('../lib/'),
    chai = require('chai'),
    should = chai.should(),
    css = require('css'),
    read = require('fs').readFileSync,
    path = require('path');

describe('basic tests of penthouse functionality', function () {
    var originalCssFilePath = path.join(__dirname, 'static-server', 'main.css'),
        originalCss = read(originalCssFilePath).toString(),
        server, port;

    // phantomjs takes a while to start up
    this.timeout(5000);

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
