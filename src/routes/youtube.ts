import express, { Router } from "express";
import youtubeController from "../controller/youtube";

class YoutubeRoute {
    router: Router;
    constructor() {
        this.router = express.Router();
        this.initializeRoute();
    }

    initializeRoute() {
        this.router.get("/", youtubeController.getVal);
    }
}

export const youtubeRoute = new YoutubeRoute();
