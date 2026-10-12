import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createRequire } from "node:module";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);

test("About Markdown preserves indented reach-layer bullets", async () => {
  const source = await readFile(new URL("../src/components/InfoModal.tsx", import.meta.url), "utf8");
  const markdown = await readFile(new URL("../../about.md", import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  });
  const module = { exports: {} };
  new Function("require", "module", "exports", outputText)(require, module, module.exports);
  const html = renderToStaticMarkup(React.createElement(module.exports.InfoModal, {
    content: markdown,
    isOpen: true,
    onClose: () => {},
    title: "About SWORD",
  }));

  assert.match(html, /12 attribute layers[^<]*<ul><li>Reach boundaries/);
  assert.match(html, /Number of SWOT observations<\/li><\/ul><\/li>/);
});
