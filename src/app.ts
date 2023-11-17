import type { Express } from "express";
import type { Server as httpServer } from "http";

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { join } from "path";
import { createServer } from "http";
import { youtubeRoute } from "./routes/youtubeRoute";
import { Server } from "socket.io";
import { ytSocket } from "./socket/youtubeSocket";

const app: Express = express();
const server: httpServer = createServer(app);
const port: number = Number(process.env.PORT) || 5000;
ytSocket(new Server(server));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(cors());
app.use("myPublic", express.static(join(__dirname, "public")));
app.use("/crawler/youtube", youtubeRoute.router);

server.listen(port, () => {
	console.log(`Server is running at port ${port}`);
});
