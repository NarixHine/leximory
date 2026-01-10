"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.redis = void 0;
var redis_1 = require("@upstash/redis");
var env_1 = require("@repo/env");
exports.redis = new redis_1.Redis({
    url: env_1.default.UPSTASH_REDIS_REST_URL,
    token: env_1.default.UPSTASH_REDIS_REST_TOKEN,
});
