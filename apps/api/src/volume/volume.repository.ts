import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

export interface DailyVolumeRecord {
  id: number;
  customerId: string;
  environmentId: string;
  volume: Decimal;
  depositCount: number;
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
    depositCount: number = 0,
  ): Promise<DailyVolumeRecord> {
    // Ensure we're working with UTC date at midnight
    // Use Date.UTC to avoid timezone conversion issues
    const dateOnly = new Date(Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      0, 0, 0, 0
    ));
    
    const dateStr = dateOnly.toISOString().split('T')[0];
    console.log(`[VolumeRepository] Upserting ${customerId} for date: ${dateStr} (from input: ${date.toISOString()})`);

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
        depositCount,
      },
      create: {
        customerId,
        environmentId,
        date: dateOnly,
        volume,
        depositCount,
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

  async getVolumeForDate(customerId: string, date: Date): Promise<number> {
    const dateOnly = this.toUTCDateOnly(date);
    
    const record = await this.prisma.dailyEnvironmentVolume.findFirst({
      where: {
        customerId,
        date: dateOnly,
      },
    });

    return record?.volume?.toNumber() || 0;
  }

  async getMetricsForDate(customerId: string, date: Date): Promise<{ volume: number; depositCount: number }> {
    const dateOnly = this.toUTCDateOnly(date);
    
    const record = await this.prisma.dailyEnvironmentVolume.findFirst({
      where: {
        customerId,
        date: dateOnly,
      },
    });

    return {
      volume: record?.volume?.toNumber() || 0,
      depositCount: record?.depositCount || 0,
    };
  }

  private toUTCDateOnly(date: Date): Date {
    return new Date(Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      0, 0, 0, 0
    ));
  }

  /** Latest snapshot row for this customer (by `updatedAt`) — proves when volume was last written. */
  async findLatestSnapshotByCustomer(customerId: string): Promise<DailyVolumeRecord | null> {
    return this.prisma.dailyEnvironmentVolume.findFirst({
      where: { customerId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  /** Snapshot row for the given UTC calendar day (`YYYY-MM-DD`), if present. */
  async findSnapshotByCustomerAndUtcYmd(
    customerId: string,
    ymd: string,
  ): Promise<DailyVolumeRecord | null> {
    const dateOnly = new Date(`${ymd}T00:00:00.000Z`);
    return this.prisma.dailyEnvironmentVolume.findFirst({
      where: {
        customerId,
        date: dateOnly,
      },
    });
  }

  async sumMetricsForDateRange(
    customerId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<{ volume: number; depositCount: number }> {
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
        depositCount: true,
      },
    });

    return {
      volume: result._sum.volume?.toNumber() || 0,
      depositCount: result._sum.depositCount || 0,
    };
  }
}
