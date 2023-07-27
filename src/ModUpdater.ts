import fs from "fs";
import { Readable } from "stream";
import { finished } from "stream/promises";

type ModPageResponse = {
    headers: Headers;
    body: string;
}

type RequiredApiHeaders = {
    Cookie: string;
    Referer: string;
    "X-CSRFToken": string;
    "x-requested-with": string;
};

type GameVersion = {
    id: number;
    version: string;
}

type ModVersion = {
    id: number;
    version: string;
    game_version: GameVersion;
    download_url: string;
    version_file_size: number;
    comment: string;
    change_log: string;
    created_at: string;
    updated_at: string;
}

type ChangeLog = {
    body: string;
    version: string;
};

type ModOwner = {
    pk: number;
    spa_id: number;
    spa_username: string;
    username: string;
    realm: string;
}

type ModInfo = {
    id: number;
    downloads: number;
    change_log: ChangeLog[];
    mark: string;
    owner: ModOwner;
    versions: ModVersion[];
}

class ModUpdater {
    private static readonly WOTMOD_EXTENSION = "wotmod";
    private modsFolder: string;
    private modId: number;

    constructor(modsFolder: string, modId: number) {
        this.modsFolder = modsFolder;
        this.modId = modId;
    }

    private async fetchModPage(): Promise<ModPageResponse> {
        const res = await fetch(`https://wgmods.net/${this.modId}/`);
        const headers = res.headers;
        const body = await res.text();

        return {
            headers,
            body,
        };
    }

    private findXCsrfToken(body: string): string {
        const csrfTokenRegex = /window.__SETTINGS__ = JSON\.parse\((.*?)\);/;
        const match = body.match(csrfTokenRegex);
        if (!match) {
            throw new Error("Could not find window settings");
        }

        const parsedSettings = JSON.parse(JSON.parse(match[1]));
        const xCsrfToken = parsedSettings.csrfToken;
        if (!xCsrfToken) {
            throw new Error("No csrfToken was found");
        }

        return xCsrfToken;
    }

    private async getRequiredHeaders(): Promise<RequiredApiHeaders> {
        const modPageResponse = await this.fetchModPage();
        const xCsrfToken = this.findXCsrfToken(modPageResponse.body);

        const cookie = modPageResponse.headers.get("set-cookie");
        if (!cookie) {
            throw new Error("No cookie was returned");
        }

        return {
            Cookie: cookie,
            Referer: `https://wgmods.net/${this.modId}/`,
            "X-CSRFToken": xCsrfToken,
            "x-requested-with": "XMLHttpRequest",
        }
    }

    private async getModInfo(): Promise<ModInfo> {
        const requiredApiHeaders = await this.getRequiredHeaders();

        const res = await fetch(`https://wgmods.net/api/mods/${this.modId}/`, {
            headers: requiredApiHeaders,
        });
        const data = await res.json();

        return data;
    }

    private getDownloadPath(gameVersion: GameVersion, modId: number, modVersion: string): string {
        return `${this.modsFolder}/${gameVersion.version}/${modId}-${modVersion}.${ModUpdater.WOTMOD_EXTENSION}`;
    }

    public async downloadMod(modVersion?: string): Promise<void> {
        const modInfo = await this.getModInfo();

        const downloadedModVersion = modVersion ? modInfo.versions.find(v => v.version === modVersion) : modInfo.versions[0];
        if (!downloadedModVersion) {
            throw new Error(`Could not find version ${modVersion}`);
        }

        const { body } = await fetch(downloadedModVersion.download_url);
        if (!body) {
            throw new Error("No body was returned");
        }    

        const destination = this.getDownloadPath(downloadedModVersion.game_version, modInfo.id, downloadedModVersion.version);
        const stream = fs.createWriteStream(destination);

        // @ts-ignore
        await finished(Readable.fromWeb(body).pipe(stream));
    }
}

export { ModUpdater };