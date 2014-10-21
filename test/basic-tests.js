var penthouse = require('../lib/'),
	chai = require('chai'),
	should = chai.should(),
	css = require('css'),
	fs = require('fs'),
	read = fs.readFileSync,
	path = require('path'),
	async = require('async'),
	glob = require('glob');

//penthouse.DEBUG = true;

describe('basic tests of penthouse functionality', function () {
	var page1cssPath = path.join(__dirname, 'static-server', 'page1.css'),
		sharedCssFilePath = path.join(__dirname, 'static-server', 'shared.css'),
		originalCss = read(page1cssPath).toString(),
		page1, server, port;

	// phantomjs takes a while to start up
	this.timeout(5000);

	before(function (done) {
		startServer(function (instance, serverPort) {
			server = instance;
			port = serverPort;
			page1 = ('http://localhost:' + port + '/page1.html');
			done();
		});
	});

	after(function (done) {
		server.close();

		glob("critical-*.css", function(err, files) {
			if(err) { throw err; }

			async.map(files, fs.unlink, function(err, results){
				if(err) throw err;
				done();
			});
		});
	});

	it('should save css to a file', function (done) {
		penthouse({
			urls    : [ page1],
			cssFile : page1cssPath
		}, function (err, result) {
			if (err) {
				done(err);
				return;
			}
			try {
				css.parse(read('critical-1.css', 'utf8'));
				done();
			} catch (ex) {
				done(ex);
			}
		});
	});


	it('should return a css file whose parsed AST is equal to the the original\'s AST when the viewport is large', function (done) {
		var widthLargerThanTotalTestCSS = 1000,
			heightLargerThanTotalTestCSS = 1000;
		penthouse({
			urls    : [page1],
			cssFile : page1cssPath,
			width   : widthLargerThanTotalTestCSS,
			height  : heightLargerThanTotalTestCSS
		}, function (err, result) {
			if (err) {
				done(err);
				return;
			}
			try {
				var resultAst = css.parse(read('critical-1.css', 'utf8'));
				var orgAst = css.parse(originalCss);
				resultAst.should.eql(orgAst);
				done();
			} catch (ex) {
				done(ex);
			}

		});
	});

	it('should return a subset of the original AST rules when the viewport is small', function (done) {
		var widthLargerThanTotalTestCSS = 1000,
			heightSmallerThanTotalTestCSS = 100;
		penthouse({
			urls    : [page1],
			cssFile : page1cssPath,
			width   : widthLargerThanTotalTestCSS,
			height  : heightSmallerThanTotalTestCSS
		}, function (err, result) {
			if (err) { done(err); }
			try {
				var resultAst = css.parse(read('critical-1.css', 'utf8'));
				var orgAst = css.parse(originalCss);
				resultAst.stylesheet.rules.should.have.length.lessThan(orgAst.stylesheet.rules.length);
				// not be empty
				done();
			} catch (ex) {
				done(ex);
			}

		});
	});


	it('should create multiple output files for multiple urls', function (done) {
		penthouse({
			urls    : [page1, page1, page1],
			cssFile : page1cssPath
		}, function (err, result) {
			if (err) {
				done(err);
				return;
			}

			fs.existsSync('critical-1.css').should.be.true;
			fs.existsSync('critical-2.css').should.be.true;
			fs.existsSync('critical-3.css').should.be.true;
			done();
		});
	});


	it('should create different css for different urls', function (done) {
		var css1, css2,
			page2 = ('http://localhost:' + port + '/page2.html');

		penthouse({
			urls    : [ page1, page2],
			cssFile : sharedCssFilePath
		}, function (err, result) {
			if (err) {
				done(err);
				return;
			}

			css1 = read('critical-1.css');
			css2 = read('critical-2.css');
			css1.should.not.be.empty;
			css2.should.not.be.empty;
			css1.should.not.eql(css2);
			done();
		});
	});

});

function startServer (done) {
	var portfinder = require('portfinder');

	portfinder.getPort(function (err, port) {
		//
		// `port` is guaranteed to be a free port
		// in this scope.

		var app = require('./static-server/app.js');
		var server = app.listen(port);

		done(server, port);
	});
}
