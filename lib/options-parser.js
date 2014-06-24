/* 
parser for the script - can be used both for the standalone node binary and the phantomjs script
*/

var usageString = '[--width <width>] [--height <height>]  <main.css> <url> [<url> [...]]';

var embeddedParser = true; // we test for this symbol in the concatenated script

function error(msg, problemToken, args) {
    var error = new Error( msg  + problemToken);
    error.token = problemToken;
    error.args = args;
    throw error;
}

// Parses the arguments passed in
// @returns { width, height, url, cssFile }
// throws an error on wrong options or parsing error
function parseOptions(argsOriginal) {   
    var args = argsOriginal.slice(0),
    validOptions = ['--width', '--height'],
    parsed = {},
    len = args.length,
    optIndex,
    option;

    if(len < 2 ) error('Invalid number of arguments', args, args);

    while(args.length > 2 && args[0].match(/^(--width|--height)$/)) {
        optIndex = validOptions.indexOf(args[0]);
        if(optIndex === -1) error('Logic/Parsing error ', args[0], args);

        // lose the dashes
        option = validOptions[optIndex].slice(2);
        val = args[1];

        parsed[option] = parseInt(val, 10);
        if(isNaN(parsed[option])) error('Parsing error when parsing ', val, args); 

        // remove the two parsed arguments from the list
        args = args.slice(2);
    }

    parsed.cssFile = args[0];
    parsed.urls = args.slice(1);

    parsed.urls.forEach(function(url) {
        if( ! url.match(/https?:\/\//) ) { 
            error('Invalid url: ', parsed.url, args); 
        }
    });
    return parsed;
}

if(typeof module !== 'undefined') {
    module.exports = exports = {
        parse : parseOptions,
        usage : usageString
    };
} 
