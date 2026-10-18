// Generated from checked TypeScript; edit the corresponding .mts source. MIT.
// MIT. Local lab build input, never a production or importer network exception.
export function localMediaPolicy(value) {
    if (value === undefined)
        return undefined;
    const refuse = () => {
        throw Error("Select an exact owned localhost origin: http://localhost:<port>.");
    };
    if (typeof value !== "string" ||
        !/^http:\/\/localhost:[1-9][0-9]{0,4}$/.test(value))
        return refuse();
    if (Number(value.slice(value.lastIndexOf(":") + 1)) > 65535)
        return refuse();
    const origin = new URL(value);
    if (origin.origin !== value || !origin.port || Number(origin.port) > 65535)
        return refuse();
    return {
        remotePatterns: [
            {
                protocol: "http",
                hostname: "localhost",
                port: origin.port,
                pathname: "/_emdash/api/media/file/**",
            },
        ],
    };
}
