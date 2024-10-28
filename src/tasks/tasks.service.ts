import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task } from './task.entity';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { RedisService } from 'src/redis/redis.service';
import { RedisClientType } from 'redis';

@Injectable()
export class TasksService {
  private redisClient: RedisClientType;

  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    @InjectRepository(Task)
    private tasksRepository: Repository<Task>,
    private redisService: RedisService,
  ) {}

  findAll(): Promise<Task[]> {
    return this.tasksRepository.find();
  }

  async findOne(id: number): Promise<Task> {
    try {
      this.redisClient = await this.redisService.getClient();

      const keyType = await this.redisClient.type(`task:${id}`);
      if (keyType === 'hash') {
        const task = await this.redisClient.hGetAll(`task:${id}`);
        if (Object.keys(task).length > 0) {
          return task as any;
        }
      }

      const response = await this.tasksRepository.findOneBy({ id });

      if (response) {
        if (id !== 1) {
          await this.redisClient.hSet(`task:${id}`, {
            id: response.id,
            title: response.title,
            description: response.description,
          });
        }

        await this.redisClient.expire(`task:${id}`, 60);
      }

      return response;
    } catch (error) {
      console.log('error', error);
    }
  }

  async create(createTaskDto: CreateTaskDto): Promise<Task> {
    try {
      this.redisClient = await this.redisService.getClient();
      const task = this.tasksRepository.create(createTaskDto);

      console.log('task', task);
      task.id = (await this.tasksRepository.count()) + 1;
      await this.redisClient.hSet(`task:${task.id}`, {
        id: task.id,
        title: task.title,
        description: task.description,
      });

      await this.redisClient.expire(`task:${task.id}`, 60);

      this.logger.info(`Creating task with title: ${task.title}`);
      return this.tasksRepository.save(task);
    } catch (error) {
      console.log(error);
    }
  }

  async update(id: number, updateTaskDto: UpdateTaskDto): Promise<Task> {
    await this.tasksRepository.update(id, updateTaskDto);
    return this.tasksRepository.findOneBy({ id });
  }

  async remove(id: number): Promise<void> {
    await this.tasksRepository.delete(id);
  }
}
