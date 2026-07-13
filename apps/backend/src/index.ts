import { createApp } from "./app";
import { GRAPHQL_PATH } from "./api/v1/graphql/yoga";
import { env } from "./config/env";

const app = await createApp();

app.listen(env.PORT, () => {
  const base = `http://localhost:${env.PORT}`;
  console.log(
    `backend listening on ${base}  [env=${env.NODE_ENV}]`,
  );
  console.log(`  GraphQL + GraphiQL  ${base}${GRAPHQL_PATH}`);
  console.log(`  health              ${base}/health`);
});
