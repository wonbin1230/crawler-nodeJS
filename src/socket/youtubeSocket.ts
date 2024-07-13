import type { Server, Socket } from "socket.io";
import type { Result } from "ytsr";
import type { videoInfo } from "@distube/ytdl-core";
import type { IFormatData, IPreviewData, IDownloadRequest, IDownloadResponse } from "../model/youtubeModal";
import type { Readable } from "stream";

import { YoutubeService } from "../services/youtubeService";
import { rmSync, createReadStream } from "fs";
import { delay } from "../services/utils";
import { getInfo } from "@distube/ytdl-core";

export const ytSocket = (io: Server): void => {
	try {
		io.on("connection", (socket: Socket) => {
            console.log(`connecting with ID ${socket.id}`);

            const youtube: YoutubeService = new YoutubeService();

            socket.on("req_searchKeyWord", async (keyWord: string) => {
                socket.emit("status", "正在建立影片列表...");
                const result: Result = await youtube.searchKeyWord(keyWord);
                socket.emit("res_searchKeyWord", result);
            });

            socket.on("req_genPreview", async (url: string) => {
                socket.emit("status", "正在建立預覽影片...");
                const result: IPreviewData = await youtube.genPreview(url);
                socket.emit("status", "預覽影片建立完成");
                result.videoStream.on("error", (error: Error) => {
                    console.log(error);
                });
                result.videoStream.on("data", (chunk: Buffer) => {
                    socket.emit("chunk", chunk);
                });
                result.videoStream.on("end", () => {
                    delete result.videoStream;
                    socket.emit("res_genPreview", result);
                });
            });

            socket.on("req_download", async (req: IDownloadRequest) => {
                socket.emit("status", "取得Youtube資訊");
                const youtubeInfo: videoInfo = await getInfo(req.url);
                const needClip: boolean = req.range.start === 0 && req.range.end === Number(youtubeInfo.videoDetails.lengthSeconds) ? false : true;
                socket.emit("status", "建立暫存資料夾");
                const folderName: string = youtube.createFolder();
                socket.emit("status", "取得影片標題名稱");
                const titleName: string = youtubeInfo.videoDetails.title.replace(/([<>:"/\\|?*])/g, "");
                const fileName: string = req.mediaType === "MP3"
                ? needClip ? "cliped.mp3" : "result.mp3"
                : needClip ? "cliped.mp4" : "result.mp4";
                const clipFileName: string = req.mediaType === "MP3" ? "result.mp3" : "result.mp4";
                socket.emit("status", "取得影片格式");
                const { videoFormat, audioFormat }: IFormatData = await youtube.getFormatData(youtubeInfo, undefined, req.mediaType, req.itag);
                socket.emit("status", "下載影片中...");
                const ytdlResult: string = await youtube.ytdlDownload(req.url, videoFormat, audioFormat, folderName);
                if (ytdlResult === "2") {
                    socket.emit("status", "轉換成MP3格式");
                    await delay(1000);
                    await youtube.convertToMp3(folderName, socket);
                }
                else if (ytdlResult === "3") {
                    socket.emit("status", "將影片及音檔合併");
                    await delay(1000);
                    await youtube.mergeVideoAndAudio(folderName, socket);
                    await delay(5000);
                }
                if (needClip) {
                    socket.emit("status", "剪輯中...");
                    await delay(1000);
                    await youtube.clipMedia(req.range, folderName, fileName, clipFileName, socket);
                }
                const mediaStream: Readable = createReadStream(`${folderName}/${fileName}`);
                mediaStream.on("data", (chunk: Buffer) => {
                    socket.emit("chunk", chunk);
                });
                mediaStream.on("end", async () => {
                    socket.emit("status", "完成");
                    await delay(2000);
                    const result: IDownloadResponse = {
                        mediaType: req.mediaType,
                        titleName: titleName
                    };
                    rmSync(folderName, { recursive: true, force: true });
                    socket.emit("res_download", result);
                });
            });
		});
	}
    catch (error) {
		console.log(error);
		throw error;
	}
};
