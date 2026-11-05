export const publishPDFOutlineScript = `
local receipt = redis.call('GET', KEYS[2])
if receipt then return 2 end
local pointer = redis.call('GET', KEYS[1])
local revision = ''
if pointer then revision = cjson.decode(pointer).revision end
if revision ~= ARGV[1] then return -1 end
redis.call('SET', KEYS[1], ARGV[2])
redis.call('SET', KEYS[2], ARGV[3])
if ARGV[4] ~= '' then redis.call('SET', KEYS[3], ARGV[4]) end
return 1`
