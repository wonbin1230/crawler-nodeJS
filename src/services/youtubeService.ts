// import { launch } from "puppeteer";
// import type { Browser, Page } from "puppeteer";
import { mkdirSync, existsSync } from "fs";
import { join } from "path";
import { v4 as uuidv4 } from "uuid";
import { getInfo, filterFormats } from "ytdl-core";
import type { videoInfo, videoFormat, Filter } from "ytdl-core";
import ffmpeg from "fluent-ffmpeg";
import type { FormatData } from "../model/youtubeModal";

// const videoItag: number[] = [18, 22, 37, 82, 83, 84, 85];
const videoItag: number[] = [37, 137, 22, 136, 18];
const audioItag: number[] = [141, 140, 139];

export class YoutubeService {
    url: string;
    constructor(url: string) {
        this.url = url;
    }

    async main(): Promise<void> {
        try {
            const youtubeInfo: videoInfo = await getInfo(this.url);
            const folderPath: string = await this.createFolder();
            const fileName: string = `${youtubeInfo.videoDetails.title.replace(/([<>:"/\\|?*])/g, "")}.mp4`;
            const { videoFormat, audioFormat }: FormatData = await this.getFormatData(youtubeInfo);
            await this.download(videoFormat, audioFormat, folderPath, fileName);

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

    async createFolder(): Promise<string> {
        try {
            const folderName: string = uuidv4();
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

    async download(videoFormat: videoFormat, audioFormat: videoFormat, folderPath: string, fileName: string): Promise<void> {
        try {
            // if (!audioFormat) {
            //     ffmpeg(videoFormat.url)
            //         .save(`${folderPath}\\${fileName}.mp4`)
            //         .on("error", (err: Error) => {
            //             console.log(err);
            //         })
            //         .on("end", () => {
            //             console.log("OK");
            //         });
            // }
            // else {
            //     ffmpeg(videoFormat.url)
            //         .addInput(audioFormat.url)
            //         .addOptions(["-map 0:v", "-map 1:a", "-c:v copy"])
            //         .format("mp4")
            //         .save(`${folderPath}/${fileName}.mp4`)
            //         .on("error", (err: Error) => {
            //             console.log(err);
            //         })
            //         .on("end", () => {
            //             console.log("OK");
            //         });
            // }
            ffmpeg(videoFormat.url)
                .save(`${folderPath}\\${fileName}.mp4`)
                .on("error", (err: Error) => {
                    console.log(err);
                })
                .on("end", () => {
                    console.log("OK");
                });
        }
        catch (error) {
            console.log(error);
            throw error;
        }
    }
}
