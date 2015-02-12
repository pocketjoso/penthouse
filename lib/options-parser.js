/*
 * parser for the script - can be used both for the standalone node binary and the phantomjs script
 */

/*jshint unused:false*/

var usageString = '[--width <width>] [--height <height>] <url> <main.css>';

function buildError(msg, problemToken, args) {
    var error = new Error(msg + problemToken);
    error.token = problemToken;
    error.args = args;
    throw error;
}

// Parses the arguments passed in
// @returns { width, height, url, css }
// throws an error on wrong options or parsing error
function parseOptions(argsOriginal) {
    var args = argsOriginal.slice(0),
        validOptions = ['--width', '--height'],
        parsed = {},
        val,
        len = args.length,
        optIndex,
        option;

    if (len < 2) buildError('Not enough arguments, ', args);

    while (args.length > 2 && args[0].match(/^(--width|--height)$/)) {
        optIndex = validOptions.indexOf(args[0]);
        if (optIndex === -1) buildError('Logic/Parsing error ', args[0], args);

        // lose the dashes
        option = validOptions[optIndex].slice(2);
        val = args[1];

        parsed[option] = parseInt(val, 10);
        if (isNaN(parsed[option])) buildError('Parsing error when parsing ', val, args);

        // remove the two parsed arguments from the list
        args = args.slice(2);
    }
    parsed.url = args[0];
    parsed.css = args[1];

    if (!parsed.url) {
        buildError('Missing url/path to html file', '', args);
    }

    if (!parsed.css) {
        buildError('Missing css file', '', args);
    }


    return parsed;
}

if (typeof module !== 'undefined') {
    module.exports = exports = {
        parse: parseOptions,
        usage: usageString
    };
}
