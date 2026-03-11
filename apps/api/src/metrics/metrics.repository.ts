import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { DailyMetricsRow } from './metrics.types';

@Injectable()
export class MetricsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByDateRange(startDate: Date, endDate: Date): Promise<DailyMetricsRow[]> {
    const records = await this.prisma.dailyMetrics.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: [{ customerId: 'asc' }, { date: 'asc' }],
    });

    return records.map((r) => ({
      id: r.id,
      customerId: r.customerId,
      date: r.date,
      cryptoDepositVolume: Number(r.cryptoDepositVolume),
      cryptoDepositCount: r.cryptoDepositCount,
      cryptoDepositFees: Number(r.cryptoDepositFees),
      fiatDepositVolume: Number(r.fiatDepositVolume),
      fiatDepositCount: r.fiatDepositCount,
      fiatDepositFees: Number(r.fiatDepositFees),
      cryptoWithdrawalVolume: Number(r.cryptoWithdrawalVolume),
      cryptoWithdrawalCount: r.cryptoWithdrawalCount,
      cryptoWithdrawalFees: Number(r.cryptoWithdrawalFees),
      fiatWithdrawalVolume: Number(r.fiatWithdrawalVolume),
      fiatWithdrawalCount: r.fiatWithdrawalCount,
      fiatWithdrawalFees: Number(r.fiatWithdrawalFees),
      transferVolume: Number(r.transferVolume),
      transferCount: r.transferCount,
      transferFees: Number(r.transferFees),
      kytEventCount: r.kytEventCount,
    }));
  }

  async findByCustomerAndDateRange(
    customerId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<DailyMetricsRow[]> {
    const records = await this.prisma.dailyMetrics.findMany({
      where: {
        customerId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { date: 'asc' },
    });

    return records.map((r) => ({
      id: r.id,
      customerId: r.customerId,
      date: r.date,
      cryptoDepositVolume: Number(r.cryptoDepositVolume),
      cryptoDepositCount: r.cryptoDepositCount,
      cryptoDepositFees: Number(r.cryptoDepositFees),
      fiatDepositVolume: Number(r.fiatDepositVolume),
      fiatDepositCount: r.fiatDepositCount,
      fiatDepositFees: Number(r.fiatDepositFees),
      cryptoWithdrawalVolume: Number(r.cryptoWithdrawalVolume),
      cryptoWithdrawalCount: r.cryptoWithdrawalCount,
      cryptoWithdrawalFees: Number(r.cryptoWithdrawalFees),
      fiatWithdrawalVolume: Number(r.fiatWithdrawalVolume),
      fiatWithdrawalCount: r.fiatWithdrawalCount,
      fiatWithdrawalFees: Number(r.fiatWithdrawalFees),
      transferVolume: Number(r.transferVolume),
      transferCount: r.transferCount,
      transferFees: Number(r.transferFees),
      kytEventCount: r.kytEventCount,
    }));
  }

  async getDistinctCustomerIds(): Promise<string[]> {
    const result = await this.prisma.dailyMetrics.findMany({
      select: { customerId: true },
      distinct: ['customerId'],
    });
    return result.map((r) => r.customerId);
  }
}
