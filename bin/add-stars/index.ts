#!/usr/bin/env bun

// process.chdir(import.meta.dir)
// process.chdir('..')

import { execa } from "execa";
import fastq from "fastq";
import SuperExpressive from "super-expressive";

function toRegex(se: SuperExpressive) {
  return {
    regex: se.toRegex(),
    regexG: se.allowMultipleMatches.toRegex(),
    se,
  };
}

const {
  regex: myRegex,
  regexG: myRegexG,
} = toRegex(SuperExpressive()
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
  .string(")"));

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

const [, , filePath] = process.argv;

const fileContent = await Bun.file(filePath).text();
const matches = fileContent.match(myRegexG);
if (!matches) {
  process.exit(0);
}

let newContent = fileContent;

const writer = fastq.promise(async function (
  transform: (content: string) => string
) {
  newContent = transform(newContent);
  await Bun.write(filePath, newContent);
},
1);

const queue = fastq.promise(async function ({
  name,
  url,
  content,
}: {
  name: string;
  url: string;
  content: string;
}) {
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
  await writer.push((fileContent) => fileContent.replaceAll(content, newTag));
},
8);

for (const match of matches!) {
  const [, name, url] = match.match(myRegex)!;
  queue.push({
    name,
    url,
    content: match,
  });
}

await queue.drained();
await writer.drained();
