/*
 * Node module wrapper for the PhantomJS script
 */

var path = require('path');
var spawn = require('child_process').spawn;
var phantomjs = require('phantomjs');
var phantomJsBinPath = phantomjs.path;
var configString = ('--config=' + path.join(__dirname, 'phantomjs', 'ssl-config.json'));
var script = path.join(__dirname, 'phantomjs', 'core.js');

var m = module.exports = function (options, callback) {
    var scriptArgs = [],
        stdOut = "",
        stdErr = "",
        debuggingHelp = "",
        cp;

    // set the options, skipping undefined options
    if(options.width) scriptArgs = scriptArgs.concat(['--width', options.width])
    if(options.height) scriptArgs = scriptArgs.concat(['--height', options.height])
    scriptArgs.push(options.cssFile);
    scriptArgs = scriptArgs.concat(options.urls);
    
    cp = spawn(phantomJsBinPath, [configString, script].concat(scriptArgs));

    cp.on('error', function (err) {
        debuggingHelp += 'Error executing penthouse using ' + phantomJsBinPath;
        debuggingHelp += err.stack;
        err.debug = debuggingHelp;
        callback(err);
    });

    cp.stdout.on('data', function (data) {
        stdOut += data;
    });

    cp.stderr.on('data', function (data) {
        stdErr += data;
    });

    cp.on('close', function (code) {
        if (code !== 0) {
            debuggingHelp += 'PhantomJS process closed with code ' + code;
        }
    });

    cp.on('exit', function (code) {
        if (code === 0) {
            if(m.debug) {
                console.log('stdout: ' + stdOut);
                console.log('stderr: ' + stdErr);
            }
            callback(null, stdOut);
        } else {
            debuggingHelp += 'PhantomJS process exited with code ' + code;
            err = new Error(stdErr);
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
    })

};
