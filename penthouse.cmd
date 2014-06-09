@ECHO OFF
SET _CURRENT_DIR=%~dp0
SET _SCRIPT=%_CURRENT_DIR%lib\phantomjs-specific\penthouse.js
SET _CONFIG=%_CURRENT_DIR%lib\phantomjs-specific\config.json

REM check for previously installed phantomjs
REM Not sure if this is needed. Might also make debugging harder ...
WHERE phantomjs > NUL 2> NUL
@IF %ERRORLEVEL% == 1 (
	REM Use NPM supplied version
	SET _PHANTOMJS=%_CURRENT_DIR%node_modules\.bin\phantomjs.cmd
) else (
	REM Use globally installed phantomjs
	SET _PHANTOMJS=phantomjs
)

REM Execute script
%_PHANTOMJS% --config=%_CONFIG% %_SCRIPT% %*