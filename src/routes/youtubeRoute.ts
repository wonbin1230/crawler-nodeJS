import type { Router } from "express";

import express from "express";
import { genPreview, getPreview, download } from "../controller/youtubeController";

class YoutubeRoute {
	router: Router;
	constructor() {
		this.router = express.Router();
		this.initializeRoute();
	}

	initializeRoute(): void {
        this.router.get("/preview/:path", getPreview)
                    .post("/preview", genPreview);

		this.router.post("/download", download);
	}
}

export const youtubeRoute: YoutubeRoute = new YoutubeRoute();
