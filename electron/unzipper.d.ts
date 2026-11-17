declare module 'unzipper' {
  export interface UnzipFile {
    path: string;
    buffer(password?: string): Promise<Buffer>;
    stream(password?: string): NodeJS.ReadableStream;
  }
  export interface UnzipDirectory {
    files: UnzipFile[];
  }
  export const Open: {
    buffer(buffer: Buffer, options?: Record<string, unknown>): Promise<UnzipDirectory>;
  };
}
