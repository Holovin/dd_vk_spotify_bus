import { SpotifyLib } from './lib/spotify.lib';
import { VkLib } from './lib/vk.lib';
import { Provider } from 'nconf';
import { LibStatus } from './statuses';
import { Log } from './helpers/logger';
import { Logger } from 'winston';
import { Track } from './lib/base.lib';
import Fuse from 'fuse.js';


class App {
    public spotifyLib: SpotifyLib;
    public vkLib: VkLib;

    private configProvider: Provider;
    private log: Logger;

    constructor(configProvider) {
        this.log = Log.getLogger('app');
        this.configProvider = configProvider;

        this.spotifyLib = new SpotifyLib({
            clientId:     configProvider.get('spotify:client_id'),
            clientSecret: configProvider.get('spotify:client_secret'),
            code:         configProvider.get('spotify:code'),
            redirectUrl:  configProvider.get('spotify:redirect_url'),
            state:        configProvider.get('spotify:state'),
            url:          configProvider.get('spotify:url'),
            accessToken:  configProvider.get('spotify:access_token'),
            refreshToken: configProvider.get('spotify:refresh_token'),
            expiresTime:  configProvider.get('spotify:expires_time'),
        });

        this.vkLib = new VkLib({
            token:    configProvider.get('vk:token'),
            loginUrl: configProvider.get('vk:url'),
        });

        this.log.info('Init ok...');
    }

    public async sleep(timeout = 100) {
        return new Promise(r => setTimeout(r, timeout));
    }

    public async runAuth() {
        const resultAuthSpotify = await this.runSpotifyAuth();
        if (resultAuthSpotify !== LibStatus.NO_ERROR) {
            return resultAuthSpotify;
        }

        const resultVk = await this.runVkAuthCheck();
        if (resultVk !== LibStatus.NO_ERROR) {
            this.log.error(`VK: ${resultVk}`);
            return resultVk;
        }

        const resultSpotify = await this.runSpotifyAuthCheck();
        if (resultSpotify !== LibStatus.NO_ERROR) {
            this.log.error(`Spotify: ${resultSpotify}`);
            return resultSpotify;
        }

        const isLoggedVk = this.vkLib.getIsLogged();
        const isLoggedSpotify = this.spotifyLib.getIsLogged();
        if (!isLoggedVk || !isLoggedSpotify) {
            this.log.error(`No login state (VK: ${isLoggedVk}, spotify: ${isLoggedSpotify}`);
            return LibStatus.ERROR;
        }

        return LibStatus.NO_ERROR;
    }

    private async runVkAuthCheck() {
        return this.vkLib.getMe();
    }

    private async runSpotifyAuth() {
        const result = await this.spotifyLib.apiGetToken();

        switch (result) {
            case LibStatus.NO_ERROR: {
                this.updateSpotifySettings();

                return result;
            }

            case LibStatus.ERR_SPOTIFY_OLD_CODE: {
                this.configProvider.set('spotify:code' ,'');
                this.log.warn('Code reset, need update config and restart', );

                return result;
            }

            case LibStatus.ERR_SPOTIFY_NEED_REFRESH_TOKEN: {
                const resultUpdate = await this.spotifyLib.apiUpdateToken();

                if (resultUpdate === LibStatus.NO_ERROR) {
                    this.updateSpotifySettings();

                    return resultUpdate;
                }

                return resultUpdate;
            }

            default:
                this.log.warn(`[SpotifyAuth] Wrong answer code: ${result}`);
                return result;
        }
    }

    private async runSpotifyAuthCheck() {
        return this.spotifyLib.apiMe();
    }

    public selectTrackFromSearchSimple(sourceTrack: Track, spotifyTracksSearchResult: Track[], options): Track {
        if (!spotifyTracksSearchResult.length) {
            return null;
        }

        return spotifyTracksSearchResult[0];
    }

    public selectTrackFromSearchFuzz(sourceTrack: Track, spotifyTracksSearchResult: Track[], options): Track {
        const fuse = new Fuse(spotifyTracksSearchResult, options);
        const searchResults = fuse.search(sourceTrack.searchString);
        let maxScore = -1;
        let maxResults: Track[] = [];

        for (const result of searchResults) {
            if (result.score > maxScore) {
                maxScore = result.score;
                maxResults = [result.item];

            } else if (result.score === maxScore) {
                maxResults.push(result.item);
            }
        }

        if (maxResults.length > 1) {
            this.log.debug(`Too much maxResults: ${maxResults}`);

            let minDurationDiff = Number.MAX_SAFE_INTEGER;
            let minDurationItem: Track = maxResults[0];

            for (const result of maxResults) {
                const duration = Math.abs(sourceTrack.duration - result.duration);

                if (minDurationDiff > duration) {
                    minDurationDiff = duration;
                    minDurationItem = result;
                }
            }

            this.log.debug(`Add track: ${minDurationItem.searchString}`);
            return minDurationItem;

        } else if (maxResults.length === 1) {
            this.log.debug(`Add track: ${maxResults[0].searchString}`);

            return maxResults[0];

        } else {
            this.log.debug(`No results for ${sourceTrack.searchString}`);
            return;
        }
    }

    public cleanSearchString(searchString: string): string {
        // TODO
        return searchString;
    }

    private updateSpotifySettings() {
        const [accessToken, refreshToken] = this.spotifyLib.getTokens();

        this.configProvider.set('spotify:expires_time', this.spotifyLib.getExpiresTime());
        this.configProvider.set('spotify:access_token', accessToken);
        this.configProvider.set('spotify:refresh_token', refreshToken);

        const hash = Math.random().toFixed(3);

        this.log.debug(`Saving settings [${hash}]`);

        this.configProvider.save(() => {
            this.log.debug(`Saved ok [${hash}]`)
        });
    }
}

export { App };
