import { createApp } from './index.js';

const app = createApp();
const port = Number(process.env.PORT ?? 3000);
export const server = app.listen(port, () => console.log(`ClipChat API listening on :${port}`));
