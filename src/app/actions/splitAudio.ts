import { spawn } from "child_process";
import path from "path";
import fs from "fs";
export async function splitAudio(inputFilePath: string): Promise<string[]> {
  const scriptPath = path.join(
    process.cwd(),
    "src",
    "server",
    "python",
    "split_audio.py",
  );

  const pythonPaths = [
    "/usr/local/bin/python3.11",
    "/usr/bin/python3.11",
    "/opt/homebrew/bin/python3.11",
    "/usr/local/opt/python@3.11/bin/python3.11",
    "python3.11", // will use system PATH
  ];

  // Find the first working Python path
  const pythonPath =
    pythonPaths.find((path) => {
      try {
        return fs.existsSync(path);
      } catch {
        return false;
      }
    }) ?? "python3"; // fallback to python3

  return new Promise((resolve, reject) => {
    const pythonProcess = spawn(pythonPath, [scriptPath, inputFilePath]);
    const outputFiles = new Set<string>(); // Use Set to prevent duplicates
    let errorOutput = "";

    pythonProcess.stdout.on("data", (data: Buffer) => {
      const filenames = data.toString().trim().split("\n");
      filenames
        .filter(Boolean)
        .forEach((filename) => outputFiles.add(filename));
    });

    pythonProcess.stderr.on("data", (data: Buffer) => {
      const errorMessage = data.toString();
      errorOutput += errorMessage;
      console.error(`Python Error: ${errorMessage}`);

      if (errorMessage.includes("No module named 'pydub'")) {
        reject(
          new Error(
            "Missing required Python package. Please run: pip3 install pydub",
          ),
        );
        return;
      }
    });

    pythonProcess.on("close", (code) => {
      if (code !== 0) {
        // Extract the most relevant error message
        const errorMatch = /Exception: (.+?)(\n|$)/.exec(errorOutput);
        const friendlyError = errorMatch
          ? errorMatch[1]
          : `Python process exited with code ${code}`;
        reject(new Error(friendlyError));
        return;
      }
      resolve(Array.from(outputFiles)); // Convert Set back to array
    });
  });
}
