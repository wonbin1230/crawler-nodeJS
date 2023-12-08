import type { Result, Filter as FilterYtsr } from "ytsr";
import type { videoInfo, videoFormat, Filter } from "ytdl-core";
import type { IFormatData, IPreviewData, IItagInfo, ItagTranslations, IDownloadRequest, IDownloadData } from "../model/youtubeModal";
import type { CodecData, Progress } from "../model/ffmpegEventModal";
import type { WriteStream } from "fs";
import type { Stream } from "stream";
import type { Socket } from "socket.io";

import ffmpeg from "fluent-ffmpeg";
import { mkdirSync, rmSync, existsSync, createWriteStream } from "fs";
import { join } from "path";
import { v4 as uuidv4 } from "uuid";
import { minio, bucketName } from "../repository/minIO";
import ytsr from "ytsr";
import ytdl, { getInfo, filterFormats, chooseFormat } from "ytdl-core";

const previewItag: number[] = [18, 22, 37];
const videoItag: number[] = [37, 137, 22, 136, 18];
const audioItag: number[] = [141, 140, 139];

export class YoutubeService {
    async searchKeyWord(keyWord: string): Promise<Result> {
        try {
            const filters: Map<string, Map<string, FilterYtsr>> = await ytsr.getFilters(keyWord);
            const targetType: FilterYtsr = filters.get("Type").get("Video");
            const result: Result = await ytsr(targetType.url, { limit: 96 });
            return result;
        }
        catch (error) {
            console.log(error);
            throw error;
        }
    }

    async genPreview(url: string): Promise<IPreviewData> {
        try {
            const videoItagList: IItagInfo[] = [];
            const audioItagList: IItagInfo[] = [];
            const itagTranslations: ItagTranslations = {
                37: "1080p",
                137: "1080p",
                22: "720p",
                136: "720p",
                18: "360p",
                139: "48k",
                140: "128k",
                141: "256k",
            };
            const youtubeInfo: videoInfo = await getInfo(url);

            const hasAudio: videoFormat[] = youtubeInfo.formats.filter((ele: videoFormat) => {
                return audioItag.includes(ele.itag);
            });

            const has37: boolean = youtubeInfo.formats.some((ele: videoFormat) => ele.itag === 37);
            const has22: boolean = youtubeInfo.formats.some((ele: videoFormat) => ele.itag === 22);

            for (let i: number = 0; i < youtubeInfo.formats.length; i++) {
                const ele: videoFormat = youtubeInfo.formats[i];
                if (videoItag.includes(ele.itag)) {
                    if ((ele.itag === 137 && has37) || (ele.itag === 136 && has22) ||
                        ((ele.itag === 137 || ele.itag === 136) && hasAudio.length === 0)) {
                        continue;
                    }

                    const videoObj: { itag: number, resolution: string } = {
                        itag: ele.itag,
                        resolution: itagTranslations[ele.itag as keyof ItagTranslations] as string,
                    };
                    videoItagList.push(videoObj);
                }
                if (audioItag.includes(ele.itag)) {
                    const audioObj: { itag: number, resolution: string } = {
                        itag: ele.itag,
                        resolution: itagTranslations[ele.itag as keyof ItagTranslations] as string,
                    };
                    audioItagList.push(audioObj);
                }
            }

            videoItagList.length > 0 && videoItagList.reverse();
            audioItagList.length > 0 && audioItagList.reverse();

            const { videoFormat }: IFormatData = await this.getFormatData(youtubeInfo, true);
            const videoStream: Stream = ytdl(url, { format: videoFormat });
            const result: IPreviewData = {
                    videoStream,
                    lengthSeconds: youtubeInfo.videoDetails.lengthSeconds,
                    videoItagList,
                    audioItagList,
                };

            return result;
        }
        catch (error) {
            console.log(error);
            throw error;
        }
    }

    async download(qry: IDownloadRequest): Promise<IDownloadData> {
        try {
            if (!existsSync(`${__dirname}/tmp`)) {
                mkdirSync(`${__dirname}/tmp`);
            }
            const youtubeInfo: videoInfo = await getInfo(qry.url);
            const folderName: string = this.createFolder();
            const titleName: string = `${youtubeInfo.videoDetails.title.replace(/([<>:"/\\|?*])/g, "")}`;
            const fileName: string = qry.mediaType === "MP3" ? "result.mp3" : "result.mp4";
            const { videoFormat, audioFormat }: IFormatData = await this.getFormatData(youtubeInfo, undefined, qry.mediaType, qry.itag);
            const ytdlResult: string = await this.ytdlDownload(qry.url, videoFormat, audioFormat, folderName);
            const mediaType: string = qry.mediaType;
            if (ytdlResult === "1") {
                await minio.fGetObject(bucketName, `${folderName}/video.mp4`, join(__dirname, "../..", "/tmp/video.mp4"));
                await this.clipMedia(qry.range, folderName, fileName);
            }
            else if (ytdlResult === "2") {
                await this.convertToMp3(folderName);
                await this.clipMedia(qry.range, folderName, fileName);
            }
            else if (ytdlResult === "3") {
                await this.mergeVideoAndAudio(folderName);
                await this.clipMedia(qry.range, folderName, fileName);
            }
            rmSync(join(__dirname, "../..", "/tmp"), { recursive: true });

            return { folderName, fileName, titleName, mediaType };
        }
        catch (error) {
            console.log(error);
            throw error;
        }
    }

    ytdlDownload(url: string, videoFormat: videoFormat, audioFormat: videoFormat, folderName: string): Promise<string> {
        return new Promise((resolve: (value: string | PromiseLike<string>) => void, reject: (reason?: Error) => void) => {
            if (!audioFormat) {
                const videoStream: Stream = ytdl(url, { format: videoFormat });
                const videoFile: WriteStream = createWriteStream(`${folderName}/result.mp4`);
                videoStream.pipe(videoFile);
                videoFile.on("error", (error: Error) => reject(error));
                videoFile.on("finish", () => resolve("1"));
            }
            else if (!videoFormat) {
                const audioStream: Stream = ytdl(url, { format: audioFormat });
                const audioFile: WriteStream = createWriteStream(`${folderName}/audio.m4a`);
                audioStream.pipe(audioFile);
                audioFile.on("error", (error: Error) => reject(error));
                audioFile.on("finish", () => resolve("2"));
            }
            else {
                const videoStream: Stream = ytdl(url, { format: videoFormat });
                const audioStream: Stream = ytdl(url, { format: audioFormat });
                const videoFile: WriteStream = createWriteStream(`${folderName}/video.mp4`);
                const audioFile: WriteStream = createWriteStream(`${folderName}/audio.m4a`);
                videoStream.pipe(videoFile);
                audioStream.pipe(audioFile);
                videoFile.on("error", (error: Error) => reject(error));
                audioFile.on("error", (error: Error) => reject(error));
                audioFile.on("finish", () => resolve("3"));
            }
        });
    }

    createFolder(): string {
        try {
            const basePath: string = join(__dirname, "../..", "/tmp");
            if (!existsSync(basePath)) {
                mkdirSync(basePath);
            }
            const folderName: string = uuidv4().replace(/-/g, "");
            mkdirSync(join(basePath, folderName));
            return `${basePath}/${folderName}`;
        }
        catch (error) {
            console.log(error);
            throw error;
        }
    }

    async getFormatData(ytInfo: videoInfo, isPreview?: boolean, mediaType?: string, requestItag?: number): Promise<IFormatData> {
        try {
            let videoFormat: videoFormat, audioFormat: videoFormat;
            if (isPreview) {
                for (const itag of previewItag) {
                    const videoFilter: Filter = (format: videoFormat) => format.itag === itag;
                    [videoFormat] = filterFormats(ytInfo.formats, videoFilter);
                    if (videoFormat) {
                        break;
                    }
                }
                return { videoFormat };
            }
            else {
                if (mediaType === "MP3") {
                    audioFormat = chooseFormat(ytInfo.formats, { quality: String(requestItag) });
                }
                else {
                    if (requestItag === 137 || requestItag === 136) {
                        [audioFormat] = ytInfo.formats.filter((ele: videoFormat) => {
                            return audioItag.includes(ele.itag);
                        });
                    }
                    videoFormat = chooseFormat(ytInfo.formats, { quality: String(requestItag) });
                }

                return { videoFormat, audioFormat };
            }
        }
        catch (error) {
            console.log(error);
            throw error;
        }
    }

    async mergeVideoAndAudio(folderName: string, socket?: Socket): Promise<string> {
        return new Promise((resolve: (value: string | PromiseLike<string>) => void, reject: (reason?: Error) => void) => {
            let totalTime: number;
            ffmpeg(`${folderName}/video.mp4`)
                .addInput(`${folderName}/audio.m4a`)
                .addOptions(["-map 0:v", "-map 1:a", "-c:v copy"])
                .format("mp4")
                .on("codecData", (data: CodecData) => {
                    totalTime = parseInt(data.duration.replace(/:/g, ""));
                })
                .on("progress", (progress: Progress) => {
                    const time: number = parseInt(progress.timemark.replace(/:/g, ""));
                    let percent: number = Math.floor((time / totalTime) * 100);
                    if (percent < 0) {
                        percent = 0;
                    }
                    socket.emit("status", `合併已完成${percent}%`);
                })
                .save(`${folderName}/result.mp4`)
                .on("error", (err: Error) => {
                    console.log(err);
                    reject(err);
                })
                .on("end", () => {
                    console.log("mergeVideoAndAudio OK");
                    resolve("OK");
                });
        });
    }

    async convertToMp3(folderName: string, socket?: Socket): Promise<string> {
        return new Promise((resolve: (value: string | PromiseLike<string>) => void, reject: (reason?: Error) => void) => {
            let totalTime: number;
            ffmpeg(`${folderName}/audio.m4a`)
                .audioCodec("libmp3lame")
                .on("codecData", (data: CodecData) => {
                    totalTime = parseInt(data.duration.replace(/:/g, ""));
                })
                .on("progress", (progress: Progress) => {
                    const time: number = parseInt(progress.timemark.replace(/:/g, ""));
                    let percent: number = Math.floor((time / totalTime) * 100);
                    if (percent < 0) {
                        percent = 0;
                    }
                    socket.emit("status", `轉換已完成${percent}%`);
                })
                .save(join(`${folderName}/result.mp3`))
                .on("error", (err: Error) => {
                    console.log(err);
                    reject(err);
                })
                .on("end", () => {
                    console.log("convertToMp3 OK");
                    resolve("OK");
                });
        });
    }

    clipMedia(range: { start: number, end: number }, folderName: string, fileName: string, clipFileName?: string, socket?: Socket): Promise<string> {
        return new Promise((resolve: (value: string | PromiseLike<string>) => void, reject: (reason?: Error) => void) => {
            const duration: number = range.end - range.start;
            let totalTime: number;
            ffmpeg(`${folderName}/${clipFileName}`)
                .seekInput(range.start)
                .duration(duration)
                .on("codecData", (data: CodecData) => {
                    totalTime = parseInt(data.duration.replace(/:/g, ""));
                })
                .on("progress", (progress: Progress) => {
                    const time: number = parseInt(progress.timemark.replace(/:/g, ""));
                    let percent: number = Math.floor((time / totalTime) * 100);
                    if (percent < 0) {
                        percent = 0;
                    }
                    socket.emit("status", `剪輯已完成${percent}%`);
                })
                .save(`${folderName}/${fileName}`)
                .on("error", (err: Error) => {
                    console.log(err);
                    reject(err);
                })
                .on("end", () => {
                    console.log("clipMedia OK");
                    resolve("OK");
                });
        });
    }
}
