import { createApp } from "./app.js";
import { env } from "./config/env.js";

const app = await createApp();

app.listen(env.PORT, () => {
  console.log(
    `backend listening on http://localhost:${env.PORT}  ` +
      `[env=${env.NODE_ENV} persistence=${env.PERSISTENCE}]`,
  );
});
