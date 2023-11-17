import type { Request, Response } from "express";
import type { IPreviewData, IDownloadData } from "../model/youtubeModal";
import type { Readable } from "stream";

import { YoutubeService } from "../services/youtubeService";
import { minio, bucketName } from "../repository/minIO";

export const genPreview = async (req: Request, res: Response): Promise<void> => {
    try {
        const youtube: YoutubeService = new YoutubeService();
        const result: IPreviewData = await youtube.genPreview(req.body.url);
        res.send(result);
    }
    catch (error) {
        res.send(error);
    }
};

export const getPreview = async (req: Request, res: Response): Promise<void> => {
    try {
        const videoStream: Readable = await minio.getObject(bucketName, `tmp/${req.params.path}/video.mp4`);
        const videoSize: number = (await minio.statObject(bucketName, `tmp/${req.params.path}/video.mp4`)).size;
        res.writeHead(206, {
            "Content-Range": `bytes 0-${videoSize - 1}/${videoSize}`,
            "Content-Length": videoSize,
            "Content-Type": "video/mp4",
        });
        videoStream.pipe(res);
    }
    catch (error) {
        res.send(error);
    }
};

export const download = async (req: Request, res: Response): Promise<void> => {
    try {
        const youtube: YoutubeService = new YoutubeService();
        const result: IDownloadData = await youtube.download(req.body);
        const mediaStream: Readable = await minio.getObject(bucketName, `${result.folderName}/${result.fileName}`);
        const mediaSize: number = (await minio.statObject(bucketName, `${result.folderName}/${result.fileName}`)).size;
        res.writeHead(200, {
            "Content-Length": mediaSize,
            "Content-Type": result.mediaType === "MP4" ? "video/mp4" : "audio/mp3",
            "Access-Control-Expose-Headers": "X-Suggested-Filename",
            "X-Suggested-Filename": `${encodeURIComponent(result.titleName)}.${(result.mediaType).toLowerCase()}`
        });
        mediaStream.pipe(res);
    }
    catch (error) {
        res.send(error);
    }
};
