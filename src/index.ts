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

        const musicVK = await app.vkLib.parseMusic(28392295);
        log.info(`Parse VK music — done, tracks count: ${musicVK.length}`);

        const playlistId = await app.spotifyLib.apiAddPlaylist('VK Import 2');
        log.info(`Create Spotify playlist - done, id: ${playlistId}`);

        const vkTracksChunks: Track[][] = chunk(musicVK, SpotifyLib.SPOTIFY_ADD_MAX_TRACKS);

        for (const vkTracksChunk of vkTracksChunks) {
            log.info(`Process chunk...`);
            const spotifyTrackCache: Track[] = [];

            for (const sourceTrack of vkTracksChunk) {
                log.verbose(`Search track: ${sourceTrack.searchString}`);

                // TODO: clean sourceTrack.searchString from links and other ads
                const searchString = app.cleanSearchString(sourceTrack.searchString);
                const spotifyTracks = await app.spotifyLib.apiSearchTrack(sourceTrack.searchString);
                await app.sleep(100);

                // const result = app.selectTrackFromSearchFuzz(sourceTrack, spotifyTracks, options);
                const result = app.selectTrackFromSearchSimple(sourceTrack, spotifyTracks, options);
                if (result) {
                    spotifyTrackCache.push(result);
                    log.verbose(`              ↑↑↑ add: ${result.searchString} (id: ${result.id}}`);

                } else {
                    log.verbose(`              ↑↑↑ not found`);
                }
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
