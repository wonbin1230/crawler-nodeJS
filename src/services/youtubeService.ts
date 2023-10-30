import type { videoInfo, videoFormat, Filter } from "ytdl-core";
import type { IFormatData, IPreviewData, IItagInfo, ItagTranslations, IDownloadData } from "../model/youtubeModal";
import type { CodecData, Progress } from "../model/ffmpegEventModal";
import type { Readable } from "stream";

import ffmpeg from "fluent-ffmpeg";
import { mkdirSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { v4 as uuidv4 } from "uuid";
import { minio, bucketName } from "../repository/minIO";
import ytdl, { getInfo, filterFormats, chooseFormat } from "ytdl-core";

const previewItag: number[] = [18, 22, 37];
const videoItag: number[] = [37, 137, 22, 136, 18];
const audioItag: number[] = [141, 140, 139];

export class YoutubeService {
    url: string;
    constructor(url: string) {
        this.url = url;
    }

    async genPreview(): Promise<IPreviewData> {
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
            let result: IPreviewData;
            const youtubeInfo: videoInfo = await getInfo(this.url);

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

            const folderName: string = await this.#getFolderName();
            const { videoFormat }: IFormatData = await this.#getFormatData(youtubeInfo, true);
            const ytdlResult: string = await this.#ytdlDownload(this.url, videoFormat, undefined, folderName);
            if (ytdlResult === "1") {
                result = {
                    videoFolderID: folderName,
                    videoInfo: {
                        lengthSeconds: youtubeInfo.videoDetails.lengthSeconds,
                        videoItagList,
                        audioItagList,
                    },
                };
            }

            return result;
        }
        catch (error) {
            console.log(error);
            throw error;
        }
    }

    async download(range: { start: number, end: number }, mediaType: string, itag: number): Promise<IDownloadData> {
        try {
            if (!existsSync(`${__dirname}/tmp`)) {
                mkdirSync(`${__dirname}/tmp`);
            }
            const youtubeInfo: videoInfo = await getInfo(this.url);
            const folderName: string = await this.#getFolderName();
            const titleName: string = `${youtubeInfo.videoDetails.title.replace(/([<>:"/\\|?*])/g, "")}`;
            const fileName: string = mediaType === "MP3" ? "result.mp3" : "result.mp4";
            const { videoFormat, audioFormat }: IFormatData = await this.#getFormatData(youtubeInfo, undefined, mediaType, itag);
            const ytdlResult: string = await this.#ytdlDownload(this.url, videoFormat, audioFormat, folderName);
            if (ytdlResult === "1") {
                await minio.fGetObject(bucketName, `${folderName}/video.mp4`, join(__dirname, "../..", "/tmp/video.mp4"));
                await this.#clipMedia(range, "video.mp4", folderName, fileName);
            }
            else if (ytdlResult === "2") {
                await this.#convertToMp3(folderName);
                await this.#clipMedia(range, "semiFinished.mp3", folderName, fileName);
            }
            else if (ytdlResult === "3") {
                await this.#mergeVideoAndAudio(folderName);
                await this.#clipMedia(range, "semiFinished.mp4", folderName, fileName);
            }
            rmSync(join(__dirname, "../..", "/tmp"), { recursive: true });

            return { folderName, fileName, titleName, mediaType };
        }
        catch (error) {
            console.log(error);
            throw error;
        }
    }

    async #ytdlDownload(url: string, videoFormat: videoFormat, audioFormat: videoFormat, folderName: string): Promise<string> {
        try {
            if (!audioFormat) {
                const videoStream: Readable = ytdl(url, { format: videoFormat });
                await minio.putObject(bucketName, `${folderName}/video.mp4`, videoStream);
                return "1";
            }
            else if (!videoFormat) {
                const audioStream: Readable = ytdl(url, { format: audioFormat });
                await minio.putObject(bucketName, `${folderName}/audio.m4a`, audioStream);
                return "2";
            }
            else {
                const videoStream: Readable = ytdl(url, { format: videoFormat });
                const audioStream: Readable = ytdl(url, { format: audioFormat });
                await minio.putObject(bucketName, `${folderName}/video.mp4`, videoStream);
                await minio.putObject(bucketName, `${folderName}/audio.m4a`, audioStream);
                return "3";
            }
        }
        catch (error) {
            console.log(error);
            throw error;
        }
    }

    async #getFolderName(): Promise<string> {
        try {
            const folderName: string = uuidv4().replace(/-/g, "");
            return folderName;
        }
        catch (error) {
            console.log(error);
            throw error;
        }
    }

    async #getFormatData(ytInfo: videoInfo, isPreview?: boolean, mediaType?: string, requestItag?: number): Promise<IFormatData> {
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

    async #mergeVideoAndAudio(folderName: string): Promise<string> {
        await minio.fGetObject(bucketName, `${folderName}/video.mp4`, join(__dirname, "../..", "/tmp/video.mp4"));
        await minio.fGetObject(bucketName, `${folderName}/audio.m4a`, join(__dirname, "../..", "/tmp/audio.m4a"));
        return new Promise((resolve: (value: string | PromiseLike<string>) => void, reject: (reason?: Error) => void) => {
            let totalTime: number;
            ffmpeg(join(__dirname, "../..", "/tmp/video.mp4"))
                .addInput(join(__dirname, "../..", "/tmp/audio.m4a"))
                .addOptions(["-map 0:v", "-map 1:a", "-c:v copy"])
                .format("mp4")
                .save(join(__dirname, "../..", "/tmp/semiFinished.mp4"))
                .on("codecData", (data: CodecData) => {
                    totalTime = parseInt(data.duration.replace(/:/g, ""));
                })
                .on("progress", (progress: Progress) => {
                    const time: number = parseInt(progress.timemark.replace(/:/g, ""));
                    const percent: number = (time / totalTime) * 100;
                    console.log("Processing: " + percent + "% done");
                })
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

    async #convertToMp3(folderName: string): Promise<string> {
        await minio.fGetObject(bucketName, `${folderName}/audio.m4a`, join(__dirname, "../..", "/tmp/audio.m4a"));
        return new Promise((resolve: (value: string | PromiseLike<string>) => void, reject: (reason?: Error) => void) => {
            ffmpeg(join(__dirname, "../..", "/tmp/audio.m4a"))
                .audioCodec("libmp3lame")
                .save(join(__dirname, "../..", "/tmp/semiFinished.mp3"))
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

    #clipMedia(range: { start: number, end: number }, semiName: string, folderName: string, fileName: string): Promise<string> {
        return new Promise((resolve: (value: string | PromiseLike<string>) => void, reject: (reason?: Error) => void) => {
            const duration: number = range.end - range.start;
            ffmpeg(join(__dirname, "../..", `/tmp/${semiName}`))
                .seekInput(range.start)
                .duration(duration)
                .save(join(__dirname, "../..", `/tmp/${fileName}`))
                .on("error", (err: Error) => {
                    console.log(err);
                    reject(err);
                })
                .on("end", async () => {
                    await minio.fPutObject(bucketName, `${folderName}/${fileName}`, join(__dirname, "../..", `/tmp/${fileName}`));
                    console.log("clipMedia OK");
                    resolve("OK");
                });
        });
    }
}
