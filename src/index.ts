import nconfLib from 'nconf';
import * as PrettyError from 'pretty-error';
import { DdLib } from './helpers/dd.lib';
import { App } from './app';
import { LibStatus } from './statuses';
import { Log } from './helpers/logger';
import * as process from 'process';
import chunk from 'lodash/chunk';
import { Track } from './lib/base.lib';
import { SpotifyLib } from './lib/spotify.lib';

PrettyError.start();

// TODO: add [add+skip if exist] mode for playlist import
(async () => {
    const log = Log.getLogger('main');
    const nconf = nconfLib.argv().env().file({ file: 'config.json' });
    const app = new App(nconf);

    nconf.set('last_run', DdLib.getTime());

    const options = {
        keys: ['searchString'],
        includeScore: true,
    };

    try {
        const resultAuth = await app.runAuth();
        if (resultAuth !== LibStatus.NO_ERROR) {
            process.exit(1);
        }

        const userId = app.vkLib.getUser().id;
        const musicVK = await app.vkLib.parseMusic(userId);
        log.info(`Parse VK music from user id${userId} done, tracks count: ${musicVK.length}`);

        const playlistId = await app.spotifyLib.apiAddPlaylist(
            `VK Import (${new Date().toLocaleTimeString('ru-RU')} / ${new Date().toLocaleDateString('ru-RU')})` ,
            false,
            false,
            'Imported via https://github.com/Holovin/dd_vk_spotify_bus');
        log.info(`Create Spotify playlist - done, id: ${playlistId}`);

        const vkTracksChunks: Track[][] = chunk(musicVK, SpotifyLib.SPOTIFY_ADD_MAX_TRACKS);

        for (const vkTracksChunk of vkTracksChunks) {
            log.info(`Process chunk...`);
            const spotifyTrackCache: Track[] = [];

            for (const sourceTrack of vkTracksChunk) {
                log.info(`Track: ${sourceTrack.searchString}`);

                const searchString1 = app.cleanSearchString(sourceTrack.searchString);
                const searchString2 = app.hardCleanSearchString(searchString1);
                const searchString3 = app.extremeCleanSearchString(searchString2);
                const searchArray = [...new Set([searchString1, searchString2, searchString3])];
                let addFlag = false;

                log.verbose(`Search array: (size = ${searchArray.length}) \n\t${searchArray.join('\n\t')}`);

                for (const [i, searchString] of Object.entries(searchArray)) {
                    log.verbose(`Search track: [${i}] ${searchString}`);
                    const spotifyTracks = await app.spotifyLib.apiSearchTrack(searchString);
                    await app.sleep(100);

                    const result = app.selectTrackFromSearchSimple(sourceTrack, spotifyTracks, +i === (searchArray.length - 1));
                    if (result) {
                        spotifyTrackCache.push(result);
                        addFlag = true;
                        log.verbose(`              ↑↑↑ add: ${result.searchString} (id: ${result.id}}`);
                        break;

                    } else {
                        log.verbose(`              ↑↑↑ not found`);
                    }
                }

                addFlag ? log.info('Added...') : log.info('No result...');
            }

            const ids: string[] = [];
            for (const track of spotifyTrackCache) {
                if (track.id) {
                    ids.push(track.id);

                } else {
                    log.warn(`No id from track ${track.searchString} (id: ${track.id}}`);
                }
            }

            log.info(`Found ${ids.length} of ${vkTracksChunk.length} tracks in this chunk`);

            await app.spotifyLib.apiAddTrackToPlaylist(playlistId, ids);

            log.info(`Added ${ids.length} tracks to playlist ${playlistId}`);

            await new Promise(r => setTimeout(r, 1000));
        }
    } catch (e) {
        log.error(`${e.message}`);

    } finally {
        nconf.save( () => {});

        log.info(`--- END ---`);
    }
})();
