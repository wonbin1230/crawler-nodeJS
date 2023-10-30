import type { Express } from "express";
import type { Server } from "http";

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { join } from "path";
import { createServer } from "http";
import { youtubeRoute } from "./routes/youtubeRoute";

const app: Express = express();
const server: Server = createServer(app);
const port: number = Number(process.env.PORT) || 5000;

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(cors());
app.use("myPublic", express.static(join(__dirname, "public")));
app.use("/crawler/youtube", youtubeRoute.router);

server.listen(port, () => {
	console.log(`Server is running at port ${port}`);
});
