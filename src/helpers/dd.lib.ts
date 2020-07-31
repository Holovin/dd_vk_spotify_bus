class DdLib {
    public static getTime(): number {
        return Math.round(new Date().getTime() / 1000);
    }
}

export { DdLib }
