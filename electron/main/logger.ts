import * as fs from "fs";
import * as path from "path";
import { app } from "electron";

export const logFilePath = path.join(app.getPath("downloads"), "error.log");

export function logError(message: string) {
  const timestamp = new Date().toISOString();
  const logMessage = `${timestamp} - ${message}\n`;
  fs.appendFile(logFilePath, logMessage, (err) => {
    if (err) {
      console.error("Failed to write to log file:", err);
    }
  });
}
