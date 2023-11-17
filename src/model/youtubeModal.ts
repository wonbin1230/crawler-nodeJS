import type { videoFormat } from "ytdl-core";
import type { Stream } from "stream";

export interface IFormatData {
	videoFormat: videoFormat,
	audioFormat?: videoFormat,
}

export interface IPreviewData {
    videoStream: Stream,
    lengthSeconds: string,
    videoItagList: IItagInfo[],
    audioItagList: IItagInfo[],
}

export interface IItagInfo {
    itag: number,
    resolution: string,
}

export interface ItagTranslations {
    37: "1080p",
    137: "1080p",
    22: "720p",
    136: "720p",
    18: "360p",
    139: "48k",
    140: "128k",
    141: "256k",
}

export interface IDownloadRequest {
    url: string,
    range: {
        start: number,
        end: number,
    },
    mediaType: string,
    itag: number,
}

export interface IDownloadResponse {
    mediaType: string,
    titleName: string,
}

export interface IDownloadData {
    folderName: string,
    fileName: string,
    titleName: string,
    mediaType: string,
}
