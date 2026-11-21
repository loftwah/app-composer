#!/usr/bin/env python3
"""Local-only three-transport echo probe. Never a Cloudflare performance claim."""
import argparse
import asyncio
import json
import platform
import statistics
import sys
import time
from datetime import datetime, timezone
from http import HTTPStatus
from importlib.metadata import version
from pathlib import Path
from uuid import uuid4

from aiohttp import web, ClientSession
import grpc
from google.protobuf.wrappers_pb2 import BytesValue
from websockets.asyncio.client import connect as ws_connect
from websockets.asyncio.server import serve as ws_serve
from websockets.exceptions import InvalidStatus

TOKEN = 'Bearer local-fixture-token'


def require_authorized(headers):
    return headers.get('authorization') == TOKEN


def encoded(seq, size):
    return json.dumps({'seq': seq, 'payload': 'x' * size}, separators=(',', ':')).encode('utf-8')


def percentile(values, fraction):
    ordered = sorted(values)
    if not ordered:
        return None
    index = (len(ordered) - 1) * fraction
    low = int(index)
    high = min(low + 1, len(ordered) - 1)
    return round(ordered[low] + (ordered[high] - ordered[low]) * (index - low), 4)


class HTTPServer:
    def __init__(self):
        self.clients = {}
        self.app = web.Application()
        self.app.add_routes([web.get('/events/{id}', self.events), web.post('/message/{id}', self.message)])

    async def events(self, request):
        if not require_authorized(request.headers):
            return web.Response(status=401)
        client_id = request.match_info['id']
        if client_id in self.clients:
            return web.Response(status=409)
        queue = asyncio.Queue()
        self.clients[client_id] = queue
        response = web.StreamResponse(status=200, headers={'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store'})
        await response.prepare(request)
        try:
            await response.write(b'event: ready\ndata: ready\n\n')
            while True:
                data = await queue.get()
                if data is None:
                    break
                await response.write(b'data: ' + data + b'\n\n')
        except (ConnectionError, asyncio.CancelledError):
            pass
        finally:
            self.clients.pop(client_id, None)
        return response

    async def message(self, request):
        if not require_authorized(request.headers):
            return web.Response(status=401)
        queue = self.clients.get(request.match_info['id'])
        if queue is None:
            return web.Response(status=404)
        body = await request.read()
        await queue.put(body)
        return web.Response(status=202)

    async def start(self):
        self.runner = web.AppRunner(self.app)
        await self.runner.setup()
        self.site = web.TCPSite(self.runner, '127.0.0.1', 0)
        await self.site.start()
        self.port = self.site._server.sockets[0].getsockname()[1]

    async def stop(self):
        for q in list(self.clients.values()):
            q.put_nowait(None)
        await self.runner.cleanup()


async def ws_auth(connection, request):
    if not require_authorized(request.headers):
        return connection.respond(HTTPStatus.UNAUTHORIZED, 'unauthorized')
    return None


async def ws_echo(connection):
    async for message in connection:
        await connection.send(message)


class GrpcService:
    async def chat(self, incoming, context):
        auth = dict(context.invocation_metadata()).get('authorization')
        if auth != TOKEN:
            await context.abort(grpc.StatusCode.UNAUTHENTICATED, 'unauthorized')
        async for item in incoming:
            yield item


async def start_grpc():
    server = grpc.aio.server()
    handler = grpc.stream_stream_rpc_method_handler(
        GrpcService().chat,
        request_deserializer=BytesValue.FromString,
        response_serializer=BytesValue.SerializeToString,
    )
    server.add_generic_rpc_handlers([grpc.method_handlers_generic_handler('transport.Echo', {'Chat': handler})])
    port = server.add_insecure_port('127.0.0.1:0')
    await server.start()
    return server, port


async def read_sse_data(response):
    while True:
        line = await asyncio.wait_for(response.content.readline(), timeout=8)
        if not line:
            raise RuntimeError('SSE disconnected before response')
        if line.startswith(b'data: '):
            return line[6:].rstrip(b'\r\n')


async def case_http(port, messages, payload_size, clients):
    measurements = []
    async with ClientSession() as session:
        async def task(client):
            key = uuid4().hex
            url = f'http://127.0.0.1:{port}'
            resp = await session.get(f'{url}/events/{key}', headers={'Authorization': TOKEN}, timeout=None)
            if resp.status != 200 or await read_sse_data(resp) != b'ready':
                raise RuntimeError('SSE setup failed')
            try:
                for seq in range(messages):
                    body = encoded(seq + client * messages, payload_size)
                    started = time.perf_counter_ns()
                    async with session.post(f'{url}/message/{key}', data=body, headers={'Authorization': TOKEN}) as result:
                        if result.status != 202:
                            raise RuntimeError(f'SSE submit HTTP {result.status}')
                    returned = await read_sse_data(resp)
                    measurements.append((time.perf_counter_ns() - started) / 1e6)
                    if body != returned:
                        raise AssertionError('SSE payload differs')
            finally:
                q = http_server.clients.get(key)
                if q:
                    q.put_nowait(None)
                resp.close()
        await asyncio.gather(*(task(c) for c in range(clients)))
    return measurements


async def case_ws(port, messages, payload_size, clients):
    measurements = []
    async def task(client):
        async with ws_connect(f'ws://127.0.0.1:{port}', additional_headers={'Authorization': TOKEN}, ping_interval=None, open_timeout=8) as websocket:
            for seq in range(messages):
                body = encoded(seq + client * messages, payload_size)
                started = time.perf_counter_ns()
                await websocket.send(body)
                returned = await asyncio.wait_for(websocket.recv(), timeout=8)
                measurements.append((time.perf_counter_ns() - started) / 1e6)
                if body != returned:
                    raise AssertionError('WebSocket payload differs')
    await asyncio.gather(*(task(c) for c in range(clients)))
    return measurements


async def case_grpc(port, messages, payload_size, clients):
    measurements = []
    async def task(client):
        async with grpc.aio.insecure_channel(f'127.0.0.1:{port}') as channel:
            stream = channel.stream_stream(
                '/transport.Echo/Chat',
                request_serializer=BytesValue.SerializeToString,
                response_deserializer=BytesValue.FromString,
            )(metadata=(('authorization', TOKEN),))
            try:
                for seq in range(messages):
                    body = encoded(seq + client * messages, payload_size)
                    started = time.perf_counter_ns()
                    await stream.write(BytesValue(value=body))
                    result = await asyncio.wait_for(stream.read(), timeout=8)
                    measurements.append((time.perf_counter_ns() - started) / 1e6)
                    if result is grpc.aio.EOF or result.value != body:
                        raise AssertionError('gRPC payload differs')
                await stream.done_writing()
            finally:
                stream.cancel()
    await asyncio.gather(*(task(c) for c in range(clients)))
    return measurements


async def test_authorization(http_port, ws_port, grpc_port):
    async with ClientSession() as session:
        async with session.post(f'http://127.0.0.1:{http_port}/message/not-a-client', data=b'a') as resp:
            if resp.status != 401:
                raise AssertionError('SSE unauthenticated request was accepted')
    try:
        async with ws_connect(f'ws://127.0.0.1:{ws_port}', open_timeout=3):
            raise AssertionError('WebSocket unauthenticated connection was accepted')
    except InvalidStatus as error:
        if error.response.status_code != 401:
            raise AssertionError(f'Unexpected WebSocket denial: HTTP {error.response.status_code}') from error
    async with grpc.aio.insecure_channel(f'127.0.0.1:{grpc_port}') as channel:
        stream = channel.stream_stream('/transport.Echo/Chat', request_serializer=BytesValue.SerializeToString, response_deserializer=BytesValue.FromString)()
        rejected = False
        try:
            await stream.write(BytesValue(value=b'unauthorised'))
            await asyncio.wait_for(stream.read(), timeout=3)
        except grpc.aio.AioRpcError as error:
            if error.code() != grpc.StatusCode.UNAUTHENTICATED:
                raise
            rejected = True
        finally:
            stream.cancel()
        if not rejected:
            raise AssertionError('gRPC unauthenticated stream was not rejected with UNAUTHENTICATED')
    return {'http_sse': 'pass', 'websocket': 'pass', 'grpc': 'pass'}


async def main(options):
    global http_server
    http_server = HTTPServer()
    await http_server.start()
    ws_server = await ws_serve(ws_echo, '127.0.0.1', 0, process_request=ws_auth, max_size=8 * 1024 * 1024)
    ws_port = ws_server.sockets[0].getsockname()[1]
    grpc_server, grpc_port = await start_grpc()
    try:
        controls = await test_authorization(http_server.port, ws_port, grpc_port)
        scenarios = []
        for clients in options.clients:
            for size in options.payloads:
                for transport, runner, port in [('http+sse', case_http, http_server.port), ('websocket', case_ws, ws_port), ('grpc', case_grpc, grpc_port)]:
                    for repetition in range(options.repeats):
                        begin = time.perf_counter()
                        observations = await runner(port, options.messages, size, clients)
                        elapsed = time.perf_counter() - begin
                        scenarios.append({
                            'transport': transport,
                            'clients': clients,
                            'payload_bytes': size,
                            'repetition': repetition + 1,
                            'samples': len(observations),
                            'correct': len(observations) == options.messages * clients,
                            'duration_ms': round(1000 * elapsed, 3),
                            'throughput_messages_per_second': round(len(observations) / elapsed, 1),
                            'latency_ms': {'p50': percentile(observations, 0.50), 'p95': percentile(observations, 0.95), 'p99': percentile(observations, 0.99)},
                        })
        report = {
            'schema': 'cf-transport-local/v1',
            'timestamp_utc': datetime.now(timezone.utc).isoformat(),
            'scope': 'loopback-only; not Cloudflare; no TLS; no cold starts; no real network charges',
            'environment': {'python': platform.python_version(), 'OS': platform.platform(), 'grpcio': version('grpcio'), 'aiohttp': version('aiohttp'), 'websockets': version('websockets')},
            'configuration': {'messages_per_client': options.messages, 'repeats': options.repeats, 'clients': options.clients, 'payloads_bytes': options.payloads, 'message_protocol': 'same application JSON echo; different transport overhead'},
            'unauthorized_rejections': controls,
            'scenarios': scenarios,
            'decision': 'not-qualified-for-cloudflare-adoption; requires isolated Cloudflare deployment and paired live samples',
        }
        return report
    finally:
        ws_server.close()
        await ws_server.wait_closed()
        await grpc_server.stop(grace=0.1)
        await http_server.stop()


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--messages', type=int, default=25)
    parser.add_argument('--clients', type=int, nargs='+', default=[1, 5])
    parser.add_argument('--payloads', type=int, nargs='+', default=[128, 4096])
    parser.add_argument('--repeats', type=int, default=3)
    parser.add_argument('--out', type=Path)
    args = parser.parse_args()
    if not 1 <= args.messages <= 10000 or not 1 <= args.repeats <= 100 or any(not 1 <= x <= 50 for x in args.clients) or any(not 1 <= x <= 1048576 for x in args.payloads):
        parser.error('unsafe workload: messages 1..10000, repeats 1..100, clients 1..50, payload 1..1048576')
    result = asyncio.run(main(args))
    contents = json.dumps(result, indent=2) + '\n'
    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(contents)
    print(contents)
