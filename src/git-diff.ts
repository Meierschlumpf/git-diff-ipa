import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import Prism from "prismjs";

interface Props {
  full: File | null;
  compare: File | null;
}

const useFileContent = (file: File | null) =>
  useQuery({
    queryKey: ["fileContent", { name: file?.name, lastModified: file?.lastModified }],
    queryFn: async () => {
      if (!file) return null;
      return await file.text();
    },
  });

const fullRegex = /diff --git a\/(.+) b\/.+\nnew file mode 100644\nindex 0{7}\.\.[a-f0-9]+\n-{3} \/dev\/null\n\+{2,3} b\/.+\n@@ -0,0 \+\d+(?:,\d+)? @@/g;

const getFiles = (content: string) => {
  const fileNameAndContent = content
    .replaceAll("�", "")
    .replaceAll("\x00", "")
    .replaceAll("\r", "")
    .split(fullRegex)
    .filter((file) => file !== "");

  return fileNameAndContent
    .map((fileOrContent, i) => {
      if (i % 2 === 0) {
        return {
          fileName: fileOrContent,
          content: fileNameAndContent[i + 1],
        };
      }
    })
    .filter((file): file is { fileName: string; content: string } => file !== undefined);
};

const regex2 = /diff --git a\/(.+) b\/.+(?:\nnew file mode 100644)?\nindex [a-f0-9]+\.\.[a-f0-9]+(?: 100644)?\n-{3} (?:a\/.+|\/dev\/null)\n\+{3} b\/.+\n/g;

const getChanges = (content: string) => {
  const fileNameAndContent = content
    .replaceAll("�", "")
    .replaceAll("\x00", "")
    .replaceAll("\r", "")
    .split(regex2)
    .filter((file) => file !== "");

  return fileNameAndContent
    .map((fileOrContent, i) => {
      if (i % 2 === 0) {
        return {
          fileName: fileOrContent,
          content: fileNameAndContent[i + 1],
        };
      }
    })
    .filter((file): file is { fileName: string; content: string } => file !== undefined);
};

const changeRegex = /@@ -\d+,\d+ \+(\d+),\d+ @@.*\n/g;
const getChanges2 = (content: string) => {
  const changes = getChanges(content);

  return changes.map((change) => {
    return {
      fileName: change.fileName,
      content: change.content
        .split(changeRegex)
        .filter((change) => change !== "")
        .map((change, i, full) => {
          if (i % 2 === 0) {
            return {
              startLine: parseInt(change),
              content: full[i + 1],
            };
          }
        })
        .filter((change): change is { startLine: number; content: string } => change !== undefined),
    };
  });
};

const removeLastLineIfEmpty = (content: string) => {
  const lines = content.split("\n");
  if (lines[lines.length - 2] === "\\ No newline at end of file") {
    return lines.slice(0, -2).join("\n");
  }
  return content;
};

const added = { color: "green", label: "+" };
const getHighlightLinesFromChanges = (
  changes: {
    startLine: number;
    content: string;
  }[]
) => {
  const result = {} as Record<number, { color: string; label: string }>;
  for (const change of changes) {
    const lines = change.content.split("\n");
    let offset = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      if (line.startsWith("-")) {
        offset++;
        continue;
      }
      if (line.startsWith("+")) {
        result[change.startLine + i - offset] = added;
      }
    }
  }
  return result;
};

if (typeof window !== "undefined") {
  (typeof global !== "undefined" ? global : window).Prism = Prism;
  require("prismjs/components/prism-csharp");
  require("prismjs/components/prism-typescript");
  require("prismjs/components/prism-javascript");
  require("prismjs/components/prism-jsx");
  require("prismjs/components/prism-markup");
  require("prismjs/components/prism-css");
  require("prismjs/components/prism-sass");
  require("prismjs/components/prism-scss");
  require("prismjs/components/prism-json");
  require("prismjs/components/prism-yaml");
  require("prismjs/components/prism-markdown");
  require("prismjs/components/prism-docker");
  require("prismjs/components/prism-sql");
  require("prismjs/components/prism-typoscript");
}

const languageMap = {
  cs: "csharp",
  ts: "ts",
  tsx: "tsx",
  js: "js",
  jsx: "jsx",
  html: "html",
  css: "css",
  sass: "sass",
  scss: "scss",
  json: "json",
  yaml: "yaml",
  yml: "yaml",
  md: "md",
  docker: "docker",
  svg: "svg",
  xml: "xml",
  sql: "sql",
  tsconfig: "tsconfig",
};

const getLanguage = (fileName: string) => {
  const ext = fileName.split(".").pop();
  const languageToLoad = languageMap[ext as keyof typeof languageMap];
  if (!languageToLoad) return null;
  return languageToLoad;
};

export const useGitDiff = ({ full, compare }: Props) => {
  const { data: fullContent } = useFileContent(full);
  const { data: compareContent } = useFileContent(compare);
  const files = useMemo(() => (fullContent ? getFiles(fullContent) : []), [fullContent]);
  const changes = useMemo(() => (compareContent ? getChanges2(compareContent) : []), [compareContent]);
  const dict = useMemo(() => getDict(files, changes), [files, changes]);
  const fileNames = useMemo(() => files.map((file) => file.fileName), [files]);

  return {
    fileDict: files.length === 0 || changes.length === 0 ? {} : dict,
    fileNames,
  };
};

const getDict = (files: ReturnType<typeof getFiles>, changes: ReturnType<typeof getChanges2>) => {
  const dict = {} as Record<
    string,
    {
      content: string;
      hightlights: Record<number, { color: string; label: string }>;
      language: string | null;
    }
  >;

  for (const file of files) {
    dict[file.fileName] = {
      content: removeLastLineIfEmpty(file.content.replaceAll("\n+", "\n")),
      hightlights: getHighlightLinesFromChanges(changes.find((change) => change.fileName === file.fileName)?.content ?? []),
      language: getLanguage(file.fileName),
    };
  }

  return dict;
};
