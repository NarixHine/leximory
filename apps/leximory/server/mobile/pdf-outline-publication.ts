export const publishPDFOutlineScript = `
local receipt = redis.call('GET', KEYS[3])
if receipt then return 2 end
local pointer = redis.call('GET', KEYS[1])
local revision = ''
if pointer then revision = cjson.decode(pointer).revision end
if revision ~= ARGV[1] then return -1 end
local cost = tonumber(ARGV[3])
local used = tonumber(redis.call('GET', KEYS[2]) or '0')
if cost > 0 and used + cost > tonumber(ARGV[4]) then return 0 end
if cost > 0 then
  redis.call('INCRBYFLOAT', KEYS[2], cost)
  if redis.call('TTL', KEYS[2]) < 0 then redis.call('EXPIRE', KEYS[2], 2592000) end
end
redis.call('SET', KEYS[1], ARGV[2])
redis.call('SET', KEYS[3], ARGV[5])
if ARGV[6] ~= '' then redis.call('SET', KEYS[4], ARGV[6]) end
return 1`
