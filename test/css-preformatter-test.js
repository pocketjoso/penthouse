var path = require('path');
var fs = require('fs');
var read = fs.readFileSync;
var css = require('css');
var chai = require('chai');
var should = chai.should();// extends Object.prototype (so ignore unused warnings)


it('should preformat css (rm comments etc)', function (done) {
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
        var orgAstRulesExceptComments = orgAst.stylesheet.rules.filter(function (rule) {
            if (typeof rule.declarations !== "undefined") {
                rule.declarations = rule.declarations.filter(function (declaration) {
                    return declaration.type !== "comment"
                })
            }
            return rule.type !== "comment";
        });
        orgAstRulesExceptComments.should.eql(resultAst.stylesheet.rules);

        done();
    } catch (ex) {
        done(ex);
    }
});
