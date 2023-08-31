export const delay = (ms: number = 5000): Promise<void> => new Promise((resolve: (value: void | PromiseLike<void>) => void) => setTimeout(resolve, ms));
