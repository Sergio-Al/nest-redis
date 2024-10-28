import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: RedisClientType;

  async onModuleInit() {
    this.client = createClient({
      url: 'redis://localhost:6379',
    });

    this.client.on('error', (err) => console.error('Redis Client Error', err));

    await this.client.connect();
  }

  async onModuleDestroy() {
    await this.client.disconnect();
  }

  async getClient(): Promise<RedisClientType> {
    if (!this.client) {
      throw new Error('Redis client is not initialized');
    }
    if (!this.client.isOpen) {
      await this.client.connect();
    }
    return this.client;
  }
}
