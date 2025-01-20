import { spawn } from "child_process";
import path from "path";

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
  let pythonPath =
    pythonPaths.find((path) => {
      try {
        return require("fs").existsSync(path);
      } catch {
        return false;
      }
    }) || "python3"; // fallback to python3

  return new Promise((resolve, reject) => {
    const pythonProcess = spawn(pythonPath, [scriptPath, inputFilePath]);
    const outputFiles: string[] = [];
    pythonProcess.stdout.on("data", (data: Buffer) => {
      const output: string = data.toString();
      if (output.startsWith("Created ")) {
        outputFiles.push(output.replace("Created ", "").trim());
      }
    });
    pythonProcess.stderr.on("data", (data: Buffer) => {
      const errorMessage = data.toString();
      console.error(`Python Error: ${errorMessage}`);

      // Check for specific error cases
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
        reject(new Error(`Python process exited with code ${code}`));
        return;
      }
      resolve(outputFiles);
    });
  });
}
