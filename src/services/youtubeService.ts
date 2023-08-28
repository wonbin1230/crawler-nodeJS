import { launch } from "puppeteer";
import type { Browser, Page } from "puppeteer";
import { getInfo } from "ytdl-core";
import type { videoInfo } from "ytdl-core";

export class YoutubeService {
    url: string;
    constructor(url: string) {
        this.url = url;
    }

    async goPage(): Promise<void> {
        try {
            const youtubeInfo: videoInfo = await getInfo(this.url);
            console.log(youtubeInfo);

            const browser: Browser = await launch({
                headless: true
            });
            const page: Page = await browser.newPage();
            await page.goto(this.url);
            await page.setViewport({width: 1080, height: 1024});
            await browser.close();
        }
        catch (error) {
            console.log(error);
            throw error;
        }
    }
}
