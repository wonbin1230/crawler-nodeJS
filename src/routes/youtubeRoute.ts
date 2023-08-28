import express from "express";
import type { Router } from "express";
import { youtubeDownload } from "../controller/youtubeController";

class YoutubeRoute {
	router: Router;
	constructor() {
		this.router = express.Router();
		this.initializeRoute();
	}

	initializeRoute(): void {
		this.router.post("/", youtubeDownload);
	}
}

export const youtubeRoute: YoutubeRoute = new YoutubeRoute();
