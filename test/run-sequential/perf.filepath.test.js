import puppeteer from "puppeteer";
import path from "path";
import penthouse from "../../lib/";
import { FIXTURES } from './fixtures.js';

function staticServerPerfHtmlUrl(file) {
  return (
    "file://" +
    path.join(process.env.PWD, "test", "static-server", "perf", file)
  );
}

describe("performance tests for penthouse via file", () => {
  jest.setTimeout(15000);
  const browserPromise = puppeteer.launch();

  let testsCompleted = 0;
  FIXTURES.forEach(({ name, threshold }) => {
    it(`Penthouse should handle ${name} in less than ${threshold /
      1000}s`, () => {
      const start = Date.now();
      return penthouse({
        url: staticServerPerfHtmlUrl(`${name}.html`),
        css: path.join(
          process.env.PWD,
          "test",
          "static-server",
          "perf",
          `${name}.css`
        ),
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
