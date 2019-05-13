import puppeteer from "puppeteer";
import path from "path";
import penthouse from "../../lib/";
import { readFileSync as read } from "fs";
import { FIXTURES } from './fixtures.js';

const simpleHtmlCache = {};

function getServerPerfHtml(file) {
  if (!simpleHtmlCache[file]) {
    var fullHtmlFilePath = path.join(
      process.env.PWD,
      "test",
      "static-server",
      "perf",
      `${file}.html`
    );
    var fullCssFilePath = path.join(
      process.env.PWD,
      "test",
      "static-server",
      "perf",
      `${file}.css`
    );
    var css = read(fullCssFilePath).toString();

    simpleHtmlCache[file] = {};
    simpleHtmlCache[file].html = read(fullHtmlFilePath)
      .toString()
      .replace(
        `<link rel=\"stylesheet\" href=\"${file}.css\">`,
        "<style>" + css + "</style>"
      ); // inline css - actually not needed for current tests.
    simpleHtmlCache[file].css = css;
  }

  return simpleHtmlCache[file];
}

describe("performance tests for penthouse via setContent method", () => {
  jest.setTimeout(15000);
  const browserPromise = puppeteer.launch();

  let testsCompleted = 0;
  FIXTURES.forEach(({ name, threshold }) => {
    it(`Penthouse should handle ${name} in less than ${threshold /
      1000}s`, () => {
      const start = Date.now();
      return penthouse({
        htmlString: getServerPerfHtml(name).html,
        cssString: getServerPerfHtml(name).css,
        unstableKeepBrowserAlive: true,
        puppeteer: { getBrowser: () => browserPromise }
      }).then(result => {
        testsCompleted++;
        if (testsCompleted === FIXTURES.length) {
          console.log("close shared browser after performance tests");
          browserPromise.then(browser => browser.close());
        }
        expect(Date.now() - start).toBeLessThan(threshold);
      });
    });
  });
});
