"use strict";

const RULES = [
  {
    names: ["P001", "no-prose-em-dash"],
    description: "Disallow em dashes in Markdown prose",
    character: "—",
    detail: "Use a comma instead of an em dash in prose",
  },
  {
    names: ["P002", "no-prose-semicolon"],
    description: "Disallow semicolons in Markdown prose",
    character: ";",
    detail: "Use a comma instead of a semicolon in prose",
  },
];

function isOpenToken(token) {
  return token.nesting === 1;
}

function isCloseToken(token) {
  return token.nesting === -1;
}

function shouldInspectInline(stack) {
  if (stack.includes("blockquote_open")) return false;

  return stack.some((type) => (
    type === "heading_open" ||
    type === "paragraph_open" ||
    type === "td_open" ||
    type === "th_open"
  ));
}

function findSourceColumn(line, text, startColumn) {
  if (!line || !text) return -1;
  return line.indexOf(text, startColumn);
}

function reportCharacter(params, onError, lineIndex, sourceColumn, text, rule) {
  let offset = text.indexOf(rule.character);

  while (offset !== -1) {
    onError({
      lineNumber: lineIndex + 1,
      detail: rule.detail,
      context: params.lines[lineIndex].trim(),
      range: [sourceColumn + offset + 1, 1],
    });

    offset = text.indexOf(rule.character, offset + 1);
  }
}

function inspectInlineToken(params, onError, token, rule, lineSearchColumns) {
  if (!token.children) return;

  let lineIndex = Array.isArray(token.map) ? token.map[0] : token.lineNumber - 1;
  let searchColumn = lineSearchColumns.get(lineIndex) || 0;
  const linkStack = [];

  for (const child of token.children) {
    if (child.type === "softbreak" || child.type === "hardbreak") {
      lineSearchColumns.set(lineIndex, searchColumn);
      lineIndex += 1;
      searchColumn = lineSearchColumns.get(lineIndex) || 0;
      continue;
    }

    if (child.type === "link_open") {
      linkStack.push(child.markup === "autolink");
      continue;
    }

    if (child.type === "link_close") {
      linkStack.pop();
      continue;
    }

    const text = child.content || "";
    if (!text) continue;

    const sourceColumn = findSourceColumn(params.lines[lineIndex], text, searchColumn);
    const isAutolinkText = linkStack.includes(true);
    const isVisibleProse = child.type === "text" || child.type === "image";

    if (sourceColumn === -1) {
      continue;
    }

    if (isVisibleProse && !isAutolinkText) {
      reportCharacter(params, onError, lineIndex, sourceColumn, text, rule);
    }

    searchColumn = sourceColumn + text.length;
  }

  lineSearchColumns.set(lineIndex, searchColumn);
}

function createRule(rule) {
  return {
    names: rule.names,
    description: rule.description,
    tags: ["punctuation"],
    parser: "markdownit",
    function: function prosePunctuation(params, onError) {
      const stack = [];
      const lineSearchColumns = new Map();

      for (const token of params.parsers.markdownit.tokens) {
        if (isOpenToken(token)) {
          stack.push(token.type);
        } else if (isCloseToken(token)) {
          stack.pop();
        } else if (token.type === "inline" && shouldInspectInline(stack)) {
          inspectInlineToken(params, onError, token, rule, lineSearchColumns);
        }
      }
    },
  };
}

module.exports = RULES.map(createRule);
