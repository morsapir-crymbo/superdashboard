import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  UseGuards,
  Logger,
  HttpException,
  HttpStatus,
  ParseIntPipe,
} from '@nestjs/common';
import { EnvsService, CreateCustomerDto, UpdateCustomerDto } from './envs.service';
import { JwtGuard } from '../auth/jwt.guard';

@UseGuards(JwtGuard)
@Controller()
export class EnvsController {
  private readonly logger = new Logger(EnvsController.name);

  constructor(private envs: EnvsService) {}

  @Get('envs')
  async list() {
    this.logger.log('GET /envs - Fetching customers');
    try {
      const envs = await this.envs.list();
      this.logger.log(`GET /envs - Returned ${envs.length} customers`);
      return envs;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`GET /envs - Failed: ${message}`);
      throw new HttpException(
        { statusCode: HttpStatus.INTERNAL_SERVER_ERROR, message: `Failed to fetch customers: ${message}` },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('envs')
  async create(@Body() body: CreateCustomerDto) {
    this.logger.log(`POST /envs - Creating customer: ${body.name}`);
    try {
      const env = await this.envs.create(body);
      this.logger.log(`POST /envs - Created: ${env.name}`);
      return env;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`POST /envs - Failed: ${message}`);
      throw new HttpException(
        { statusCode: HttpStatus.INTERNAL_SERVER_ERROR, message: `Failed to create customer: ${message}` },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put('envs/:id')
  async update(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateCustomerDto) {
    this.logger.log(`PUT /envs/${id} - Updating customer`);
    try {
      const env = await this.envs.update(id, body);
      this.logger.log(`PUT /envs/${id} - Updated: ${env.name}`);
      return env;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`PUT /envs/${id} - Failed: ${message}`);
      throw new HttpException(
        { statusCode: HttpStatus.INTERNAL_SERVER_ERROR, message: `Failed to update customer: ${message}` },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete('envs/:id')
  async delete(@Param('id', ParseIntPipe) id: number) {
    this.logger.log(`DELETE /envs/${id} - Deleting customer`);
    try {
      const result = await this.envs.delete(id);
      this.logger.log(`DELETE /envs/${id} - Deleted`);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`DELETE /envs/${id} - Failed: ${message}`);
      throw new HttpException(
        { statusCode: HttpStatus.INTERNAL_SERVER_ERROR, message: `Failed to delete customer: ${message}` },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('versions/update')
  async updateVersion(@Body() body: any) {
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