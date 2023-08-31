export interface Start {
    command: string,
}

export interface Progress {
	frames: number,
    currentFps: number,
    currentKbps: number,
    targetSize: number,
    timemark: string,
    percent: number[],
}

export interface Stderr {
    line: string,
}

export interface CodecData {
    duration: string,
    format: string,
    audio: string,
    audio_details: string,
    video: string,
    video_details: string,
}

export interface Error {
    error: Error,
    stdout: string | null,
    stderr: string | null,
}

export interface End {
    filenames: string[] | string | null,
    stdout: string[] | string | null,
    stderr: string | null,
}
