import { ModUpdater } from "./ModUpdater.js";
import dotenv from "dotenv";

dotenv.config();

const run = async () => {
    const modsFolder = process.env.MODS_FOLDER as string;
    const modId = process.env.MOD_ID as unknown as number;

    if (!modsFolder) {
        throw new Error("MODS_FOLDER environment variable is not set");
    }

    if (!modId) {
        throw new Error("MOD_ID environment variable is not set");
    }

    const modUpdater = new ModUpdater(modsFolder, modId);
    await modUpdater.downloadMod();
};

run();