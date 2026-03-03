import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

export interface DailyVolumeRecord {
  id: number;
  customerId: string;
  environmentId: string;
  volume: Decimal;
  date: Date;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class VolumeRepository {
  constructor(private prisma: PrismaService) {}

  async findByCustomerAndDateRange(
    customerId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<DailyVolumeRecord[]> {
    return this.prisma.dailyEnvironmentVolume.findMany({
      where: {
        customerId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { date: 'desc' },
    });
  }

  async findByDateRange(startDate: Date, endDate: Date): Promise<DailyVolumeRecord[]> {
    return this.prisma.dailyEnvironmentVolume.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: [{ customerId: 'asc' }, { date: 'desc' }],
    });
  }

  async upsertDailyVolume(
    customerId: string,
    environmentId: string,
    date: Date,
    volume: number,
  ): Promise<DailyVolumeRecord> {
    const dateOnly = new Date(date.toISOString().split('T')[0]);

    return this.prisma.dailyEnvironmentVolume.upsert({
      where: {
        customerId_environmentId_date: {
          customerId,
          environmentId,
          date: dateOnly,
        },
      },
      update: {
        volume,
      },
      create: {
        customerId,
        environmentId,
        date: dateOnly,
        volume,
      },
    });
  }

  async getMissingDates(
    customerId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<Date[]> {
    const existingRecords = await this.prisma.dailyEnvironmentVolume.findMany({
      where: {
        customerId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: { date: true },
    });

    const existingDates = new Set(
      existingRecords.map((r) => r.date.toISOString().split('T')[0]),
    );

    const missingDates: Date[] = [];
    const current = new Date(startDate);
    const end = new Date(endDate);

    while (current <= end) {
      const dateStr = current.toISOString().split('T')[0];
      if (!existingDates.has(dateStr)) {
        missingDates.push(new Date(dateStr));
      }
      current.setDate(current.getDate() + 1);
    }

    return missingDates;
  }

  async sumVolumeForDateRange(
    customerId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<number> {
    const result = await this.prisma.dailyEnvironmentVolume.aggregate({
      where: {
        customerId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      _sum: {
        volume: true,
      },
    });

    return result._sum.volume?.toNumber() || 0;
  }
}
