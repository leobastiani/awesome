#!/usr/bin/env bun

// process.chdir(import.meta.dir)
// process.chdir('..')

import fastq from "fastq";

import SuperExpressive from "super-expressive";

const myRegexSE = SuperExpressive()
  .assertNotBehind.string("[!")
  .end()
  .string("[")
  .capture.oneOrMoreLazy.anythingButChars("[]")
  .end()
  .string("]")
  .string("(")
  .capture.string("http")
  .optional.string("s")
  .string("://")
  .zeroOrMoreLazy.anyChar.end()
  .string(")");
const myRegexGSE = myRegexSE.allowMultipleMatches;
const myRegex = myRegexSE.toRegex();
const myRegexG = myRegexGSE.toRegex();

console.log("myRegex:", myRegex);

// console.log("myRegex:", myRegex)
console.log("process.argv:", process.argv);
const fileContent = await Bun.file(process.argv[2]).text();
const matches = fileContent.match(myRegexG);
if (!matches) {
  process.exit(0);
}

let newContent = fileContent;

const queue = fastq.promise(async function (s: string) {
  const [, name, url] = s.match(myRegex)!;
  if (!url.includes("github.com")) {
    return;
  }
  const newTag = `[${name} ⭐️ 999](${url})`
  newContent = newContent.replaceAll(s, newTag);
}, 8);

for (const match of matches!) {
  queue.push(match);
}

await queue.drained();

await Bun.write(process.argv[2], newContent);
