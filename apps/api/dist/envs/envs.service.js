"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnvsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma.service");
const ioredis_1 = require("ioredis");
let EnvsService = class EnvsService {
    constructor(prisma) {
        this.prisma = prisma;
        this.CACHE_KEY = 'envs:list';
        const url = process.env.REDIS_URL;
        if (url)
            this.redis = new ioredis_1.default(url);
    }
    async list() {
        if (this.redis) {
            const cached = await this.redis.get(this.CACHE_KEY);
            if (cached)
                return JSON.parse(cached);
        }
        const rows = await this.prisma.environment.findMany({ orderBy: { name: 'asc' } });
        if (this.redis)
            await this.redis.set(this.CACHE_KEY, JSON.stringify(rows), 'EX', 60);
        return rows;
    }
    async create(name) {
        const row = await this.prisma.environment.create({ data: { name, version: '0.0.0' } });
        await this.invalidate();
        return row;
    }
    async updateVersion(name, version) {
        const row = await this.prisma.environment.update({
            where: { name },
            data: { version, updatedAt: new Date() },
        });
        await this.invalidate();
        return row;
    }
    async invalidate() { if (this.redis)
        await this.redis.del(this.CACHE_KEY); }
};
exports.EnvsService = EnvsService;
exports.EnvsService = EnvsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], EnvsService);
//# sourceMappingURL=envs.service.js.map