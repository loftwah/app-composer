// Loopback-only TLS bridge. The browser resolver maps only this lab's hosts.
import { createServer as tlsServer } from "node:https";
import { request as httpRequest } from "node:http";
import { readFileSync } from "node:fs";
const [root] = process.argv.slice(2);
const run = JSON.parse(readFileSync(root + "/run.json", "utf8"));
const server = tlsServer(
  {
    key: readFileSync(root + "/key.pem"),
    cert: readFileSync(root + "/cert.pem"),
  },
  (req, res) => {
    const host = req.headers.host;
    const port =
      host === "composer.loftwah.com"
        ? run.ports.composer
        : host === "showcase.loftwah.com"
          ? run.ports.showcase
          : host === "guestbook.loftwah.com"
            ? run.ports.guestbook
            : null;
    if (!port) {
      res.writeHead(421);
      res.end("Unknown isolated lab host");
      return;
    }
    const upstream = httpRequest(
      {
        host: "127.0.0.1",
        port,
        path: req.url,
        method: req.method,
        headers: { ...req.headers, "x-forwarded-proto": "https" },
      },
      (reply) => {
        res.writeHead(reply.statusCode, {
          ...reply.headers,
          "X-Composer-Isolated-Lab": root.split("/").at(-1),
        });
        reply.pipe(res);
      },
    );
    upstream.on("error", () => {
      res.writeHead(502);
      res.end("Local lab Worker unavailable");
    });
    req.pipe(upstream);
  },
);
server.listen(8443, "127.0.0.1", () =>
  console.log("Invited-member lab TLS proxy ready on loopback8443"),
);
