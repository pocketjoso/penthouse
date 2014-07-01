var parse = require('../lib/options-parser').parse,
chai = require('chai'),
expect = chai.expect;

describe('options parsing ', function() {
    it('should handle argument strings without options', function() {
        var options = parse(['main.css', 'http://hw.no' ]);

        expect(options).to.eql({ 
            urls : ['http://hw.no'], 
            cssFile : 'main.css'
        });
    });

    it('should handle argument strings with one option', function() {
        var options = parse(['--width', '100', 'main.css', 'http://hw.no']);
        expect(options).to.eql({ 
            urls : ['http://hw.no'], 
            cssFile : 'main.css',
            width : 100
        });
    });

    it('should handle argument strings with one option', function() {
        var options = parse([
            '--height', '200', '--width', '100', 
            'main.css', 'http://hw.no'
        ]);

        expect(options).to.eql({ 
            urls : ['http://hw.no'], 
            cssFile : 'main.css',
            width : 100,
            height : 200
        });
    });

    it('should throw error on invalid values', function() {
        expect(function() {
            parse(['--width', 'a100', 'main.css', 'http://hw.no' ]);
        }).to.throw(/Parsing error/);
    });

    it('should throw error on missing options args', function() {
        expect(function() {
            parse(['--width', 'main.css' , 'http://hw.no']);
        }).to.throw(/Parsing error/);
    });

    // see discussion in #issue-8 and #issue-10
    it('should handle a multitude of urls', function() {
        var options = parse([
            '--height', '200', '--width', '100', 
            'main.css', 'http://hw.no', 'http://hw.dk'
        ]);

        expect(options).to.eql({ 
            urls : ['http://hw.no', 'http://hw.dk'],
            cssFile : 'main.css',
            width : 100,
            height : 200
        });
    });

});
