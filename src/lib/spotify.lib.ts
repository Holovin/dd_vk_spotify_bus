import got, { Got } from 'got';
import { DdLib } from '../helpers/dd.lib';
import { LibStatus } from '../statuses';
import { Log } from '../helpers/logger';
import { BaseLib, Track } from './base.lib';


class SpotifyLib extends BaseLib {
    public static readonly SPOTIFY_ADD_MAX_TRACKS = 100;
    public static readonly SPOTIFY_SEARCH_TRACKS = 5;

    private clientId: string;
    private clientSecret: string;
    private code: string;
    private redirectUrl: string;
    private state: string;
    private url: string;

    private accessToken: string;
    private refreshToken: string;

    private expiresTime: number;

    constructor({ clientId, clientSecret, redirectUrl, state, url, code, accessToken, expiresTime, refreshToken }) {
        super();

        this.log = Log.getLogger('spotify');

        this.clientId = clientId;
        this.clientSecret = clientSecret;
        this.code = code;
        this.redirectUrl = redirectUrl;
        this.state = state;
        this.url = url;
        this.accessToken = accessToken;
        this.refreshToken = refreshToken;
        this.expiresTime = expiresTime;

        this.got = this.initGot();
    }

    public async apiGetToken() {
        const checkStatus = this.checkTokens();

        switch (checkStatus) {
            case LibStatus.NO_ERROR: {
                this.log.debug(`Skip auth, seems already ok`);

                return checkStatus;
            }

            case LibStatus.ERR_SPOTIFY_NEED_REFRESH_TOKEN: {
                this.log.debug(`Tokens found, but timestamp is old. Need update it`);

                return checkStatus;
            }

            case LibStatus.ERR_SPOTIFY_EMPTY_TOKENS: {
                this.log.debug(`No saved tokens, try get new with auth_code`);

                break;
            }

            default:
                this.log.error(`Unhandled switch statement`);

                return;
        }

        if (!this.code) {
            this.log.error(`Can't get token without code. Url: ${this.url}`);
            return LibStatus.ERR_SPOTIFY_MISSING_PARAMS;
        }

        const result: any = await this.got.post('https://accounts.spotify.com/api/token', {
            form: {
                grant_type: 'authorization_code',
                client_id: this.clientId,
                client_secret: this.clientSecret,
                code: this.code,
                redirect_uri: this.redirectUrl,
                state: this.state,
            },
        }).json();

        if (result?.error === 'invalid_grant') {
            this.log.error(`Need new auth code, open link and copy it: ${this.url}`);
            return LibStatus.ERR_SPOTIFY_OLD_CODE;
        }

        this.log.silly(result);

        this.updateTokens(
            result.access_token,
            result.refresh_token,
            DdLib.getTime() + result.expires_in
        );

        return LibStatus.NO_ERROR;
    }

    public async apiUpdateToken(forceUpdate = false) {
        if (!this.accessToken && !this.refreshToken && !forceUpdate) {
            this.log.error(`Can't refresh empty token`);
            return LibStatus.ERR_SPOTIFY_MISSING_PARAMS;
        }

        const result: any = await this.got.post('https://accounts.spotify.com/api/token', {
            form: {
                grant_type: 'refresh_token',
                client_id: this.clientId,
                client_secret: this.clientSecret,
                refresh_token: this.refreshToken,
            },
        }).json();

        this.log.silly(result);
        this.log.debug(`Update tokens ok: ${result.access_token}, ${result.refresh_token}, ${result.expires_in}`);

        this.updateTokens(
            result.access_token,
            result.refresh_token ?? this.refreshToken,
            DdLib.getTime() + result.expires_in
        );

        return LibStatus.NO_ERROR;
    }

    public getExpiresTime(): number {
        return this.expiresTime;
    }

    public getTokens(): [string, string] {
        return [this.accessToken, this.refreshToken];
    }

    public async apiSearchTrack(query: string, type = 'track', market = 'ru'): Promise<Track[]> {
        if (this.checkTokens() !== LibStatus.NO_ERROR) {
            return null;
        }

        const result: any = await this.got.get('https://api.spotify.com/v1/search', {
            searchParams: {
                q: query,
                type: type,
                market: market,
            }
        }).json();

        this.log.silly(JSON.stringify(result));

        const out: Track[] = [];

        result.tracks.items.slice(0, SpotifyLib.SPOTIFY_SEARCH_TRACKS).forEach(track => {
            const artists = [];
            track.artists.forEach(artist => artists.push(artist.name));

            this.log.debug(`${artists.join(', ')} — ${track.name} // ${track.duration_ms}`);

            const artistsString = artists.join(', ');

            out.push({
                searchString: `${artistsString} - ${track.name}`,
                artist: artistsString,
                title: track.name,
                duration: track.duration_ms,
                id: track.uri,
            });
        });

        this.log.silly(result.tracks.items);

        return out;
    }

    public async apiMe() {
        const result: any = await this.got.get('https://api.spotify.com/v1/me').json();

        if (!result.id) {
            this.isLogged = false;
            return LibStatus.ERR_SPOTIFY_NO_AUTH;
        }

        this.user = {
            id: result.id,
            name: result.display_name,
            uri: result.uri,
        };

        this.log.info(`Logged as ${this.user.id}`);
        this.isLogged = true;

        return LibStatus.NO_ERROR;
    }

    public async apiAddPlaylist(name: string, publicAccess = false, collaborative = false, description = '') {
        const result: any = await this.got.post(`https://api.spotify.com/v1/users/${this.user.id}/playlists`, {
            json: {
                name: name,
                public: publicAccess,
                collaborative: collaborative,
                description: description,
            },
        }).json();

        if (!result.id) {
            this.log.error(`Error while create playlist`);
            this.log.debug(JSON.stringify(result, null, 2));

            return LibStatus.ERR_SPOTIFY_REQUEST_FAILED;
        }

        this.log.debug(`Create new playlist with id: ${result.id}`);

        return result.id;
    }

    public async apiAddTrackToPlaylist(playlistId: string, uris: string[]) {
        if (uris.length >= SpotifyLib.SPOTIFY_ADD_MAX_TRACKS) {
            this.log.warn(`Spotify allows only >=100 items to add, you passed: ${uris.length} items`);
        }

        const result = await this.got.post(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
            json: {
                uris: uris,
            }
        });

        if (result.statusCode !== 201) {
            return LibStatus.ERR_SPOTIFY_REQUEST_FAILED;
        }

        this.log.debug(`Playlist updated, body: ${result.body}`);

        return true;
    }

    private initGot(): Got {
        let extendAuth = {};

        if (this.checkTokens() === LibStatus.NO_ERROR) {
            extendAuth = {
                'Authorization': `Bearer ${this.accessToken}`,
            }
        }

        return got.extend({
            headers: {
                'Accept-Language': 'ru',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0',
                ...extendAuth
            },
            retry: 0,
            throwHttpErrors: false,
        });
    }

    private updateTokens(accessToken: string, refreshToken: string, expiresIn: number, logged = true) {
        this.expiresTime = expiresIn;
        this.accessToken = accessToken;
        this.refreshToken = refreshToken;
        this.isLogged = logged;

        return LibStatus.NO_ERROR;
    }

    private checkTokens() {
        if (this.accessToken && this.refreshToken) {
            const now = DdLib.getTime();

            if (now >= this.expiresTime) {
                return LibStatus.ERR_SPOTIFY_NEED_REFRESH_TOKEN;
            }

            return LibStatus.NO_ERROR;
        }

        return LibStatus.ERR_SPOTIFY_EMPTY_TOKENS;
    }
}

export { SpotifyLib };
