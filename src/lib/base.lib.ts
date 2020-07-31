import { Logger } from 'winston';
import { Got } from 'got';

interface Track {
    searchString: string;
    artist: string;
    title: string;
    duration: number;
    id: string;
}

class BaseLib {
    protected got: Got;
    protected log: Logger = null;

    protected user;
    protected isLogged: boolean;

    public getIsLogged() {
        return this.isLogged;
    }
}

export { BaseLib, Track }
