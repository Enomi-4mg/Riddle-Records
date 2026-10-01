import { checkRoundtrip } from "./roundtrip-cms.mjs";
const kind = process.argv[2];
if (!["gallery", "projects"].includes(kind)) throw new Error("Expected gallery or projects");
await checkRoundtrip(kind);
