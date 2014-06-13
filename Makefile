SOURCES=lib/phantomjs/core.js lib/options-parser.js  bin/penthouse lib/index.js

install: test
	@echo "Installing global penthouse command"
	npm install -g

test: ${SOURCES} 
	npm test

penthouse.js:  lib/options-parser.js lib/phantomjs/*.js
	cat lib/phantomjs/banner.js lib/options-parser.js lib/phantomjs/core.js  > $@

build: penthouse.js
	npm install

clean : penthouse.js
	rm penthouse.js

.PHONY: standalone
