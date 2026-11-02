import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { z } from 'zod'
import { Redis } from '@upstash/redis'

export function guestRedisFixture() {
    const values = new Map<string, string>()
    const sets = new Map<string, Set<string>>()
    const ttl = new Map<string, number>()
    let fail = false
    let lose = false
    const literal = (value: string) => JSON.stringify(value)
    function evaluate(script: string, keys: string[], args: string[]) {
        const setup = [
            'local data, sets, ttl = {}, {}, {}',
            ...[...values].map(([key, value]) => `data[${literal(key)}] = ${literal(value)}`),
            ...[...sets].map(([key, members]) => `sets[${literal(key)}] = {${[...members].map(literal).join(',')}}`),
            ...[...ttl].map(([key, value]) => `ttl[${literal(key)}] = ${value}`),
            `KEYS = {${keys.map(literal).join(',')}}`,
            `ARGV = {${args.map(literal).join(',')}}`,
        ].join('\n')
        const runtime = `
redis = { call = function(command, ...)
  local args = {...}; local key, value = args[1], args[2]
  if command == 'GET' then return data[key]
  elseif command == 'SET' then data[key] = tostring(value); if args[3] == 'EX' then ttl[key] = tonumber(args[4]) end; return 'OK'
  elseif command == 'EXISTS' then return (data[key] or sets[key]) and 1 or 0
  elseif command == 'TTL' then return ttl[key] or -1
  elseif command == 'EXPIRE' then ttl[key] = tonumber(value); return 1
  elseif command == 'INCR' then data[key] = tostring(tonumber(data[key] or '0') + 1); return tonumber(data[key])
  elseif command == 'DECR' then data[key] = tostring(tonumber(data[key] or '0') - 1); return tonumber(data[key])
  elseif command == 'SADD' then sets[key] = sets[key] or {}; for _, v in ipairs(sets[key]) do if v == value then return 0 end end; table.insert(sets[key], value); return 1
  elseif command == 'SMEMBERS' then return sets[key] or {}
  elseif command == 'DEL' then local count = 0; for _, k in ipairs(args) do if data[k] or sets[k] then count = count + 1 end; data[k] = nil; sets[k] = nil; ttl[k] = nil end; return count
  else error('Unsupported Redis command ' .. command) end
end }
local result = assert(load([==[${script}]==]))()
print('R\\t' .. tostring(result))
local function hex(value) return (value:gsub('.', function(char) return string.format('%02x', string.byte(char)) end)) end
for key, value in pairs(data) do print('V\\t' .. hex(key) .. '\\t' .. hex(value)) end
for key, members in pairs(sets) do for _, member in ipairs(members) do print('S\\t' .. hex(key) .. '\\t' .. hex(member)) end end
for key, value in pairs(ttl) do print('T\\t' .. hex(key) .. '\\t' .. tostring(value)) end
`
        const run = spawnSync('lua', ['-'], { input: setup + '\n' + runtime, encoding: 'utf8' })
        assert.equal(run.status, 0, run.stderr)
        values.clear()
        sets.clear()
        ttl.clear()
        let result = 0
        for (const line of run.stdout.trim().split('\n')) {
            const [kind, key, value] = line.split('\t')
            if (kind === 'R') {
                result = Number(key)
                continue
            }
            const decodedKey = Buffer.from(key ?? '', 'hex').toString()
            if (kind === 'V') values.set(decodedKey, Buffer.from(value ?? '', 'hex').toString())
            if (kind === 'T') ttl.set(decodedKey, Number(value))
            if (kind === 'S') {
                const members = sets.get(decodedKey) ?? new Set()
                members.add(Buffer.from(value ?? '', 'hex').toString())
                sets.set(decodedKey, members)
            }
        }
        return result
    }
    const fetcher: typeof fetch = async (_input, options) => {
        if (fail) return Response.json({ error: 'Redis unavailable' }, { status: 503 })
        const command = z
            .array(z.union([z.string(), z.number()]))
            .parse(JSON.parse(String(options?.body)))
            .map(String)
        const name = command[0]?.toUpperCase()
        const key = command[1] ?? ''
        let result: unknown
        if (name === 'EVAL') {
            const count = Number(command[2])
            result = evaluate(key, command.slice(3, 3 + count), command.slice(3 + count))
        } else if (name === 'GET') result = values.get(key) ?? null
        else if (name === 'MGET') result = command.slice(1).map((key) => values.get(key) ?? null)
        else if (name === 'SET') {
            if (command.map((part) => part.toUpperCase()).includes('NX') && values.has(key)) result = null
            else {
                values.set(key, command[2] ?? '')
                result = 'OK'
            }
        } else throw new Error('Unexpected Redis HTTP command ' + name)
        if (lose) {
            lose = false
            throw new Error('Response lost after commit')
        }
        const encoded = (value: unknown) => (typeof value === 'string' ? Buffer.from(value).toString('base64') : value)
        return Response.json({
            result:
                name === 'GET'
                    ? encoded(result)
                    : name === 'MGET' && Array.isArray(result)
                      ? result.map(encoded)
                      : result,
        })
    }
    const redis = new Redis({
        url: 'https://guest-redis.fixture.invalid',
        token: 'fixture',
        enableAutoPipelining: false,
        retry: { retries: 0 },
    })
    return {
        redis,
        fetcher,
        values,
        ttl,
        fail(value = true) {
            fail = value
        },
        loseNextResponse() {
            lose = true
        },
    }
}
