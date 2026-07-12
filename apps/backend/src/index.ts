import { createApp } from "./app.js";
import { GRAPHQL_PATH } from "./api/v1/graphql/yoga.js";
import { env } from "./config/env.js";

const app = await createApp();

app.listen(env.PORT, () => {
  const base = `http://localhost:${env.PORT}`;
  console.log(
    `backend listening on ${base}  [env=${env.NODE_ENV} persistence=${env.PERSISTENCE}]`,
  );
  console.log(`  GraphQL + GraphiQL  ${base}${GRAPHQL_PATH}`);
  console.log(`  health              ${base}/health`);
});
