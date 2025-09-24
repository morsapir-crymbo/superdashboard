"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnvsModule = void 0;
const common_1 = require("@nestjs/common");
const envs_controller_1 = require("./envs.controller");
const envs_service_1 = require("./envs.service");
const prisma_service_1 = require("../prisma.service");
const jwt_1 = require("@nestjs/jwt");
const jwt_guard_1 = require("../auth/jwt.guard");
let EnvsModule = class EnvsModule {
};
exports.EnvsModule = EnvsModule;
exports.EnvsModule = EnvsModule = __decorate([
    (0, common_1.Module)({
        imports: [jwt_1.JwtModule.register({ secret: process.env.JWT_SECRET })],
        controllers: [envs_controller_1.EnvsController],
        providers: [envs_service_1.EnvsService, prisma_service_1.PrismaService, jwt_guard_1.JwtGuard],
    })
], EnvsModule);
//# sourceMappingURL=envs.module.js.map