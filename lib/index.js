/*
 * Node module wrapper for the PhantomJS script
 */

var path = require('path');
var spawn = require('child_process').spawn;
var phantomjs = require('phantomjs');
var phantomJsBinPath = phantomjs.path;
var configString = ('--config=' + path.join(__dirname, 'phantomjs', 'config.json'));
var script = path.join(__dirname, 'phantomjs', 'penthouse.js');

module.exports = function (options, callback) {
    var scriptArgs = [options.url, options.css, options.width, options.height],
        childArgs = [configString, script].concat(scriptArgs)        ,
        stdOut = "",
        stdErr = "",
        cp;

    cp = spawn(phantomJsBinPath, childArgs);

    cp.on('error', function (err) {
        console.error('Error executing penthouse', phantomJsBinPath);
        console.error(err.stack);
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
            console.log('PhantomJS process closed with code ' + code);
        }
    });

    cp.on('exit', function (code) {
        if (code === 0) {
            callback(null, stdOut);
        } else {
            console.error('PhantomJS process exited with code ' + code);
            callback( { code : code, msg : stdErr });
        }
    });

    process.on('SIGTERM', function () {
        cp.kill('SIGTERM');
        process.exit(1);
    })

};