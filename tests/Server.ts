import { createServer } from 'node:http'
import { handleFixtureRequest } from './ServerRouter'

const HOST = '127.0.0.1'
const DEFAULT_PORT = 4173
const PORT = Math.max(1, Number.parseInt(process.env.PW_FIXTURE_SERVER_PORT || `${DEFAULT_PORT}`, 10) || DEFAULT_PORT)

const server = createServer((req, res) => {
  void handleFixtureRequest(req, res, { host: HOST, port: PORT })
})

server.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`Fixture server running on http://${HOST}:${PORT}`)
})
