import Head from "next/head";

import { Box, Button, Card, Center, Code, FileInput, Grid, Kbd, MultiSelect, Stack, Text, Title } from "@mantine/core";

import { useForm } from "@mantine/form";
import { Prism } from "@mantine/prism";
import { useGitDiff } from "../git-diff";
import { memo, useState } from "react";

const convertToTables = () => {
  const tableNode = document.querySelector("table");
  const files = document.querySelectorAll(".mantine-Paper-root");
  for (const fileCard of files) {
    const lines = fileCard.querySelectorAll(".mantine-Prism-line");
    const textTrNode = document.createElement("tr");
    const textTdNode = document.createElement("td");
    textTdNode.setAttribute("colspan", "2");
    textTdNode.innerText = fileCard.querySelector<HTMLParagraphElement>(".mantine-Text-root")!.innerText;
    textTdNode.style.fontWeight = "bold";
    textTrNode.append(textTdNode);
    tableNode!.append(textTrNode);
    for (const line of lines) {
      const lineBgc = (line as HTMLDivElement).style.backgroundColor;
      const numberNode = line.querySelector(".mantine-Prism-lineNumber");
      const contentNode = line.querySelector(".mantine-Prism-lineContent");

      const newContentNode = document.createElement("pre");
      // @ts-expect-error temporary fix
      newContentNode.classList = contentNode.classList;
      const emptyHiddenSpanNode = document.createElement("span");
      emptyHiddenSpanNode.textContent = ".";
      emptyHiddenSpanNode.style.visibility = "hidden";
      newContentNode.append(emptyHiddenSpanNode);
      newContentNode.append(...contentNode!.children);
      contentNode!.remove();
      const rowNode = document.createElement("tr");
      const tdNodeNumber = document.createElement("td");
      tdNodeNumber.style.width = "50px";
      const tdNodeContent = document.createElement("td");
      tdNodeNumber.append(numberNode!);
      tdNodeContent.append(newContentNode);
      rowNode.append(tdNodeNumber);
      rowNode.append(tdNodeContent);
      rowNode.style.backgroundColor = lineBgc;
      tableNode!.append(rowNode);
    }
    fileCard.remove();
  }

  document.querySelectorAll<HTMLSpanElement>("[style='color: rgb(47, 158, 68);']").forEach((token) => (token.style.color = null!));
};

const shouldHide = (fileName: string, exclude: string[]) => {
  return exclude.some((pattern) => {
    if (pattern.startsWith("*") && !pattern.endsWith("*")) {
      return fileName.endsWith(pattern.slice(1));
    } else if (pattern.endsWith("*") && !pattern.startsWith("*")) {
      return fileName.startsWith(pattern.slice(0, -1));
    } else if (pattern.startsWith("*") && pattern.endsWith("*")) {
      return fileName.includes(pattern.slice(1, -1));
    }
    return fileName === pattern;
  });
};

export default function Home() {
  const form = useForm({
    initialValues: {
      fullDiff: null as File | null,
      compareDiff: null as File | null,
      exclude: [] as string[],
      customExcludes: [] as string[],
    },
  });
  const [showHead, setShowHead] = useState(true);

  const { fileNames, fileDict } = useGitDiff({ full: form.values.fullDiff, compare: form.values.compareDiff });

  return (
    <>
      <Head>
        <title>Git Diff Code Highlighter</title>
        <meta name="description" content="Generated by create-t3-app" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <Center mt="lg">
        <Box w="90%">
          <Stack>
            {showHead && (
              <>
                <Stack spacing="sm" className="print-hide">
                  <Title order={3}>Instruction</Title>

                  <Text>1. Generate diff between now and the initial commit with:</Text>
                  <Code>{`git diff 4b825dc642cb6eb9a060e54bf8d69288fbee4904 HEAD > full.diff`}</Code>

                  <Text>2. Generate diff between now and the startpoint to compare:</Text>
                  <Code>{`git diff <start-commit-hash> HEAD > compare.diff`}</Code>

                  <Text>3. Upload both files, this will take some time, get a coffee in the meantime 😉</Text>

                  <Text>4. Use the settings to exclude files or paths</Text>

                  <Text>5. Click on the button to convert the code hightlights to tables, this will take a few seconds, after that you can copy the tables to your word document</Text>
                </Stack>

                <Stack spacing="sm" className="print-hide">
                  <Title order={3}>Settings</Title>

                  <Grid>
                    <Grid.Col span={12} md={6}>
                      <FileInput accept=".diff" label="Full diff file" {...form.getInputProps("fullDiff")} />
                    </Grid.Col>
                    <Grid.Col span={12} md={6}>
                      <FileInput accept=".diff" label="Compare diff file" {...form.getInputProps("compareDiff")} />
                    </Grid.Col>
                  </Grid>

                  <MultiSelect
                    data={[...fileNames, ...form.values.customExcludes]}
                    searchable
                    clearable
                    limit={10}
                    label="Files / Paths to exclude"
                    description="Choose the files to exclude or use patterns like docs/* or *.toml to exclude certain directories or file types"
                    creatable
                    getCreateLabel={(value) => value}
                    {...form.getInputProps("exclude")}
                    onCreate={(value) => {
                      form.setFieldValue("exclude", [...form.values.exclude, value]);
                      form.setFieldValue("customExcludes", [...form.values.customExcludes, value]);
                      return value;
                    }}
                  />

                  <Button
                    onClick={() => {
                      convertToTables();
                      setShowHead(false);
                    }}
                  >
                    Convert to tables (Takes a few seconds)
                  </Button>
                </Stack>

                <Title order={3} className="print-hide">
                  Files
                </Title>
              </>
            )}
            {Object.entries(fileDict)
              .sort(([_a, a], [_b, b]) => Object.keys(b.hightlights).length - Object.keys(a.hightlights).length)
              .map(([fileName, { content, hightlights, language }]) => (
                <MemoizedPreview key={fileName} hide={shouldHide(fileName, form.values.exclude)} fileName={fileName} language={language} hightlights={hightlights} content={content} />
              ))}
            <table></table>
          </Stack>
        </Box>
      </Center>
    </>
  );
}

interface PreviewProps {
  fileName: string;
  language: string | null;
  hightlights: Record<number, { color: string }>;
  content: string;
  hide: boolean;
}

const Preview = ({ fileName, language, hightlights, content, hide }: PreviewProps) => {
  if (hide) return null;
  return (
    <Card key={fileName} withBorder style={{ breakInside: "avoid" }}>
      <Stack spacing="sm">
        <Text size="lg" fw={500}>
          {fileName}
        </Text>
        <Prism title={fileName} language={language! as never} withLineNumbers noCopy highlightLines={hightlights}>
          {content}
        </Prism>
      </Stack>
    </Card>
  );
};

const MemoizedPreview = memo(Preview);
