import got, { Got } from 'got';
import { Log } from '../helpers/logger';
import { LibStatus } from '../statuses';
import { BaseLib, Track } from './base.lib';

class VkLib extends BaseLib {
    private static readonly VK_API_VERSION = '5.131';
    public static readonly VK_MAX_SEARCH_AUDIO_COUNT = 5000;

    private tokenVk: string;
    private loginUrl: string;

    constructor({ token, loginUrl }) {
        super();

        this.log = Log.getLogger('vk');

        this.tokenVk = token;
        this.loginUrl = loginUrl;

        if (!this.tokenVk || !this.loginUrl) {
            this.log.error(`No token or login url`);
        }

        this.got = this.initGot();
    }

    public async parseMusic(userId): Promise<Track[]> {
        const result = await this.apiVkCall('audio.get', {owner_id: userId});

        if (result === LibStatus.ERR_VK_REQUEST_FAILED) {
            return null;
        }

        const data = result.response;

        if (data.count >= VkLib.VK_MAX_SEARCH_AUDIO_COUNT) {
            // TODO: update method
            this.log.warn('Need additional requests for parse all audio');
        }

        const output: Track[] = [];

        data.items.forEach(item => {
            const title = item.subtitle ? `${item.title} (${item.subtitle})` : item.title;

            this.log.debug(`${item.artist} — ${title} :: ${item.duration}`);

            output.push({
                searchString: `${item.artist} - ${title}`,
                artist: item.artist,
                title: title,
                duration: item.duration,
                id: item.id,
            });
        });

        return output;
    }

    public async getMe() {
        const result: any = await this.apiVkCall('account.getProfileInfo', {}, true);

        if (!result.response.id) {
            return LibStatus.ERR_VK_NO_AUTH;
        }

        this.user = {
            id: result.response.id,
            firstName: result.response.first_name,
            lastName: result.response.last_name,
        };

        this.log.info(`Logged as ${this.user.firstName} ${this.user.lastName}`);
        this.isLogged = true;

        return LibStatus.NO_ERROR;
    }

    private async apiVkCall(method, params, force = false): Promise<any> {
        if (!force && !this.isLogged) {
            this.log.error(`Can't call VK without login`);
            return LibStatus.ERR_VK_NO_AUTH;
        }

        const result = await this.got.post(`https://api.vk.com/method/${method}`, {
            searchParams: {
                access_token: this.tokenVk,
                v: VkLib.VK_API_VERSION,
                ...params,
            }
        }).json();

        const error = this.checkError(result);

        if (error) {
            this.log.error(error);
            return LibStatus.ERR_VK_REQUEST_FAILED;
        }

        return result;
    }

    private checkError(response): string {
        if (!response?.error) {
            return null;
        }

        if (response.error?.error_code === 5) {
            this.log.error(`Old token, use url: ${this.loginUrl}`);
        }

        return response.error?.error_msg;
    }

    private initGot(): Got {
        return got.extend({
            headers: {
                'Accept-Language': 'ru',
                'Connection': 'keep-alive',
                'X-Requested-With': 'XMLHttpRequest',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0'
            }
        });
    }
}

export { VkLib };
