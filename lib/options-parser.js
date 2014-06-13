/*
 parser for the script - can be used both for the standalone node binary and the phantomjs script
 @author Carl-Erik Kopseng
*/

// we test for this value when concatenating this script for a standalone script
var embeddedParser = true;

var usageString = ' [--width <width>] [--height <height>] <url> <main.css>';

function error(msg, token) {
        var error = new Error( msg );
        error.token = token;
        throw error;
}

// Parses the arguments passed in
// @returns { width, height, url, css }
// throws an error on wrong options or parsing error
function parseOptions(argsOriginal) {
    var args = argsOriginal.slice(0),
        validOptions = ['--width', '--height'],
        parsed = {},
        len = args.length,
        optIndex,
        option;

    if(len % 2 !== 0 || len < 2 || len > 6) error('Invalid number of arguments');

    while(args.length > 2) {
        optIndex = validOptions.indexOf(args[0]);
        if(optIndex === -1) error('Parsing error', args[0]);

        option = validOptions[optIndex].slice(2);
        val = args[1];

        parsed[option] = parseInt(val, 10);
        if(isNaN(parsed[option])) error('Parsing error when parsing ' + val, val);

        // remove the two parsed arguments from the list
        args = args.slice(2);
    }

    parsed.url = args[0];
    parsed.css = args[1];

    if( ! parsed.url.match(/https?:\/\//) ) error('Invalid url: ' + parsed.url);

    return parsed;
}

if(typeof module !== 'undefined') {
    module.exports = exports = {
        parse : parseOptions,
        usageString : usageString
    };
}
