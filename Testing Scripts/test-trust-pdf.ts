import { generateDoc } from "./_generate-doc";
import { sampleIntake } from "./_sample-intake";

generateDoc("trust", sampleIntake).catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
