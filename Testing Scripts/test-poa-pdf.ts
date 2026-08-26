import { mkdirSync } from "fs";
import { generateDoc, OUTPUT_DIR } from "./_generate-doc";
import { sampleIntake } from "./_sample-intake";

mkdirSync(OUTPUT_DIR, { recursive: true });

generateDoc("poa", sampleIntake).catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
