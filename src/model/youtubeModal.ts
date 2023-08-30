import type { videoFormat } from "ytdl-core";

export interface FormatData {
	videoFormat: videoFormat,
	audioFormat: videoFormat,
}
