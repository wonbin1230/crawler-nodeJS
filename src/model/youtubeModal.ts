import type { videoFormat, videoInfo } from "ytdl-core";

export interface IFormatData {
	videoFormat: videoFormat,
	audioFormat?: videoFormat,
}

// export interface IFolderData {
//     folderPath: string,
//     folderName: string,
// }

export interface IPreviewData {
    videoFolderID: string,
    videoInfo: {
        lengthSeconds: string,
        videoItagList: IItagInfo[],
        audioItagList: IItagInfo[],
    },
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

export interface IDownloadData {
    folderName: string,
    fileName: string,
    titleName: string,
    mediaType: string,
}
