import { builder } from "./builder.js";

// Imported for their side effects: each module registers its types and fields
// on the shared builder before we call toSchema().
import "./enums.js";
import "./auth.schema.js";
import "./case.schema.js";

export const schema = builder.toSchema();
