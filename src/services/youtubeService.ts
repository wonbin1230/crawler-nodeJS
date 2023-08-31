// import { launch } from "puppeteer";
// import type { Browser, Page } from "puppeteer";
import { mkdirSync, existsSync } from "fs";
import { join } from "path";
import { v4 as uuidv4 } from "uuid";
import ytdl, { getInfo, filterFormats } from "ytdl-core";
import { createWriteStream } from "fs";
import type { videoInfo, videoFormat, Filter } from "ytdl-core";
import ffmpeg from "fluent-ffmpeg";
import type { FormatData } from "../model/youtubeModal";
import type { CodecData, Progress } from "../model/ffmpegEventModal";

const videoItag: number[] = [37, 137, 22, 136, 18];
const audioItag: number[] = [141, 140, 139];

export class YoutubeService {
    url: string;
    constructor(url: string) {
        this.url = url;
    }

    async main(): Promise<string> {
        try {
            let result: string = "";
            const youtubeInfo: videoInfo = await getInfo(this.url);
            const folderPath: string = await this.createFolder();
            const fileName: string = `${youtubeInfo.videoDetails.title.replace(/([<>:"/\\|?*])/g, "")}.mp4`;
            const { videoFormat, audioFormat }: FormatData = await this.getFormatData(youtubeInfo);
            const ytdlResult: string = await this.ytdlDownload(this.url, videoFormat, audioFormat, folderPath, fileName);
            console.log(ytdlResult);
            if (ytdlResult.includes("Video and Audio has downloaded successfully")) {
                result = await this.mergeVideoAndAudio(folderPath, fileName);
            }
            if (result) {
                return result;
            }
            // await this.download(videoFormat, audioFormat, folderPath, fileName);

            // const browser: Browser = await launch({
            //     headless: false,
            //     executablePath: "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe"
            // });
            // const page: Page = await browser.newPage();
            // await page.setViewport({width: 1080, height: 1024});
            // await page.goto(this.url);
            // await page.waitForSelector(".html5-video-container");
            // await browser.close();
        }
        catch (error) {
            console.log(error);
            throw error;
        }
    }

    async ytdlDownload(url: string, videoFormat: videoFormat, audioFormat: videoFormat, folderPath: string, fileName: string): Promise<string> {
        return new Promise((resolve: (value: string | PromiseLike<string>) => void) => {
            if (!audioFormat) {
                ytdl(url, { format: videoFormat })
                .pipe(createWriteStream(`${folderPath}/${fileName}`))
                .on("close", () => {
                    resolve(`Video has downloaded successfully at ${folderPath}`);
                });
            }
            else {
                ytdl(url, { format: videoFormat })
                .pipe(createWriteStream(`${folderPath}/video.mp4`))
                .on("close", () => {
                    ytdl(url, { format: audioFormat })
                    .pipe(createWriteStream(`${folderPath}/audio.mp4`))
                    .on("close", () => {
                        resolve(`Video and Audio has downloaded successfully at ${folderPath}`);
                    });
                });
            }
        });
    }

    async createFolder(): Promise<string> {
        try {
            const folderName: string = uuidv4().replace(/-/g, "");
            const folderPath: string = join(__dirname, "..", "..", "ytTmp", `${folderName}`);
            if (!existsSync(folderPath)) {
                mkdirSync(folderPath, { recursive: true });
            }
            return folderPath;
        }
        catch (error) {
            console.log(error);
            throw error;
        }
    }

    async getFormatData(ytInfo: videoInfo): Promise<FormatData> {
        try {
            let videoFormat: videoFormat, audioFormat: videoFormat;
            for (const itag of videoItag) {
                const videoFilter: Filter = (format: videoFormat) => format.itag === itag;
                [videoFormat] = filterFormats(ytInfo.formats, videoFilter);
                if (itag === 137 || itag === 136) {
                    if (videoFormat) {
                        for (const aItag of audioItag) {
                            const audioFilter: Filter = (format: videoFormat) => format.itag === aItag;
                            [audioFormat] = filterFormats(ytInfo.formats, audioFilter);
                            if (audioFormat) {
                                break;
                            }
                        }
                        break;
                    }
                }
                else {
                    if (videoFormat) {
                        break;
                    }
                }
            }
            return { videoFormat, audioFormat };
        }
        catch (error) {
            console.log(error);
            throw error;
        }
    }

    mergeVideoAndAudio(folderPath: string, fileName: string): Promise<string> {
        return new Promise((resolve: (value: string | PromiseLike<string>) => void, reject: (reason?: Error) => void) => {
            let totalTime: number;
            ffmpeg(`${folderPath}/video.mp4`)
                .addInput(`${folderPath}/audio.mp4`)
                .addOptions(["-map 0:v", "-map 1:a", "-c:v copy"])
                .format("mp4")
                .save(`${folderPath}/${fileName}`)
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
                    console.log("OK");
                    resolve("OK");
                });
        });
    }
}
