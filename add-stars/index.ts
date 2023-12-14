#!/usr/bin/env bun

// process.chdir(import.meta.dir)
// process.chdir('..')

import { execa } from "execa";
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

const repoRegex = SuperExpressive()
  .string("github.com/")
  .capture.oneOrMore.anythingButChars("/")
  .end()
  .string("/")
  .capture.oneOrMore.anythingButChars("/")
  .end()
  .toRegex();

console.log("myRegex:", myRegex);

console.log("process.argv:", process.argv);
const fileContent = await Bun.file(process.argv[2]).text();
const matches = fileContent.match(myRegexG);
if (!matches) {
  process.exit(0);
}

let newContent = fileContent;

const writer = fastq.promise(async function (s: string) {
  newContent = s;
  await Bun.write(process.argv[2], s);
}, 1);

const queue = fastq.promise(async function (s: string) {
  const [, name, url] = s.match(myRegex)!;
  if (!url.includes("github.com")) {
    return;
  }
  const [, username, repoName] = url.match(repoRegex)!;
  const { stdout: stars } = await execa("gh", [
    "api",
    `repos/${username}/${repoName}`,
    "--cache",
    `${24 * 7}h`,
    "--jq",
    ".stargazers_count",
  ]);
  const newTag = `[${name} ⭐️ ${stars}](${url})`;
  await writer.push(newContent.replaceAll(s, newTag));
}, 8);

for (const match of matches!) {
  queue.push(match);
}

await queue.drained();
await writer.drained();
