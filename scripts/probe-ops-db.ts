import { config } from "dotenv";
config({ path: ".env.local" });
import { probeOpsTables } from "../src/lib/ops/persistence";

probeOpsTables().then((r) => {
  console.log(r);
  process.exit(r.ok ? 0 : 1);
});
