/*
 * Node module wrapper for the PhantomJS script
 */

var path = require('path');
var spawn = require('child_process').spawn;
var phantomjs = require('phantomjs');
var phantomJsBinPath = phantomjs.path;
var configString = ('--config=' + path.join(__dirname, 'phantomjs', 'config.json'));
var script = path.join(__dirname, 'phantomjs', 'core.js');

var removePhantomJSSecurityErrors = function (stdOut){
  stdOut = stdOut.replace('Unsafe JavaScript attempt to access frame with URL about:blank from frame with URL ', '');
  stdOut = stdOut.replace(/file:\/\/.*core.js\./, '');
  stdOut = stdOut.replace(' Domains, protocols and ports must match.', '');
  return stdOut;
};

var m = module.exports = function (options, callback) {
    var scriptArgs = [],
        stdOut = '',
        stdErr = '',
        debuggingHelp = '',
        cp;

    // set the options, skipping undefined options
    if(options.width) scriptArgs = scriptArgs.concat(['--width', options.width]);
    if(options.height) scriptArgs = scriptArgs.concat(['--height', options.height]);
    scriptArgs.push(options.url || '');
    scriptArgs.push(options.css || '');

    cp = spawn(phantomJsBinPath, [configString, script].concat(scriptArgs));

    // Errors arise before the process starts
    cp.on('error', function (err) {
        debuggingHelp += 'Error executing penthouse using ' + phantomJsBinPath;
        debuggingHelp += err.stack;
        err.debug = debuggingHelp;
        callback(err);
    });

    cp.stdout.on('data', function (data) {
        stdOut += data;
        if(m.DEBUG) { console.log('' + data); }
    });

    cp.stderr.on('data', function (data) {
        stdErr += data;
        if(m.DEBUG) console.error( '' + data);
    });

    cp.on('close', function (code) {
        if (code !== 0) {
            debuggingHelp += 'PhantomJS process closed with code ' + code;
        }
    });

    cp.on('exit', function (code) {
        if (code === 0) {
            if(m.DEBUG) {
                console.log('stdout: ' + stdOut);
                console.log('stderr: ' + stdErr);
            }
            stdOut = removePhantomJSSecurityErrors(stdOut);
            callback(null, stdOut);
        } else {
            debuggingHelp += 'PhantomJS process exited with code ' + code;
            var err = new Error(stdErr + stdOut);
            err.code = code;
            err.debug = debuggingHelp;
            err.stdout = stdOut;
            err.stderr = stdErr;
            callback( err );
        }
    });

    process.on('SIGTERM', function () {
        cp.kill('SIGTERM');
        process.exit(1);
    });

};
