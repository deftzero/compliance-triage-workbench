import { builder } from "./builder";

// Imported for their side effects: each module registers its types and fields
// on the shared builder before we call toSchema().
import "./enums";
import "./auth.schema";
import "./case.schema";

export const schema = builder.toSchema();
