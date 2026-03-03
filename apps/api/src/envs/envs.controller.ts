import {
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { EnvsService } from './envs.service';
import { JwtGuard } from '../auth/jwt.guard';

@UseGuards(JwtGuard)
@Controller()
export class EnvsController {
  private readonly logger = new Logger(EnvsController.name);

  constructor(private envs: EnvsService) {}

  @Get('envs')
  async list() {
    this.logger.log('GET /envs - Fetching environments');
    try {
      const envs = await this.envs.list();
      this.logger.log(`GET /envs - Returned ${envs.length} environments`);
      return envs;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`GET /envs - Failed: ${message}`);
      throw new HttpException(
        { statusCode: HttpStatus.INTERNAL_SERVER_ERROR, message: `Failed to fetch environments: ${message}` },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('envs')
  async create(@Body() body: any) {
    this.logger.log(`POST /envs - Creating environment: ${body.name}`);
    try {
      const env = await this.envs.create(body.name);
      this.logger.log(`POST /envs - Created: ${env.name}`);
      return env;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`POST /envs - Failed: ${message}`);
      throw new HttpException(
        { statusCode: HttpStatus.INTERNAL_SERVER_ERROR, message: `Failed to create environment: ${message}` },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('versions/update')
  async update(@Body() body: any) {
    this.logger.log(`POST /versions/update - Updating ${body.name} to ${body.version}`);
    try {
      const env = await this.envs.updateVersion(body.name, body.version);
      this.logger.log(`POST /versions/update - Updated: ${env.name}`);
      return env;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`POST /versions/update - Failed: ${message}`);
      throw new HttpException(
        { statusCode: HttpStatus.INTERNAL_SERVER_ERROR, message: `Failed to update version: ${message}` },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}