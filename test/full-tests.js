var penthouse = require('../lib/'),
    chai = require('chai'),
    should = chai.should(),// extends Object.prototype (so ignore unused warnings)
    css = require('css'),
    fs = require('fs'),
    read = fs.readFileSync,
    path = require('path');

process.setMaxListeners(0);

describe('penthouse functionality tests', function () {
    var page1cssPath = path.join(__dirname, 'static-server', 'page1.css'),
        page1 = path.join(__dirname, 'static-server', 'page1.html');

    // phantomjs takes a while to start up
    this.timeout(5000);

    it('should save css to a file', function (done) {
        penthouse({
            url: page1,
            css: page1cssPath
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

    it('should match exactly the css in the yeoman test', function (done) {
        var yeomanFullCssFilePath = path.join(__dirname, 'static-server', 'yeoman-full.css'),
            yeomanExpectedCssFilePath = path.join(__dirname, 'static-server', 'yeoman-medium--expected.css'),
            yeomanExpectedCss = read(yeomanExpectedCssFilePath).toString();

        penthouse({
            url: path.join(__dirname, 'static-server', 'yeoman.html'),
            css: yeomanFullCssFilePath,
            width: 800,
            height: 450
        }, function (err, result) {
            if (err) {
                done(err);
            }
            try {
                var resultAst = css.parse(result);
                var expectedAst = css.parse(yeomanExpectedCss);
                resultAst.should.eql(expectedAst);
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
            url: page1,
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


    it('should remove :hover, :active, etc rules - always', function (done) {
        var pusedoRemoveCssFilePath = path.join(__dirname, 'static-server', 'psuedo--remove.css');

        penthouse({
            url: page1,
            css: pusedoRemoveCssFilePath
        }, function (err, result) {
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
    it('should keep complete case 0 @-rules (@import, @charset, @namespace)', function (done) {
        var atRuleCase0RemainCssFilePath = path.join(__dirname, 'static-server', 'at-rule-case-0--remain.css'),
            atRuleCase0RemainCss = read(atRuleCase0RemainCssFilePath).toString();

        penthouse({
            url: page1,
            css: atRuleCase0RemainCssFilePath
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
    it('should keep complete case 1 @-rules (@font-face)', function (done) {
        var atRuleCase1RemainCssFilePath = path.join(__dirname, 'static-server', 'at-rule-case-1--remain.css'),
            atRuleCase1RemainCss = read(atRuleCase1RemainCssFilePath).toString();

        penthouse({
            url: page1,
            css: atRuleCase1RemainCssFilePath
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
     @page
     */
    it('should remove complete case 2 @-rules (@page..)', function (done) {
        var atRuleCase2RemoveCssFilePath = path.join(__dirname, 'static-server', 'at-rule-case-2--remove.css');

        penthouse({
            url: page1,
            css: atRuleCase2RemoveCssFilePath
        }, function (err, result) {
            try {
                result.trim().should.equal('');
                done();
            } catch (ex) {
                done(ex);
            }

        });
    });

    /*Case 3: @-rule with full CSS (rules) inside [REMAIN]
     @media, @document, @supports..
     */
    it('should keep case 3 @-rules (@media, @document..)', function (done) {
        var atRuleCase3RemainCssFilePath = path.join(__dirname, 'static-server', 'at-rule-case-3--remain.css'),
            atRuleCase3RemainCss = read(atRuleCase3RemainCssFilePath).toString();

        penthouse({
            url: page1,
            css: atRuleCase3RemainCssFilePath
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
     - @keyframes, @media print|speech|arual
     */
    it('should remove case 4 @-rules (@media print|speech, @keyframes..)', function (done) {
        var atRuleCase4RemoveCssFilePath = path.join(__dirname, 'static-server', 'at-rule-case-4--remove.css');

        penthouse({
            url: page1,
            css: atRuleCase4RemoveCssFilePath
        }, function (err, result) {
            try {
                result.trim().should.equal('');
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
            url: path.join(__dirname, 'static-server', 'clearSelf.html'),
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

    /* non core (non breaking) functionality tests */
    it('should remove empty rules', function (done) {
        var emptyRemoveCssFilePath = path.join(__dirname, 'static-server', 'empty-rules--remove.css');

        penthouse({
            url: page1,
            css: emptyRemoveCssFilePath
        }, function (err, result) {
            try {
                result.trim().should.equal('');
                done();
            } catch (ex) {
                done(ex);
            }

        });
    });

    it('should remove @fontface rule, because it is not used', function (done) {
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


    it('should surface parsing errors to the end user', function (done) {
        penthouse({
            css: 'some.css'
        }, function (err) {
            if(err) done();
            else { done(new Error('Did not get error'));}
        });
    });
});
