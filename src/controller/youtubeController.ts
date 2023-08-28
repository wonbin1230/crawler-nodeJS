import type { Request, Response } from "express";
import { YoutubeService } from "../services/youtubeService";

export const youtubeDownload = async (req: Request, res: Response): Promise<void> => {
    try {
        const youtube: YoutubeService = new YoutubeService(req.body.url);
        await youtube.goPage();
        res.send("OK");
    }
    catch (error) {
        res.send(error);
    }
};
