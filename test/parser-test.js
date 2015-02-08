var parse = require('../lib/options-parser').parse,
chai = require('chai'),
expect = chai.expect;

describe('options parsing ', function() {

    it('should handle argument strings without options', function() {
        var options = parse(['http://hw.no', 'main.css']);

        expect(options).to.eql({
            url : 'http://hw.no',
            css : 'main.css'
        });
    });

    it('should handle argument strings with one option', function() {
        var options = parse(['--width', '100', 'http://hw.no', 'main.css']);
        expect(options).to.eql({
            url : 'http://hw.no',
            css : 'main.css',
            width : 100
        });
    });

    it('should handle argument strings with two options', function() {
        var options = parse([
            '--height', '200', '--width', '100',
            'http://hw.no', 'main.css'
        ]);

        expect(options).to.eql({
            url : 'http://hw.no',
            css : 'main.css',
            width : 100,
            height : 200
        });
    });

    it('should throw error on invalid values', function() {
        expect(function() {
            parse(['--width', 'a100', 'http://hw.no', 'main.css' ]);
        }).to.throw(/Parsing error/);
    });

    it('should throw error on missing options args', function() {
        expect(function() {
            parse(['--width', 'http://hw.no', 'main.css']);
        }).to.throw(/Parsing error/);
    });

    it('should accept local file paths', function() {
       expect( parse(['index.html', 'main.css'])
       ).to.eql({
            url : 'index.html',
            css : 'main.css'
        });
    });
});
