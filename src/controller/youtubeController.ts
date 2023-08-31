import type { Request, Response } from "express";
import { YoutubeService } from "../services/youtubeService";

export const youtubeDownload = async (req: Request, res: Response): Promise<void> => {
    try {
        const youtube: YoutubeService = new YoutubeService(req.body.url);
        const result: string = await youtube.main();
        res.send(result);
    }
    catch (error) {
        res.send(error);
    }
};
